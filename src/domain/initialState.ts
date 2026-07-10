import { clock } from "./ids";
import { genRecords, type OrderIdCounter } from "./records";
import type { TableState } from "./types";

/**
 * The table's starting point: one append commit (snapshot s1) holding two data
 * files, referenced by one data manifest, with metadata at version 2.
 */
export function initialState(): TableState {
  const ctr: OrderIdCounter = { oid: 1000 };
  const d1 = genRecords(3, { month: "2026-01" }, ctr);
  const d2 = genRecords(3, { month: "2026-01" }, ctr);
  return {
    metas: [
      { v: 1, snapshot: null, specId: 0 },
      { v: 2, snapshot: "s1", specId: 0 },
    ],
    snapshots: [{ id: "s1", seq: 1, op: "append", ts: clock(1), parent: null, manifests: ["m1"] }],
    manifests: { m1: { id: "m1", kind: "data", files: ["d1", "d2"], op: "append", seq: 1 } },
    dataFiles: {
      d1: { id: "d1", records: d1, size: 4, partition: "2026-01", specId: 0, born: 1 },
      d2: { id: "d2", records: d2, size: 4, partition: "2026-01", specId: 0, born: 1 },
    },
    deleteFiles: {},
    current: "s1",
    selected: "s1",
    inspect: null,
    picker: null,
    appendRows: 6,
    specs: [0],
    specId: 0,
    q: { col: "amount", op: ">=", val: "" },
    qActive: false,
    level: "medium",
    counters: { d: 2, x: 0, m: 1, s: 1, v: 2, oid: ctr.oid },
    log: [
      {
        n: 1,
        op: "append",
        text: "Created table + appended 2 data files (d1, d2) → snapshot s1, metadata v2.",
      },
    ],
    lastStep: {
      op: "append",
      title: "Table created at snapshot s1",
      body: "The table starts with one append commit. A snapshot is an immutable pointer to the exact set of files that make up the table at a point in time.",
      bullets: [
        "2 data files on disk (d1, d2)",
        "1 data manifest m1.avro lists them",
        "metadata v2 sets current-snapshot → s1",
      ],
    },
  };
}
