import type { OrderRecord } from "./types";

/** One column in a schema version. `id` is the Iceberg field id: stable, never reused. */
export interface SchemaField {
  id: number;
  /** Display/column name. Changes on a rename; the id stays put. */
  name: string;
  /** Iceberg type string, e.g. "long" or "decimal(10,2)". */
  type: string;
  required: boolean;
  /** Which OrderRecord property backs this field (unchanged by a rename). */
  key: keyof OrderRecord;
  align: "left" | "right";
  mono: boolean;
}

/** What changed relative to the previous schema version, for logs and the explainer. */
export interface SchemaChange {
  kind: "create" | "add" | "rename" | "drop" | "widen";
  /** Present-tense phrasing of the pending change, for the toolbar button. */
  verb: string;
  /** Past-tense phrasing of the applied change, for the commit log and explainer. */
  text: string;
}

/** A schema version: its columns, the high-water field id, and how it got here. */
export interface SchemaDef {
  fields: SchemaField[];
  /** last-column-id: the highest field id ever assigned (grows, never shrinks). */
  lastColumnId: number;
  change: SchemaChange;
}

// Field builders. Field ids are fixed; only name/type may vary across versions.
const orderId = (): SchemaField => ({
  id: 1,
  name: "order_id",
  type: "long",
  required: true,
  key: "order_id",
  align: "right",
  mono: true,
});
const customer = (name = "customer"): SchemaField => ({
  id: 2,
  name,
  type: "string",
  required: false,
  key: "customer",
  align: "left",
  mono: false,
});
const amount = (type = "decimal(10,2)"): SchemaField => ({
  id: 3,
  name: "amount",
  type,
  required: false,
  key: "amount",
  align: "right",
  mono: true,
});
const orderDate = (): SchemaField => ({
  id: 4,
  name: "order_date",
  type: "string",
  required: false,
  key: "order_date",
  align: "left",
  mono: true,
});
const status = (): SchemaField => ({
  id: 5,
  name: "status",
  type: "string",
  required: false,
  key: "status",
  align: "left",
  mono: false,
});
const region = (): SchemaField => ({
  id: 6,
  name: "region",
  type: "string",
  required: false,
  key: "region",
  align: "left",
  mono: false,
});

/**
 * The schema versions the table evolves through, one metadata-only change each.
 * Progression is linear (not a rotation like partition specs), because re-adding a
 * dropped column would have to reuse a retired field id — which Iceberg never does.
 */
export const SCHEMA_DEFS: SchemaDef[] = [
  {
    change: {
      kind: "create",
      verb: "create the initial schema",
      text: "initial schema (5 columns)",
    },
    lastColumnId: 5,
    fields: [orderId(), customer(), amount(), orderDate(), status()],
  },
  {
    change: {
      kind: "add",
      verb: "add a region column",
      text: "added column region (string, field-id 6)",
    },
    lastColumnId: 6,
    fields: [orderId(), customer(), amount(), orderDate(), status(), region()],
  },
  {
    change: {
      kind: "rename",
      verb: "rename customer → customer_name",
      text: "renamed customer → customer_name (field-id 2 unchanged)",
    },
    lastColumnId: 6,
    fields: [orderId(), customer("customer_name"), amount(), orderDate(), status(), region()],
  },
  {
    change: {
      kind: "drop",
      verb: "drop the status column",
      text: "dropped column status (field-id 5 retired, never reused)",
    },
    lastColumnId: 6,
    fields: [orderId(), customer("customer_name"), amount(), orderDate(), region()],
  },
  {
    change: {
      kind: "widen",
      verb: "widen amount → decimal(12,2)",
      text: "widened amount decimal(10,2) → decimal(12,2) (field-id 3 unchanged)",
    },
    lastColumnId: 6,
    fields: [orderId(), customer("customer_name"), amount("decimal(12,2)"), orderDate(), region()],
  },
];

/** True if field `id` already existed in the schema version a file was written under. */
export function fieldInSchema(id: number, schemaId: number): boolean {
  return SCHEMA_DEFS[schemaId]?.fields.some((f) => f.id === id) ?? false;
}
