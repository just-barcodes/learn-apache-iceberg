import * as ops from "./operations";
import type { DetailLevel, NodeKind, QueryColumn, QueryOp, TableState } from "./types";

/** Every way the table state can change, as a discriminated union. */
export type Action =
  | { type: "append" }
  | { type: "openDelete" }
  | { type: "togglePick"; oid: number; file: string }
  | { type: "setRandomN"; value: string }
  | { type: "randomPick" }
  | { type: "cancelPicker" }
  | { type: "confirmDelete" }
  | { type: "compact" }
  | { type: "expire" }
  | { type: "evolve" }
  | { type: "reset" }
  | { type: "setLevel"; level: DetailLevel }
  | { type: "jumpCurrent" }
  | { type: "selectSnap"; id: string }
  | { type: "openInspect"; kind: NodeKind; id: string | null }
  | { type: "closeInspect" }
  | { type: "rowsInc" }
  | { type: "rowsDec" }
  | { type: "rowsInput"; value: string }
  | { type: "setQueryCol"; col: QueryColumn }
  | { type: "setQueryOp"; op: QueryOp }
  | { type: "setQueryVal"; value: string }
  | { type: "runQuery" }
  | { type: "clearQuery" };

export function reducer(state: TableState, action: Action): TableState {
  switch (action.type) {
    case "append":
      return ops.append(state);
    case "openDelete":
      return ops.openDelete(state);
    case "togglePick":
      return ops.togglePick(state, action.oid, action.file);
    case "setRandomN":
      return ops.setRandomN(state, action.value);
    case "randomPick":
      return ops.randomPick(state);
    case "cancelPicker":
      return ops.cancelPicker(state);
    case "confirmDelete":
      return ops.confirmDelete(state);
    case "compact":
      return ops.compact(state);
    case "expire":
      return ops.expire(state);
    case "evolve":
      return ops.evolve(state);
    case "reset":
      return ops.reset(state);
    case "setLevel":
      return ops.setLevel(state, action.level);
    case "jumpCurrent":
      return ops.jumpCurrent(state);
    case "selectSnap":
      return ops.selectSnap(state, action.id);
    case "openInspect":
      return ops.openInspect(state, action.kind, action.id);
    case "closeInspect":
      return ops.closeInspect(state);
    case "rowsInc":
      return ops.rowsInc(state);
    case "rowsDec":
      return ops.rowsDec(state);
    case "rowsInput":
      return ops.rowsInput(state, action.value);
    case "setQueryCol":
      return ops.setQueryCol(state, action.col);
    case "setQueryOp":
      return ops.setQueryOp(state, action.op);
    case "setQueryVal":
      return ops.setQueryVal(state, action.value);
    case "runQuery":
      return ops.runQuery(state);
    case "clearQuery":
      return ops.clearQuery(state);
  }
}
