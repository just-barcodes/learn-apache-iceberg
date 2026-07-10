import { describe, expect, it } from "vitest";
import { initialState } from "./initialState";
import { amt, computeBounds } from "./stats";

describe("amt", () => {
  it("strips currency formatting to a number", () => {
    expect(amt("CHF 197.07")).toBe(197.07);
    expect(amt("nonsense")).toBe(0);
  });
});

describe("computeBounds", () => {
  it("records per-column lower/upper bounds", () => {
    const records = [
      {
        order_id: 1001,
        customer: "a",
        amount: "CHF 197.07",
        order_date: "2026-01-03",
        status: "paid",
      },
      {
        order_id: 1003,
        customer: "b",
        amount: "CHF 271.21",
        order_date: "2026-01-05",
        status: "paid",
      },
    ];
    expect(computeBounds(records)).toEqual({
      lower: { order_id: 1001, amount: 197.07, order_date: "2026-01-03" },
      upper: { order_id: 1003, amount: 271.21, order_date: "2026-01-05" },
    });
  });

  it("returns neutral bounds for an empty file", () => {
    expect(computeBounds([])).toEqual({
      lower: { order_id: 0, amount: 0, order_date: "" },
      upper: { order_id: 0, amount: 0, order_date: "" },
    });
  });
});

describe("stored bounds on the initial table", () => {
  it("are written onto each data file", () => {
    const s = initialState();
    expect(s.dataFiles.d1.bounds.lower.order_id).toBe(1001);
    expect(s.dataFiles.d1.bounds.upper.order_id).toBe(1003);
    expect(s.dataFiles.d2.bounds.lower.order_id).toBe(1004);
    expect(s.dataFiles.d2.bounds.upper.order_id).toBe(1006);
  });
});
