import { describe, expect, it } from "vitest";
import { initialState } from "./initialState";
import { reducer, type Action } from "./reducer";
import { liveRows } from "./selectors";
import type { TableState } from "./types";

/** Apply a sequence of actions from the initial state. */
function run(...actions: Action[]): TableState {
  return actions.reduce(reducer, initialState());
}

describe("append", () => {
  it("commits a new snapshot and advances current + metadata", () => {
    const s = run({ type: "append" });
    expect(s.current).toBe("s2");
    expect(s.selected).toBe("s2");
    expect(s.snapshots).toHaveLength(2);
    expect(s.metas.map((m) => m.v)).toEqual([1, 2, 3]);
  });

  it("adds the appended rows to the live count and reuses parent manifests", () => {
    const s = run({ type: "append" }); // default appendRows = 6
    expect(liveRows(s, "s2")).toBe(12);
    expect(Object.keys(s.dataFiles)).toEqual(["d1", "d2", "d3"]);
    // s2 keeps the parent's manifest (m1) and adds the new one (m2).
    expect(s.snapshots[1].manifests).toEqual(["m1", "m2"]);
  });
});

describe("merge-on-read delete", () => {
  it("opens the picker when there are live rows", () => {
    const s = reducer(initialState(), { type: "openDelete" });
    expect(s.picker).toEqual({ selected: {}, n: 3 });
  });

  it("writes a delete file and drops the row from the live count", () => {
    const s = run(
      { type: "openDelete" },
      { type: "togglePick", oid: 1001, file: "d1" },
      { type: "confirmDelete" },
    );
    expect(s.current).toBe("s2");
    expect(Object.keys(s.deleteFiles)).toEqual(["x1"]);
    expect(s.deleteFiles.x1.deletedIds).toEqual([1001]);
    expect(liveRows(s, "s2")).toBe(5);
    expect(s.picker).toBeNull();
  });

  it("does nothing on confirm with no rows picked", () => {
    const opened = reducer(initialState(), { type: "openDelete" });
    expect(reducer(opened, { type: "confirmDelete" })).toBe(opened);
  });
});

describe("compaction", () => {
  it("merges the two data files into one and preserves live rows", () => {
    const s = reducer(initialState(), { type: "compact" });
    expect(s.current).toBe("s2");
    expect(s.snapshots[1].op).toBe("compaction");
    expect(s.dataFiles.d3.compacted).toBe(true);
    expect(liveRows(s, "s2")).toBe(6);
    // The compacted snapshot points at a fresh single manifest.
    expect(s.snapshots[1].manifests).toEqual(["m2"]);
  });

  it("is a no-op explainer when there is nothing to compact", () => {
    // A single compacted snapshot has one data file → nothing to merge.
    const once = reducer(initialState(), { type: "compact" });
    const twice = reducer(once, { type: "compact" });
    expect(twice.snapshots).toHaveLength(2);
    expect(twice.lastStep.title).toBe("Nothing worth compacting");
  });
});

describe("expire snapshots", () => {
  it("keeps only the current snapshot and garbage-collects unreachable files", () => {
    // compact makes s2 reference only d3, orphaning d1/d2.
    const s = run({ type: "compact" }, { type: "expire" });
    expect(s.snapshots).toHaveLength(1);
    expect(s.snapshots[0].id).toBe("s2");
    expect(Object.keys(s.dataFiles)).toEqual(["d3"]);
    expect(s.metas).toHaveLength(1);
  });

  it("explains when there is only one snapshot", () => {
    const s = reducer(initialState(), { type: "expire" });
    expect(s.snapshots).toHaveLength(1);
    expect(s.lastStep.title).toBe("Nothing to expire");
  });
});

describe("partition evolution", () => {
  it("rotates the spec via metadata only, without a new snapshot", () => {
    const s = reducer(initialState(), { type: "evolve" });
    expect(s.specId).toBe(1);
    expect(s.specs).toEqual([0, 1]);
    expect(s.snapshots).toHaveLength(1); // no new snapshot
    expect(s.current).toBe("s1"); // pointer unchanged
    expect(s.metas).toHaveLength(3); // metadata bumped
  });
});

describe("time travel", () => {
  it("selectSnap changes the viewed snapshot but not current", () => {
    const s = run({ type: "append" }, { type: "selectSnap", id: "s1" });
    expect(s.selected).toBe("s1");
    expect(s.current).toBe("s2");
  });

  it("jumpCurrent returns to the latest snapshot", () => {
    const s = run(
      { type: "append" },
      { type: "selectSnap", id: "s1" },
      { type: "jumpCurrent" },
    );
    expect(s.selected).toBe("s2");
  });
});

describe("query planner field + detail level", () => {
  it("activates only after a value is entered and Run is pressed", () => {
    const typed = reducer(initialState(), { type: "setQueryVal", value: "1003" });
    expect(typed.qActive).toBe(false);
    const ran = reducer(typed, { type: "runQuery" });
    expect(ran.qActive).toBe(true);
    expect(reducer(ran, { type: "clearQuery" }).qActive).toBe(false);
  });

  it("leaving the advanced level clears an active query", () => {
    const active = run(
      { type: "setLevel", level: "advanced" },
      { type: "setQueryVal", value: "1003" },
      { type: "runQuery" },
    );
    expect(active.qActive).toBe(true);
    const simple = reducer(active, { type: "setLevel", level: "simple" });
    expect(simple.qActive).toBe(false);
  });
});

describe("reset", () => {
  it("restores the initial table but keeps the chosen detail level", () => {
    const s = run(
      { type: "setLevel", level: "advanced" },
      { type: "append" },
      { type: "reset" },
    );
    expect(s.current).toBe("s1");
    expect(s.snapshots).toHaveLength(1);
    expect(s.level).toBe("advanced");
  });
});
