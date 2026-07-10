import { describe, expect, it } from "vitest";
import { initialState } from "./initialState";

describe("initialState", () => {
  it("starts at snapshot s1, metadata v2, viewing current", () => {
    const s = initialState();
    expect(s.current).toBe("s1");
    expect(s.selected).toBe("s1");
    expect(s.snapshots).toHaveLength(1);
    expect(s.metas.map((m) => m.v)).toEqual([1, 2]);
  });

  it("holds two data files of three rows each, listed by one manifest", () => {
    const s = initialState();
    expect(Object.keys(s.dataFiles)).toEqual(["d1", "d2"]);
    expect(s.dataFiles.d1.records).toHaveLength(3);
    expect(s.dataFiles.d2.records).toHaveLength(3);
    expect(s.manifests.m1.files).toEqual(["d1", "d2"]);
  });

  it("has no delete files and one partition spec", () => {
    const s = initialState();
    expect(s.deleteFiles).toEqual({});
    expect(s.specs).toEqual([0]);
    expect(s.counters.oid).toBe(1006);
  });

  it("returns a fresh object each call (no shared mutable state)", () => {
    const a = initialState();
    const b = initialState();
    a.dataFiles.d1.records.push({
      order_id: 9,
      customer: "x",
      amount: "CHF 1.00",
      order_date: "2026-01-01",
      status: "paid",
    });
    expect(b.dataFiles.d1.records).toHaveLength(3);
  });
});
