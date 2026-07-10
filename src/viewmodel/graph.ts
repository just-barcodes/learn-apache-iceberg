import { prunedSet } from "../domain/query";
import type { Action } from "../domain/reducer";
import { getSnap, metaVForSnap, referencedFiles } from "../domain/selectors";
import type { NodeKind, TableState } from "../domain/types";

/** A single card in the graph. Pure data — styling is entirely CSS. */
export interface GraphNodeVM {
  /** Stable ref id used to anchor connector lines, e.g. "df-d1", "snap-s1". */
  id: string;
  kind: NodeKind;
  pill: string;
  name: string;
  sub?: string | null;
  note?: string | null;
  /** Right-aligned metadata (used by data files: "6 rows · 4 MB"). */
  meta?: string | null;
  tag?: string | null;
  /** "kind" tints the tag with the node color; "neutral" is the muted pruned tag. */
  tagVariant?: "kind" | "neutral";
  /** Green "click again for details" affordance on the selected snapshot. */
  hint?: string | null;
  inactive?: boolean;
  pruned?: boolean;
  scanned?: boolean;
  current?: boolean;
  action: Action;
}

export interface GraphModel {
  tableNode: GraphNodeVM;
  metaNodes: GraphNodeVM[];
  snapNodes: GraphNodeVM[];
  manifestNodes: GraphNodeVM[];
  fileNodes: GraphNodeVM[];
  counts: { meta: number; snap: number; manifest: number; file: number };
}

const byIdNumeric = (a: { id: string }, b: { id: string }) =>
  a.id.localeCompare(b.id, undefined, { numeric: true });

/** Build every graph card from the current state and the selected snapshot's reachability. */
export function buildGraph(state: TableState): GraphModel {
  const sel = getSnap(state, state.selected);
  const ref = referencedFiles(state, sel);
  const selMetaV = metaVForSnap(state, state.selected);
  const curMetaV = metaVForSnap(state, state.current);
  const maxV = Math.max(...state.metas.map((m) => m.v));
  const prunedIds = prunedSet(state);
  // Simple drops the tertiary mono "plumbing" notes (file paths / pointers) on cards.
  const simple = state.level === "simple";

  const tableNode: GraphNodeVM = {
    id: "table",
    kind: "table",
    pill: "TABLE",
    tag: "preview",
    name: "orders",
    sub: "iceberg table",
    note: simple ? null : "catalog → current metadata",
    action: { type: "openInspect", kind: "table", id: null },
  };

  const metaNodes: GraphNodeVM[] = state.metas.map((m) => ({
    id: "meta-v" + m.v,
    kind: "meta",
    pill: "META",
    name: "v" + m.v + ".metadata.json",
    sub: m.snapshot ? "current-snapshot → " + m.snapshot : "no snapshots yet",
    tag: m.v === maxV ? "CURRENT" : null,
    inactive: !(m.v === selMetaV || m.v === curMetaV),
    action: { type: "openInspect", kind: "meta", id: "v" + m.v },
  }));

  const snapNodes: GraphNodeVM[] = state.snapshots.map((s) => {
    const isSel = s.id === state.selected;
    const current = s.id === state.current;
    return {
      id: "snap-" + s.id,
      kind: "snapshot",
      pill: "SNAP",
      name: s.id,
      sub: s.op + " · " + s.ts,
      note: simple ? null : "manifest-list-" + s.id + ".avro",
      tag: current ? "CURRENT" : "seq " + s.seq,
      // Keep the hint while the selected snapshot's inspector is open so the card
      // does not resize when the modal opens.
      hint: isSel ? "click again for details" : null,
      inactive: !(isSel || current),
      current,
      action: isSel
        ? { type: "openInspect", kind: "snapshot", id: s.id }
        : { type: "selectSnap", id: s.id },
    };
  });

  const manifestNodes: GraphNodeVM[] = Object.values(state.manifests)
    .sort((a, b) => a.seq - b.seq || a.id.localeCompare(b.id))
    .map((m) => {
      const kind: NodeKind = m.kind === "delete" ? "delete" : "manifest";
      return {
        id: "mf-" + m.id,
        kind,
        pill: "AVRO",
        name: m.id + ".avro",
        sub: m.kind === "delete" ? "delete manifest" : "data manifest",
        tag: m.files.length + " entr" + (m.files.length === 1 ? "y" : "ies"),
        inactive: !ref.mans.has(m.id),
        action: { type: "openInspect", kind: "manifest", id: m.id },
      };
    });

  const fileNodes: GraphNodeVM[] = [];
  Object.values(state.dataFiles)
    .sort(byIdNumeric)
    .forEach((f) => {
      const active = ref.dfs.has(f.id);
      const pruned = !!(prunedIds && prunedIds.has(f.id));
      fileNodes.push({
        id: "df-" + f.id,
        kind: "data",
        pill: "PARQUET",
        name: f.id + ".parquet",
        meta: f.records.length + " rows · " + f.size + " MB",
        tag: pruned ? "pruned ✕" : "part=" + f.partition,
        tagVariant: pruned ? "neutral" : "kind",
        inactive: !active,
        pruned,
        scanned: !!(prunedIds && active && !pruned),
        action: { type: "openInspect", kind: "data", id: f.id },
      });
    });
  Object.values(state.deleteFiles)
    .sort(byIdNumeric)
    .forEach((f) => {
      fileNodes.push({
        id: "xf-" + f.id,
        kind: "delete",
        pill: "DELETE",
        name: f.id + ".parquet",
        sub: "deletes " + f.deletedIds.length + " rows",
        note: simple ? null : "→ " + f.targets.join(", "),
        tag: "MoR",
        inactive: !ref.xfs.has(f.id),
        action: { type: "openInspect", kind: "delete", id: f.id },
      });
    });

  return {
    tableNode,
    metaNodes,
    snapNodes,
    manifestNodes,
    fileNodes,
    counts: {
      meta: state.metas.length,
      snap: state.snapshots.length,
      manifest: Object.keys(state.manifests).length,
      file: Object.keys(state.dataFiles).length + Object.keys(state.deleteFiles).length,
    },
  };
}

/** A connector between two node cards. `colorVar` names the CSS token for its stroke. */
export interface Edge {
  from: string;
  to: string;
  colorVar: string;
  faint?: boolean;
  dash?: boolean;
}

const LINE_VAR: Record<NodeKind, string> = {
  table: "--table-line",
  meta: "--meta-line",
  snapshot: "--snapshot-line",
  manifest: "--manifest-line",
  data: "--data-line",
  delete: "--delete-line",
};

/** Edges wiring catalog → metadata → snapshot → manifests → files for the selected snapshot. */
export function computeEdges(state: TableState): Edge[] {
  const sel = getSnap(state, state.selected);
  if (!sel) return [];
  const edges: Edge[] = [];

  // Simple hides the metadata + manifest columns, so wire catalog → snapshot → files
  // directly for the "a snapshot points at a set of files" mental model.
  if (state.level === "simple") {
    edges.push({ from: "table", to: "snap-" + state.selected, colorVar: LINE_VAR.snapshot });
    for (const mid of sel.manifests) {
      const m = state.manifests[mid];
      if (!m) continue;
      const colorVar = m.kind === "delete" ? LINE_VAR.delete : LINE_VAR.data;
      for (const f of m.files) {
        edges.push({ from: "snap-" + state.selected, to: (m.kind === "delete" ? "xf-" : "df-") + f, colorVar });
      }
    }
    if (state.current !== state.selected) {
      edges.push({ from: "table", to: "snap-" + state.current, colorVar: LINE_VAR.snapshot, dash: true });
    }
    return edges;
  }

  const pruned = prunedSet(state);
  const selMeta = metaVForSnap(state, state.selected);
  if (selMeta != null) {
    edges.push({ from: "table", to: "meta-v" + selMeta, colorVar: LINE_VAR.meta });
    edges.push({ from: "meta-v" + selMeta, to: "snap-" + state.selected, colorVar: LINE_VAR.snapshot });
  }
  for (const mid of sel.manifests) {
    const m = state.manifests[mid];
    if (!m) continue;
    // snapshot → manifest takes the manifest's own color; manifest → file takes the file's.
    const manifestColor = m.kind === "delete" ? LINE_VAR.delete : LINE_VAR.manifest;
    const fileColor = m.kind === "delete" ? LINE_VAR.delete : LINE_VAR.data;
    edges.push({ from: "snap-" + state.selected, to: "mf-" + mid, colorVar: manifestColor });
    for (const f of m.files) {
      const faint = !!(pruned && m.kind !== "delete" && pruned.has(f));
      edges.push({
        from: "mf-" + mid,
        to: (m.kind === "delete" ? "xf-" : "df-") + f,
        colorVar: fileColor,
        faint,
      });
    }
  }
  if (state.current !== state.selected) {
    const cm = metaVForSnap(state, state.current);
    if (cm != null) {
      edges.push({
        from: "meta-v" + cm,
        to: "snap-" + state.current,
        colorVar: LINE_VAR.snapshot,
        dash: true,
      });
    }
  }
  return edges;
}
