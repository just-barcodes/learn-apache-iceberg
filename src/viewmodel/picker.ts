import { deletedSetFor, getSnap, referencedFiles } from "../domain/selectors";
import { fieldInSchema, SCHEMA_DEFS } from "../domain/schemas";
import type { TableState } from "../domain/types";

type Align = "left" | "right";

export interface PickerCell {
  value: string;
  align: Align;
  mono: boolean;
}
export interface PickerColumn {
  label: string;
  align: Align;
}
export interface PickerRow {
  oid: number;
  file: string;
  checked: boolean;
  cells: PickerCell[];
}

export interface PickerModel {
  cols: PickerColumn[];
  rows: PickerRow[];
  liveCount: number;
  count: number;
  randomN: number | "";
}

/**
 * The live rows offered in the delete picker, projected through the table's current
 * schema (like the inspector grids): columns follow the active schema, and rows from
 * files written under an older schema resolve by field id — added columns read null.
 */
export function buildPicker(state: TableState): PickerModel | null {
  if (!state.picker) return null;
  const cur = getSnap(state, state.current);
  const { dfs } = referencedFiles(state, cur);
  const del = deletedSetFor(state, cur);
  const fields = SCHEMA_DEFS[state.schemaId].fields;
  const raw: { oid: number; file: string; cells: PickerCell[] }[] = [];
  dfs.forEach((fid) => {
    const df = state.dataFiles[fid];
    if (!df) return;
    for (const r of df.records) {
      if (del.has(r.order_id)) continue;
      raw.push({
        oid: r.order_id,
        file: fid,
        cells: fields.map((f) => ({
          value: fieldInSchema(f.id, df.schemaId) ? String(r[f.key]) : "null",
          align: f.align,
          mono: f.mono,
        })),
      });
    }
  });
  raw.sort((a, b) => a.oid - b.oid);
  const sel = state.picker.selected;
  return {
    cols: fields.map((f) => ({ label: f.name, align: f.align })),
    rows: raw.map((r) => ({ ...r, checked: !!sel[r.oid] })),
    liveCount: raw.length,
    count: Object.keys(sel).length,
    randomN: state.picker.n === "" ? "" : state.picker.n || 3,
  };
}
