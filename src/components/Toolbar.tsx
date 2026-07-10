import type { Action } from "../domain/reducer";
import type { TableState } from "../domain/types";
import { ViewBadge } from "./toolbar/ViewBadge";
import "./toolbar.css";

interface Props {
  state: TableState;
  dispatch: (action: Action) => void;
}

// NOTE: minimal toolbar — the append stepper, query planner, and evolve control
// are added in a later step. This gets the graph interactive at the medium level.
export function Toolbar({ state, dispatch }: Props) {
  const showCompact = state.level !== "simple";
  const showExpire = state.level !== "simple";
  return (
    <div className="toolbar">
      <div className="toolbar__actions">
        <button type="button" className="action" onClick={() => dispatch({ type: "append" })}>
          Append {state.appendRows || 6} rows
        </button>
        <button type="button" className="action" onClick={() => dispatch({ type: "openDelete" })}>
          Delete rows
        </button>
        {showCompact ? (
          <button type="button" className="action" onClick={() => dispatch({ type: "compact" })}>
            Compact
          </button>
        ) : null}
        {showExpire ? (
          <button type="button" className="action" onClick={() => dispatch({ type: "expire" })}>
            Expire snapshots
          </button>
        ) : null}
      </div>
      <div className="toolbar__spacer" />
      <ViewBadge state={state} dispatch={dispatch} />
    </div>
  );
}
