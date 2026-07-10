import type { DataFileBounds, OrderRecord } from "./types";

/** Parse a display amount like "CHF 197.07" into a number. */
export function amt(v: string): number {
  return parseFloat(String(v).replace(/[^\d.]/g, "")) || 0;
}

/**
 * Compute the per-column lower/upper bounds for a data file's records. In Iceberg
 * this happens at write time and the result is stored in the manifest; here it is
 * called when a DataFile is created so the planner can prune from stored stats.
 */
export function computeBounds(records: OrderRecord[]): DataFileBounds {
  if (records.length === 0) {
    return {
      lower: { order_id: 0, amount: 0, order_date: "" },
      upper: { order_id: 0, amount: 0, order_date: "" },
    };
  }
  const ids = records.map((r) => r.order_id);
  const am = records.map((r) => amt(r.amount));
  const dt = records.map((r) => r.order_date);
  return {
    lower: {
      order_id: Math.min(...ids),
      amount: Math.min(...am),
      order_date: dt.reduce((a, b) => (a < b ? a : b), dt[0]),
    },
    upper: {
      order_id: Math.max(...ids),
      amount: Math.max(...am),
      order_date: dt.reduce((a, b) => (a > b ? a : b), dt[0]),
    },
  };
}
