// Pure domain model for a simulated Apache Iceberg table. No React, no DOM.

/** The operations a commit can represent. `evolve` writes metadata only. */
export type Operation = "append" | "delete" | "compaction" | "expire" | "evolve";

/**
 * A single row in the `orders` table. `amount` is a display string like "CHF 197.07".
 * The record carries the superset of every column any schema version ever defines;
 * which of them are visible (and under what name) is decided by the active schema
 * when the row is projected (see schemas.ts).
 */
export interface OrderRecord {
  order_id: number;
  customer: string;
  amount: string;
  order_date: string;
  status: string;
  region: string;
}

/** The queryable columns and their comparison operators used by the query planner. */
export type QueryColumn = "order_id" | "amount" | "order_date";
export type QueryOp = "=" | ">" | ">=" | "<" | "<=";

/**
 * Per-column lower/upper bounds, as Apache Iceberg persists in each data_file
 * entry of a manifest. Computed once at write time and read by the query planner
 * to prune files without opening them.
 */
export interface DataFileBounds {
  lower: { order_id: number; amount: number; order_date: string };
  upper: { order_id: number; amount: number; order_date: string };
}

/** An immutable Parquet data file. `born` is the snapshot seq that first wrote it. */
export interface DataFile {
  id: string;
  records: OrderRecord[];
  size: number;
  partition: string;
  specId: number;
  /** The schema version this file was written under (see schemas.ts). */
  schemaId: number;
  born: number;
  /** Column stats recorded when the file was written (see DataFileBounds). */
  bounds: DataFileBounds;
  compacted?: boolean;
}

/** One (row, target-file) pair recorded by a merge-on-read delete file. */
export interface DeleteEntry {
  order_id: number;
  file: string;
}

/** A merge-on-read (positional) delete file. */
export interface DeleteFile {
  id: string;
  entries: DeleteEntry[];
  deletedIds: number[];
  targets: string[];
  size: number;
  born: number;
}

/** An Avro manifest listing either data files or delete files. */
export interface Manifest {
  id: string;
  kind: "data" | "delete";
  files: string[];
  op: Operation;
  seq: number;
}

/** An immutable pointer to the exact set of files that make up the table at a commit. */
export interface Snapshot {
  id: string;
  seq: number;
  op: Operation;
  ts: string;
  parent: string | null;
  manifests: string[];
  /** The schema version that was current when this snapshot was committed. */
  schemaId: number;
}

/** A root metadata version: schema, partition spec, and current-snapshot pointer. */
export interface MetaVersion {
  v: number;
  snapshot: string | null;
  specId: number;
  /** The current-schema-id this metadata version records. */
  schemaId: number;
}

/** A partition-spec definition available to the table. */
export interface SpecDef {
  label: string;
  field: string;
  transform: string;
  srcId: number;
}

/** The active query-planner filter. `val` is empty until the user types one. */
export interface Query {
  col: QueryColumn;
  op: QueryOp;
  val: string;
}

/** Open state for the delete-picker modal. `n` is the "select random N" count. */
export interface Picker {
  /** Map of order_id -> data-file id for the currently-checked rows. */
  selected: Record<number, string>;
  n: number | "";
}

/** The "What just happened" explainer produced by every operation. */
export interface LastStep {
  op: Operation;
  title: string;
  body: string;
  bullets: string[];
}

/** One line in the commit log. `n` is the snapshot seq the entry belongs to. */
export interface LogEntry {
  n: number;
  op: Operation;
  text: string;
}

/** Monotonic counters that back generated file/snapshot/metadata ids. */
export interface Counters {
  d: number;
  x: number;
  m: number;
  s: number;
  v: number;
  oid: number;
}

export type DetailLevel = "simple" | "medium" | "advanced";

/** Which node the inspector modal is showing. */
export type NodeKind = "table" | "meta" | "snapshot" | "manifest" | "data" | "delete";

export interface Inspect {
  kind: NodeKind;
  id: string | null;
}

/** The complete table state. Everything the UI renders is derived from this. */
export interface TableState {
  metas: MetaVersion[];
  snapshots: Snapshot[];
  manifests: Record<string, Manifest>;
  dataFiles: Record<string, DataFile>;
  deleteFiles: Record<string, DeleteFile>;
  /** The latest committed snapshot. */
  current: string;
  /** The snapshot currently being viewed (differs from `current` while time-travelling). */
  selected: string;
  inspect: Inspect | null;
  picker: Picker | null;
  appendRows: number | "";
  /** Partition-spec ids the table has ever used. */
  specs: number[];
  /** The currently-active partition-spec id. */
  specId: number;
  /** Schema-version ids the table has ever used. */
  schemas: number[];
  /** The currently-active schema-version id. */
  schemaId: number;
  q: Query;
  qActive: boolean;
  level: DetailLevel;
  counters: Counters;
  log: LogEntry[];
  lastStep: LastStep;
}
