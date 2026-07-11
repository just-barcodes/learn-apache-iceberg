import { describe, expect, it } from "vitest";
import { initialState } from "../domain/initialState";
import { reducer, type Action } from "../domain/reducer";
import type { TableState } from "../domain/types";
import { buildInspector } from "./inspector";

function run(...actions: Action[]): TableState {
  return actions.reduce(reducer, { ...initialState(), level: "advanced" });
}

/** Narrow the inspector model to the grid view, failing loudly otherwise. */
function gridOf(state: TableState) {
  const m = buildInspector(state);
  if (!m.open || m.view !== "grid") throw new Error("expected an open grid view");
  return m;
}

describe("schema evolution projection in the inspector", () => {
  it("backfills an added column as null for files that predate the schema", () => {
    // Add `region` (schema 1), then inspect the original file written under schema 0.
    const s = run({ type: "evolveSchema" }, { type: "openInspect", kind: "data", id: "d1" });
    const grid = gridOf(s);
    const regionIdx = grid.cols.findIndex((c) => c.label === "region");
    expect(regionIdx).toBeGreaterThan(-1);
    expect(grid.rows.every((r) => r.cells[regionIdx].value === "null")).toBe(true);
    expect(grid.subtitle).toContain("schema-v0");
  });

  it("populates the added column for files written under the new schema", () => {
    const s = run(
      { type: "evolveSchema" },
      { type: "append" },
      { type: "openInspect", kind: "data", id: "d3" },
    );
    const grid = gridOf(s);
    const regionIdx = grid.cols.findIndex((c) => c.label === "region");
    expect(grid.rows.every((r) => r.cells[regionIdx].value !== "null")).toBe(true);
  });

  it("relabels a renamed column but keeps the underlying value (field id is stable)", () => {
    // schema 2 renames customer -> customer_name; d1 predates it but still shows its value.
    const s = run(
      { type: "evolveSchema" },
      { type: "evolveSchema" },
      { type: "openInspect", kind: "data", id: "d1" },
    );
    const grid = gridOf(s);
    expect(grid.cols.some((c) => c.label === "customer_name")).toBe(true);
    expect(grid.cols.some((c) => c.label === "customer")).toBe(false);
    const idx = grid.cols.findIndex((c) => c.label === "customer_name");
    // First row (order_id 1001) was generated as customer "Oscorp".
    expect(grid.rows[0].cells[idx].value).toBe("Oscorp");
  });

  it("drops a column from the projection once the schema removes it", () => {
    // schema 3 drops status.
    const s = run(
      { type: "evolveSchema" },
      { type: "evolveSchema" },
      { type: "evolveSchema" },
      { type: "openInspect", kind: "data", id: "d1" },
    );
    const grid = gridOf(s);
    expect(grid.cols.some((c) => c.label === "status")).toBe(false);
  });
});
