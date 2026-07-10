import type { SpecDef } from "./types";

/** The partition specs the table can evolve through, in rotation order. */
export const SPEC_DEFS: SpecDef[] = [
  { label: "month(order_date)", field: "order_date", transform: "month", srcId: 4 },
  { label: "day(order_date)", field: "order_date", transform: "day", srcId: 4 },
  { label: "bucket(order_id, 4)", field: "order_id", transform: "bucket[4]", srcId: 1 },
];

/** The table's column schema, in display order. */
export const ORDER_COLS = [
  { key: "order_id", label: "order_id", align: "right", mono: true },
  { key: "customer", label: "customer", align: "left", mono: false },
  { key: "amount", label: "amount", align: "right", mono: true },
  { key: "order_date", label: "order_date", align: "left", mono: true },
  { key: "status", label: "status", align: "left", mono: false },
] as const;

/** Stable table UUID used across generated metadata. */
export const TABLE_UUID = "a3f9c1e2-7b44-4d18-9e5a-2c6f0b8d51aa";
