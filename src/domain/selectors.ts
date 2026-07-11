import type { OrderRecord, Snapshot, TableState } from "./types";

/** Files reachable from a snapshot, split by kind. */
export interface ReferencedFiles {
  /** Manifest ids referenced by the snapshot. */
  mans: Set<string>;
  /** Data-file ids. */
  dfs: Set<string>;
  /** Delete-file ids. */
  xfs: Set<string>;
}

export function getSnap(state: TableState, id: string | null): Snapshot | null {
  return state.snapshots.find((s) => s.id === id) ?? null;
}

/** Walk a snapshot's manifests to collect the data and delete files it points at. */
export function referencedFiles(state: TableState, snap: Snapshot | null): ReferencedFiles {
  const mans = new Set<string>();
  const dfs = new Set<string>();
  const xfs = new Set<string>();
  if (snap) {
    for (const mid of snap.manifests) {
      mans.add(mid);
      const m = state.manifests[mid];
      if (!m) continue;
      for (const f of m.files) {
        if (m.kind === "delete") xfs.add(f);
        else dfs.add(f);
      }
    }
  }
  return { mans, dfs, xfs };
}

/** The set of order ids removed by merge-on-read delete files reachable from a snapshot. */
export function deletedSetFor(state: TableState, snap: Snapshot | null): Set<number> {
  const set = new Set<number>();
  if (snap) {
    for (const mid of snap.manifests) {
      const m = state.manifests[mid];
      if (!m || m.kind !== "delete") continue;
      for (const f of m.files) {
        for (const oid of state.deleteFiles[f]?.deletedIds ?? []) set.add(oid);
      }
    }
  }
  return set;
}

/** Materialize a snapshot: records from its data files, partitioned into live vs deleted. */
export function liveRecords(
  state: TableState,
  snapId: string,
): { live: OrderRecord[]; deleted: OrderRecord[] } {
  const snap = getSnap(state, snapId);
  const { dfs } = referencedFiles(state, snap);
  const del = deletedSetFor(state, snap);
  const live: OrderRecord[] = [];
  const deleted: OrderRecord[] = [];
  dfs.forEach((id) => {
    for (const r of state.dataFiles[id]?.records ?? []) {
      (del.has(r.order_id) ? deleted : live).push(r);
    }
  });
  return { live, deleted };
}

export function liveRows(state: TableState, snapId: string): number {
  return liveRecords(state, snapId).live.length;
}

/** A materialized row tagged with the schema version of the data file it came from. */
export interface TaggedRecord {
  rec: OrderRecord;
  schemaId: number;
}

/** Like liveRecords, but keeps each row's source-file schema for field-id resolution. */
export function liveRecordsTagged(
  state: TableState,
  snapId: string,
): { live: TaggedRecord[]; deleted: TaggedRecord[] } {
  const snap = getSnap(state, snapId);
  const { dfs } = referencedFiles(state, snap);
  const del = deletedSetFor(state, snap);
  const live: TaggedRecord[] = [];
  const deleted: TaggedRecord[] = [];
  dfs.forEach((id) => {
    const df = state.dataFiles[id];
    if (!df) return;
    for (const r of df.records) {
      const tagged = { rec: r, schemaId: df.schemaId };
      (del.has(r.order_id) ? deleted : live).push(tagged);
    }
  });
  return { live, deleted };
}

/** The highest metadata version whose current-snapshot pointer is this snapshot. */
export function metaVForSnap(state: TableState, snapId: string | null): number | undefined {
  const ms = state.metas.filter((m) => m.snapshot === snapId);
  return ms.length ? Math.max(...ms.map((m) => m.v)) : undefined;
}
