import { snapNum, tsMs } from "../domain/ids";
import { getSnap, liveRecords, liveRows, metaVForSnap, referencedFiles } from "../domain/selectors";
import { ORDER_COLS, SPEC_DEFS, TABLE_UUID } from "../domain/specs";
import type { NodeKind, OrderRecord, TableState } from "../domain/types";

type Align = "left" | "right";

export interface GridCell {
  value: string;
  align: Align;
  mono: boolean;
}
export interface GridColumn {
  label: string;
  align: Align;
}
export interface GridRow {
  deleted: boolean;
  cells: GridCell[];
}

export interface ManifestEntry {
  status: string;
  statusVariant: "added" | "existing" | "deleted";
  content: string;
  contentVariant: "data" | "deletes";
  path: string;
  partition: string;
  rows: string;
  size: string;
  extra: string;
}

export interface Fact {
  k: string;
  v: string | number;
}
export interface JumpLink {
  label: string;
  kind: NodeKind;
  id: string | null;
}
export interface Summary {
  facts: Fact[];
  links: JumpLink[];
}

interface Base {
  open: true;
  pillKind: NodeKind;
  pill: string;
  title: string;
  subtitle: string;
}

export type InspectorModel =
  | { open: false }
  | (Base & { view: "grid"; caption: string; cols: GridColumn[]; rows: GridRow[]; stats: string | null })
  | (Base & { view: "entries"; caption: string; entries: ManifestEntry[] })
  | (Base & {
      view: "json";
      caption: string;
      jsonText: string;
      summary: Summary | null;
      deletedList: string | null;
    });

const cols: GridColumn[] = ORDER_COLS.map((c) => ({ label: c.label, align: c.align }));

/** Sort records by id and mark rows present in `deletedSet` as struck-through. */
function gridRows(records: OrderRecord[], deletedSet: Set<number> | null): GridRow[] {
  return records
    .slice()
    .sort((a, b) => a.order_id - b.order_id)
    .map((r) => ({
      deleted: !!(deletedSet && deletedSet.has(r.order_id)),
      cells: ORDER_COLS.map((c) => ({
        value: String(r[c.key]),
        align: c.align,
        mono: c.mono,
      })),
    }));
}

/** Build the inspector modal's contents for whatever node is being inspected. */
export function buildInspector(state: TableState): InspectorModel {
  if (!state.inspect) return { open: false };
  const { kind, id } = state.inspect;

  if (kind === "table") {
    const { live, deleted } = liveRecords(state, state.selected);
    const all = [...live, ...deleted];
    const dset = new Set(deleted.map((r) => r.order_id));
    const dfCount = referencedFiles(state, getSnap(state, state.selected)).dfs.size;
    return {
      open: true,
      pillKind: "snapshot",
      pill: "TABLE",
      title: "orders",
      subtitle: "materialized table @ " + state.selected,
      view: "grid",
      cols,
      rows: gridRows(all, dset),
      caption: deleted.length
        ? live.length +
          " live rows. " +
          deleted.length +
          " row(s) are hidden by merge-on-read delete files (shown struck through); this reconciliation happens at read time."
        : live.length + " live rows, materialized from " + dfCount + " data file(s).",
      stats: null,
    };
  }

  if (kind === "meta") {
    const meta = state.metas.find((m) => "v" + m.v === id);
    if (!meta) {
      return {
        open: true,
        pillKind: "meta",
        pill: "JSON",
        title: id + ".metadata.json",
        subtitle: "expired",
        view: "json",
        caption: "",
        jsonText: "// this metadata version was removed when snapshots expired",
        summary: null,
        deletedList: null,
      };
    }
    const uptoSeq = meta.snapshot ? getSnap(state, meta.snapshot)?.seq ?? 0 : 0;
    const snaps = state.snapshots
      .filter((s) => s.seq <= uptoSeq)
      .map((s) => {
        const rf = referencedFiles(state, s);
        return {
          "snapshot-id": snapNum(s.seq),
          "parent-snapshot-id": s.parent ? snapNum(getSnap(state, s.parent)?.seq ?? 0) : null,
          "sequence-number": s.seq,
          "timestamp-ms": tsMs(s.seq),
          summary: {
            operation: s.op,
            "total-data-files": rf.dfs.size,
            "total-delete-files": rf.xfs.size,
            "total-records": liveRows(state, s.id),
          },
          "manifest-list":
            "s3://warehouse/db/orders/metadata/snap-" + snapNum(s.seq) + "-1-" + TABLE_UUID + ".avro",
          "schema-id": 0,
        };
      });
    const obj = {
      "format-version": 2,
      "table-uuid": TABLE_UUID,
      location: "s3://warehouse/db/orders",
      "last-updated-ms": tsMs(uptoSeq),
      "last-column-id": 5,
      "current-schema-id": 0,
      schemas: [
        {
          type: "struct",
          "schema-id": 0,
          fields: [
            { id: 1, name: "order_id", required: true, type: "long" },
            { id: 2, name: "customer", required: false, type: "string" },
            { id: 3, name: "amount", required: false, type: "decimal(10,2)" },
            { id: 4, name: "order_date", required: false, type: "string" },
            { id: 5, name: "status", required: false, type: "string" },
          ],
        },
      ],
      "default-spec-id": meta.specId || 0,
      "partition-specs": state.specs.map((idx) => {
        const d = SPEC_DEFS[idx];
        return {
          "spec-id": idx,
          fields: [{ name: d.field, transform: d.transform, "source-id": d.srcId, "field-id": 1000 + idx }],
        };
      }),
      "current-snapshot-id": meta.snapshot ? snapNum(getSnap(state, meta.snapshot)?.seq ?? 0) : null,
      snapshots: snaps,
      "snapshot-log": snaps.map((s) => ({ "snapshot-id": s["snapshot-id"], "timestamp-ms": s["timestamp-ms"] })),
    };
    return {
      open: true,
      pillKind: "meta",
      pill: "JSON",
      title: "v" + meta.v + ".metadata.json",
      subtitle: "root table metadata: schema, partition spec, snapshot list",
      view: "json",
      caption:
        "This single JSON file is the entry point for the table. The catalog just stores a pointer to the latest version.",
      jsonText: JSON.stringify(obj, null, 2),
      summary: {
        facts: [
          { k: "format", v: "v2" },
          { k: "columns", v: 5 },
          { k: "spec", v: SPEC_DEFS[meta.specId || 0].label },
          { k: "snapshots", v: snaps.length },
          { k: "current", v: meta.snapshot || "none" },
        ],
        links: [
          ...(meta.snapshot
            ? [{ label: "current → " + meta.snapshot, kind: "snapshot" as const, id: meta.snapshot }]
            : []),
          { label: "orders table", kind: "table", id: null },
        ],
      },
      deletedList: null,
    };
  }

  if (kind === "snapshot") {
    const s = getSnap(state, id);
    if (!s) return { open: false };
    const rf = referencedFiles(state, s);
    const manifests = s.manifests
      .map((mid) => {
        const m = state.manifests[mid];
        if (!m) return null;
        return {
          "manifest-path": m.id + "-" + TABLE_UUID + ".avro",
          content: m.kind === "delete" ? "DELETES" : "DATA",
          "sequence-number": m.seq,
          "added-snapshot-id": snapNum(m.seq),
          "added-files-count": m.files.length,
        };
      })
      .filter(Boolean);
    const obj = {
      "snapshot-id": snapNum(s.seq),
      "parent-snapshot-id": s.parent ? snapNum(getSnap(state, s.parent)?.seq ?? 0) : null,
      "sequence-number": s.seq,
      "timestamp-ms": tsMs(s.seq),
      operation: s.op,
      summary: {
        operation: s.op,
        "total-data-files": rf.dfs.size,
        "total-delete-files": rf.xfs.size,
        "total-records": liveRows(state, s.id),
        "changed-partition-count": 1,
      },
      manifests,
    };
    const metaV = metaVForSnap(state, s.id);
    return {
      open: true,
      pillKind: "snapshot",
      pill: "AVRO",
      title: "manifest-list-" + s.id + ".avro",
      subtitle: "snapshot " + s.id + " · " + s.op,
      view: "json",
      caption:
        "A snapshot’s manifest list enumerates the manifests that make up the table at this commit (decoded from Avro to JSON here).",
      jsonText: JSON.stringify(obj, null, 2),
      summary: {
        facts: [
          { k: "operation", v: s.op },
          { k: "sequence", v: s.seq },
          { k: "data files", v: rf.dfs.size },
          { k: "delete files", v: rf.xfs.size },
          { k: "live rows", v: liveRows(state, s.id) },
        ],
        links: [
          ...s.manifests.map((mid) => {
            const m = state.manifests[mid];
            return {
              label: mid + ".avro",
              kind: (m && m.kind === "delete" ? "delete" : "manifest") as NodeKind,
              id: mid,
            };
          }),
          ...(s.parent ? [{ label: "parent " + s.parent, kind: "snapshot" as const, id: s.parent }] : []),
          ...(metaV != null
            ? [{ label: "v" + metaV + ".metadata.json", kind: "meta" as const, id: "v" + metaV }]
            : []),
        ],
      },
      deletedList: null,
    };
  }

  if (kind === "manifest") {
    const m = id ? state.manifests[id] : undefined;
    if (!m) return { open: false };
    const entries = m.files
      .map((f): ManifestEntry | null => {
        if (m.kind === "delete") {
          const df = state.deleteFiles[f];
          if (!df) return null;
          return {
            status: "ADDED",
            statusVariant: "added",
            content: "DELETES",
            contentVariant: "deletes",
            path: f + ".parquet",
            partition: "part=n/a",
            rows: df.deletedIds.length + " deletes",
            size: df.size + " MB",
            extra: "→ " + df.targets.join(", "),
          };
        }
        const dd = state.dataFiles[f];
        if (!dd) return null;
        const status = dd.born === m.seq ? "ADDED" : "EXISTING";
        return {
          status,
          statusVariant: status === "ADDED" ? "added" : "existing",
          content: "DATA",
          contentVariant: "data",
          path: f + ".parquet",
          partition: "part=" + dd.partition,
          rows: dd.records.length + " rows",
          size: dd.size + " MB",
          extra: "",
        };
      })
      .filter((e): e is ManifestEntry => e !== null);
    return {
      open: true,
      pillKind: m.kind === "delete" ? "delete" : "manifest",
      pill: "AVRO",
      title: m.id + ".avro",
      subtitle:
        (m.kind === "delete" ? "delete manifest" : "data manifest") +
        " · " +
        entries.length +
        " entr" +
        (entries.length === 1 ? "y" : "ies"),
      view: "entries",
      caption:
        "A manifest tracks a set of data (or delete) files, each tagged with a status and partition/stats used to prune reads.",
      entries,
    };
  }

  if (kind === "data") {
    const f = id ? state.dataFiles[id] : undefined;
    if (!f) return { open: false };
    const ids = f.records.map((r) => r.order_id);
    return {
      open: true,
      pillKind: "data",
      pill: "PARQUET",
      title: f.id + ".parquet",
      subtitle:
        f.records.length +
        " rows · " +
        f.size +
        " MB · part=" +
        f.partition +
        " · " +
        SPEC_DEFS[f.specId || 0].label +
        (f.compacted ? " · compacted" : ""),
      view: "grid",
      cols,
      rows: gridRows(f.records, null),
      caption:
        "Raw contents of this immutable data file. Deletes are never applied inside the file; they live in separate delete files and are merged at read time.",
      stats:
        "column stats · order_id min " +
        Math.min(...ids) +
        " max " +
        Math.max(...ids) +
        " · " +
        f.records.length +
        " records",
    };
  }

  if (kind === "delete") {
    const f = id ? state.deleteFiles[id] : undefined;
    if (!f) return { open: false };
    const recs = f.entries.map((e) => {
      const tgt = state.dataFiles[e.file];
      const pos = tgt ? tgt.records.findIndex((r) => r.order_id === e.order_id) : -1;
      return { file_path: "s3://warehouse/db/orders/data/" + e.file + ".parquet", pos };
    });
    const obj = {
      content: "POSITION_DELETES",
      "referenced-data-files": f.targets.map((t) => t + ".parquet"),
      "record-count": recs.length,
      records: recs,
    };
    return {
      open: true,
      pillKind: "delete",
      pill: "PARQUET",
      title: f.id + ".parquet",
      subtitle: "positional delete file → " + f.targets.join(", "),
      view: "json",
      caption:
        "A position-delete file lists (file, row-position) pairs to skip. Readers of the referenced data files drop these rows on the fly.",
      jsonText: JSON.stringify(obj, null, 2),
      summary: null,
      deletedList: f.deletedIds.join(", "),
    };
  }

  return { open: false };
}
