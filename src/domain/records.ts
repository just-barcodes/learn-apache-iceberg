import type { OrderRecord } from "./types";

const CUSTOMERS = [
  "Stark Industries",
  "Oscorp",
  "Roxxon Energy",
  "Pym Technologies",
  "Alchemax",
  "Hammer Ind.",
  "Rand Enterprises",
  "Baxter Foundation",
];

const STATUSES = ["paid", "pending", "shipped", "refunded"];

const REGIONS = ["EMEA", "AMER", "APAC", "LATAM"];

/** A mutable order-id counter threaded through record generation. */
export interface OrderIdCounter {
  oid: number;
}

export interface GenOptions {
  month: string;
  /** Force a specific day-of-month (used by the `day(order_date)` spec). */
  day?: number;
  /** Only emit rows whose id falls in this bucket (used by the `bucket(order_id, 4)` spec). */
  bucket?: number;
}

/**
 * Deterministically generate `n` order records. Values are derived purely from the
 * order id, so the table is reproducible. Mutates `ctr.oid`. When `opts.bucket` is set,
 * ids outside the bucket are skipped, so a guard bounds the search.
 */
export function genRecords(n: number, opts: GenOptions, ctr: OrderIdCounter): OrderRecord[] {
  const out: OrderRecord[] = [];
  let made = 0;
  let guard = 0;
  while (made < n && guard < n * 8 + 50) {
    guard++;
    ctr.oid++;
    const id = ctr.oid;
    if (opts.bucket != null && id % 4 !== opts.bucket) continue;
    const day = opts.day != null ? opts.day : 1 + (id % 27);
    out.push({
      order_id: id,
      customer: CUSTOMERS[id % CUSTOMERS.length],
      amount: "CHF " + (((id * 37) % 900) + 60) + "." + String((id * 7) % 100).padStart(2, "0"),
      order_date: opts.month + "-" + String(day).padStart(2, "0"),
      status: STATUSES[id % STATUSES.length],
      region: REGIONS[id % REGIONS.length],
    });
    made++;
  }
  return out;
}
