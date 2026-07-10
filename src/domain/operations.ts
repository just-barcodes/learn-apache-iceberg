import { clock } from "./ids";
import { initialState } from "./initialState";
import { genRecords, type GenOptions, type OrderIdCounter } from "./records";
import { deletedSetFor, getSnap, liveRecords, referencedFiles } from "./selectors";
import { SPEC_DEFS } from "./specs";
import type {
  DetailLevel,
  Manifest,
  NodeKind,
  QueryColumn,
  QueryOp,
  Snapshot,
  TableState,
} from "./types";

/** Coerce the (possibly-empty) append-rows field to a bounded row count. */
function appendCount(appendRows: number | ""): number {
  return Math.max(1, Math.min(999, parseInt(String(appendRows), 10) || 3));
}

/** Keep only the digits of raw input, or "" if none. */
function digits(value: string): string {
  return value.replace(/\D/g, "");
}

// ---- append -------------------------------------------------------------

export function append(s: TableState): TableState {
  const c = { ...s.counters };
  c.s++;
  c.v++;
  const sid = "s" + c.s;
  const v = c.v;
  const month = "2026-0" + ((c.s % 3) + 1);
  const specId = s.specId || 0;
  const specDef = SPEC_DEFS[specId];
  const ctr: OrderIdCounter = { oid: c.oid };
  const rows = appendCount(s.appendRows);
  const nFiles = rows < 50 ? 1 : rows < 300 ? 2 : 3;
  const nd: string[] = [];
  const dataFiles = { ...s.dataFiles };
  for (let i = 0; i < nFiles; i++) {
    const cnt = Math.floor(rows / nFiles) + (i < rows % nFiles ? 1 : 0);
    c.d++;
    const id = "d" + c.d;
    nd.push(id);
    const opts: GenOptions = { month };
    let pv: string;
    if (specDef.transform === "day") {
      const day = 1 + ((i * 9 + 3) % 27);
      opts.day = day;
      pv = month + "-" + String(day).padStart(2, "0");
    } else if (specDef.transform.indexOf("bucket") === 0) {
      const b = i % 4;
      opts.bucket = b;
      pv = "bucket_" + b;
    } else {
      pv = month;
    }
    dataFiles[id] = {
      id,
      records: genRecords(cnt, opts, ctr),
      size: Math.max(1, cnt),
      partition: pv,
      specId,
      born: c.s,
    };
  }
  c.oid = ctr.oid;
  c.m++;
  const mid = "m" + c.m;
  const manifests: Record<string, Manifest> = {
    ...s.manifests,
    [mid]: { id: mid, kind: "data", files: nd, op: "append", seq: c.s },
  };
  const parent = getSnap(s, s.current);
  const manList = parent ? [...parent.manifests, mid] : [mid];
  const snap: Snapshot = {
    id: sid,
    seq: c.s,
    op: "append",
    ts: clock(c.s),
    parent: parent ? parent.id : null,
    manifests: manList,
  };
  return {
    ...s,
    counters: c,
    dataFiles,
    manifests,
    snapshots: [...s.snapshots, snap],
    metas: [...s.metas, { v, snapshot: sid, specId }],
    current: sid,
    selected: sid,
    log: [
      {
        n: c.s,
        op: "append",
        text:
          "Appended " +
          rows +
          " rows across " +
          nFiles +
          " data file(s) (" +
          nd.join(", ") +
          ") → snapshot " +
          sid +
          ", metadata v" +
          v +
          ".",
      },
      ...s.log,
    ],
    lastStep: {
      op: "append",
      title: "Append commit → snapshot " + sid,
      body: "INSERT writes new immutable data files, wraps them in a new manifest, then commits a new snapshot. Iceberg reuses the parent’s existing manifests, so only the delta is written.",
      bullets: [
        rows + " rows written to " + nFiles + " new data file(s): " + nd.join(", "),
        "new data manifest " + mid + ".avro",
        "snapshot " + sid + " points at " + manList.length + " manifest(s); old ones reused",
        "metadata bumped to v" + v + ", current-snapshot moved to " + sid,
      ],
    },
  };
}

// ---- delete (merge-on-read) --------------------------------------------

/** Open the delete picker, unless there are no live rows to delete. */
export function openDelete(s: TableState): TableState {
  const live = liveRecords(s, s.current).live;
  if (!live.length) {
    return {
      ...s,
      lastStep: {
        op: "delete",
        title: "Nothing left to delete",
        body: "There are no live rows in the current snapshot. Append some rows first.",
        bullets: [],
      },
    };
  }
  return { ...s, picker: { selected: {}, n: 3 } };
}

export function setRandomN(s: TableState, value: string): TableState {
  if (!s.picker) return s;
  const d = digits(value);
  return { ...s, picker: { ...s.picker, n: d === "" ? "" : parseInt(d, 10) } };
}

export function togglePick(s: TableState, oid: number, file: string): TableState {
  if (!s.picker) return s;
  const selected = { ...s.picker.selected };
  if (selected[oid]) delete selected[oid];
  else selected[oid] = file;
  return { ...s, picker: { ...s.picker, selected } };
}

export function cancelPicker(s: TableState): TableState {
  return { ...s, picker: null };
}

/** Randomly check N of the live rows in the picker. Non-deterministic by design. */
export function randomPick(s: TableState): TableState {
  if (!s.picker) return s;
  const cur = getSnap(s, s.current);
  const { dfs } = referencedFiles(s, cur);
  const del = deletedSetFor(s, cur);
  const rows: { oid: number; file: string }[] = [];
  dfs.forEach((fid) => {
    for (const r of s.dataFiles[fid]?.records ?? []) {
      if (!del.has(r.order_id)) rows.push({ oid: r.order_id, file: fid });
    }
  });
  if (!rows.length) return s;
  const want = Math.max(1, Math.min(rows.length, parseInt(String(s.picker.n), 10) || 1));
  const shuffled = rows
    .slice()
    .sort(() => Math.random() - 0.5)
    .slice(0, want);
  const selected: Record<number, string> = {};
  shuffled.forEach((x) => {
    selected[x.oid] = x.file;
  });
  return { ...s, picker: { ...s.picker, selected } };
}

/** Commit the picked rows as a merge-on-read delete file + delete manifest + snapshot. */
export function confirmDelete(s: TableState): TableState {
  const sel = s.picker ? s.picker.selected : {};
  const entries = Object.keys(sel).map((k) => ({ order_id: Number(k), file: sel[Number(k)] }));
  if (!entries.length) return s;
  const cur = getSnap(s, s.current);
  if (!cur) return s;
  const c = { ...s.counters };
  c.s++;
  c.v++;
  c.x++;
  const sid = "s" + c.s;
  const v = c.v;
  const xid = "x" + c.x;
  const deletedIds = entries.map((e) => e.order_id).sort((a, b) => a - b);
  const targets = [...new Set(entries.map((e) => e.file))].sort();
  const deleteFiles = {
    ...s.deleteFiles,
    [xid]: { id: xid, entries, deletedIds, targets, size: 1, born: c.s },
  };
  c.m++;
  const mid = "m" + c.m;
  const manifests: Record<string, Manifest> = {
    ...s.manifests,
    [mid]: { id: mid, kind: "delete", files: [xid], op: "delete", seq: c.s },
  };
  const manList = [...cur.manifests, mid];
  const snap: Snapshot = {
    id: sid,
    seq: c.s,
    op: "delete",
    ts: clock(c.s),
    parent: cur.id,
    manifests: manList,
  };
  return {
    ...s,
    picker: null,
    counters: c,
    deleteFiles,
    manifests,
    snapshots: [...s.snapshots, snap],
    metas: [...s.metas, { v, snapshot: sid, specId: s.specId || 0 }],
    current: sid,
    selected: sid,
    log: [
      {
        n: c.s,
        op: "delete",
        text:
          "Merge-on-read delete of " +
          deletedIds.length +
          " row(s) (" +
          deletedIds.join(", ") +
          ") → delete file " +
          xid +
          ", snapshot " +
          sid +
          ".",
      },
      ...s.log,
    ],
    lastStep: {
      op: "delete",
      title: "Merge-on-read delete → snapshot " + sid,
      body: "Iceberg does not rewrite the data files. It writes a small delete file marking exactly which rows are gone. Readers subtract deletes from data on the fly: fast to commit, but adds a file to reconcile at read time.",
      bullets: [
        "delete file " + xid + " removes " + deletedIds.length + " row(s): " + deletedIds.join(", "),
        "targets " + targets.length + " data file(s): " + targets.join(", ") + " (left untouched)",
        "new delete manifest " + mid + ".avro",
        "snapshot " + sid + " = parent manifests + the delete manifest",
      ],
    },
  };
}

// ---- compaction ---------------------------------------------------------

export function compact(s: TableState): TableState {
  const cur = getSnap(s, s.current);
  const { dfs, xfs } = referencedFiles(s, cur);
  const dataIds = [...dfs];
  const delIds = [...xfs];
  if (dataIds.length < 2 && delIds.length === 0) {
    return {
      ...s,
      lastStep: {
        op: "compaction",
        title: "Nothing worth compacting",
        body: "Compaction pays off with several small data files (or delete files to apply). Append a few more times, then compact.",
        bullets: [],
      },
    };
  }
  if (!cur) return s;
  const live = liveRecords(s, s.current).live;
  const totalSize = Math.max(
    4,
    dataIds.reduce((a, id) => a + (s.dataFiles[id]?.size || 0), 0),
  );
  const c = { ...s.counters };
  c.s++;
  c.v++;
  c.d++;
  const sid = "s" + c.s;
  const v = c.v;
  const cid = "d" + c.d;
  const dataFiles = {
    ...s.dataFiles,
    [cid]: {
      id: cid,
      records: live.map((r) => ({ ...r })),
      size: totalSize,
      partition: "compacted",
      specId: s.specId || 0,
      born: c.s,
      compacted: true,
    },
  };
  c.m++;
  const mid = "m" + c.m;
  const manifests: Record<string, Manifest> = {
    ...s.manifests,
    [mid]: { id: mid, kind: "data", files: [cid], op: "compaction", seq: c.s },
  };
  const snap: Snapshot = {
    id: sid,
    seq: c.s,
    op: "compaction",
    ts: clock(c.s),
    parent: cur.id,
    manifests: [mid],
  };
  return {
    ...s,
    counters: c,
    dataFiles,
    manifests,
    snapshots: [...s.snapshots, snap],
    metas: [...s.metas, { v, snapshot: sid, specId: s.specId || 0 }],
    current: sid,
    selected: sid,
    log: [
      {
        n: c.s,
        op: "compaction",
        text:
          "Compacted " +
          dataIds.length +
          " data + " +
          delIds.length +
          " delete file(s) into " +
          cid +
          " → snapshot " +
          sid +
          ".",
      },
      ...s.log,
    ],
    lastStep: {
      op: "compaction",
      title: "Compaction → snapshot " + sid,
      body:
        "Compaction rewrites many small files into one, applying pending deletes as it goes. For readers it is a metadata-only commit: " +
        sid +
        " gets a brand-new manifest list. The old files stay on disk; older snapshots still reference them, so time travel keeps working.",
      bullets: [
        dataIds.length + " data + " + delIds.length + " delete file(s) merged into " + cid,
        "deletes baked in: " + live.length + " live rows remain",
        "new snapshot uses a fresh manifest list (" + mid + ".avro)",
        "old files persist until you expire snapshots",
      ],
    },
  };
}

// ---- expire snapshots ---------------------------------------------------

export function expire(s: TableState): TableState {
  if (s.snapshots.length <= 1) {
    return {
      ...s,
      lastStep: {
        op: "expire",
        title: "Nothing to expire",
        body: "There is only one snapshot. Make a few commits, then expire to reclaim storage.",
        bullets: [],
      },
    };
  }
  const cur = getSnap(s, s.current);
  if (!cur) return s;
  const kept = referencedFiles(s, cur);
  const snapshots: Snapshot[] = [{ ...cur, parent: null }];
  const manifests: TableState["manifests"] = {};
  kept.mans.forEach((id) => {
    if (s.manifests[id]) manifests[id] = s.manifests[id];
  });
  const dataFiles: TableState["dataFiles"] = {};
  kept.dfs.forEach((id) => {
    if (s.dataFiles[id]) dataFiles[id] = s.dataFiles[id];
  });
  const deleteFiles: TableState["deleteFiles"] = {};
  kept.xfs.forEach((id) => {
    if (s.deleteFiles[id]) deleteFiles[id] = s.deleteFiles[id];
  });
  const metas = s.metas.filter((m) => m.snapshot === cur.id);
  const dropSnaps = s.snapshots.length - 1;
  const gcD = Object.keys(s.dataFiles).length - Object.keys(dataFiles).length;
  const gcX = Object.keys(s.deleteFiles).length - Object.keys(deleteFiles).length;
  const gcM = Object.keys(s.manifests).length - Object.keys(manifests).length;
  return {
    ...s,
    snapshots,
    manifests,
    dataFiles,
    deleteFiles,
    metas,
    selected: cur.id,
    inspect: null,
    log: [
      {
        n: cur.seq,
        op: "expire",
        text:
          "Expired " +
          dropSnaps +
          " snapshot(s); GC removed " +
          gcD +
          " data, " +
          gcX +
          " delete, " +
          gcM +
          " manifest file(s).",
      },
      ...s.log,
    ],
    lastStep: {
      op: "expire",
      title: "Expired snapshots → kept " + cur.id,
      body: "Expiring drops old snapshots from the metadata. Any file no longer reachable from a surviving snapshot is then safe to garbage-collect. This reclaims storage but permanently ends time travel to the removed snapshots.",
      bullets: [
        dropSnaps + " snapshot(s) removed from history",
        gcD + " data + " + gcX + " delete file(s) garbage-collected",
        gcM + " orphaned manifest(s) cleaned up",
        "only " + cur.id + " remains reachable",
      ],
    },
  };
}

// ---- partition evolution (metadata-only) --------------------------------

export function evolve(s: TableState): TableState {
  const next = ((s.specId || 0) + 1) % SPEC_DEFS.length;
  const specs = s.specs.includes(next) ? s.specs : [...s.specs, next];
  const c = { ...s.counters };
  c.v++;
  const v = c.v;
  const d = SPEC_DEFS[next];
  return {
    ...s,
    specId: next,
    specs,
    counters: c,
    metas: [...s.metas, { v, snapshot: s.current, specId: next }],
    log: [
      {
        n: getSnap(s, s.current)?.seq ?? 0,
        op: "evolve",
        text:
          "Evolved partition spec → " +
          d.label +
          " (spec-" +
          next +
          "); wrote metadata v" +
          v +
          " (no new snapshot).",
      },
      ...s.log,
    ],
    lastStep: {
      op: "evolve",
      title: "Partition evolution → spec-" + next,
      body:
        "Changing the partition spec is a metadata-only operation — no data is rewritten and no snapshot is created. A new metadata version records the new spec (" +
        d.label +
        "). Existing data files keep their old spec; only files written afterwards use the new one.",
      bullets: [
        "new partition spec: " + d.label,
        "metadata bumped to v" + v + ", current-snapshot pointer unchanged",
        "existing data files keep their original spec",
        "append now to see files written under the new spec",
      ],
    },
  };
}

// ---- table reset & UI state --------------------------------------------

export function reset(s: TableState): TableState {
  return { ...initialState(), level: s.level };
}

export function setLevel(s: TableState, level: DetailLevel): TableState {
  return { ...s, level, qActive: level === "advanced" ? s.qActive : false };
}

export function jumpCurrent(s: TableState): TableState {
  return { ...s, selected: s.current };
}

export function selectSnap(s: TableState, id: string): TableState {
  return { ...s, selected: id };
}

export function openInspect(s: TableState, kind: NodeKind, id: string | null): TableState {
  return { ...s, inspect: { kind, id } };
}

export function closeInspect(s: TableState): TableState {
  return { ...s, inspect: null };
}

// ---- append-rows field --------------------------------------------------

export function rowsInc(s: TableState): TableState {
  return { ...s, appendRows: Math.min(999, (parseInt(String(s.appendRows), 10) || 0) + 1) };
}

export function rowsDec(s: TableState): TableState {
  return { ...s, appendRows: Math.max(1, (parseInt(String(s.appendRows), 10) || 1) - 1) };
}

export function rowsInput(s: TableState, value: string): TableState {
  const d = digits(value);
  return { ...s, appendRows: d === "" ? "" : Math.min(999, parseInt(d, 10)) };
}

// ---- query planner field -----------------------------------------------

export function setQueryCol(s: TableState, col: QueryColumn): TableState {
  return { ...s, q: { ...s.q, col } };
}

export function setQueryOp(s: TableState, op: QueryOp): TableState {
  return { ...s, q: { ...s.q, op } };
}

export function setQueryVal(s: TableState, val: string): TableState {
  return { ...s, q: { ...s.q, val } };
}

export function runQuery(s: TableState): TableState {
  return s.q && s.q.val !== "" && s.q.val != null ? { ...s, qActive: true } : s;
}

export function clearQuery(s: TableState): TableState {
  return { ...s, qActive: false };
}
