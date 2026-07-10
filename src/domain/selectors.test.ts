import { describe, expect, it } from "vitest";
import { initialState } from "./initialState";
import {
  deletedSetFor,
  getSnap,
  liveRecords,
  liveRows,
  metaVForSnap,
  referencedFiles,
} from "./selectors";

describe("selectors on the initial state", () => {
  const s = initialState();
  const s1 = getSnap(s, "s1");

  it("resolves snapshots by id", () => {
    expect(s1?.id).toBe("s1");
    expect(getSnap(s, "nope")).toBeNull();
  });

  it("collects files reachable from a snapshot", () => {
    const ref = referencedFiles(s, s1);
    expect([...ref.mans]).toEqual(["m1"]);
    expect([...ref.dfs].sort()).toEqual(["d1", "d2"]);
    expect([...ref.xfs]).toEqual([]);
  });

  it("has no deletes initially", () => {
    expect(deletedSetFor(s, s1).size).toBe(0);
  });

  it("materializes six live rows and no deleted rows", () => {
    const { live, deleted } = liveRecords(s, "s1");
    expect(live).toHaveLength(6);
    expect(deleted).toHaveLength(0);
    expect(liveRows(s, "s1")).toBe(6);
  });

  it("maps snapshots (and the null pre-snapshot) to metadata versions", () => {
    expect(metaVForSnap(s, "s1")).toBe(2);
    expect(metaVForSnap(s, null)).toBe(1);
    expect(metaVForSnap(s, "missing")).toBeUndefined();
  });
});
