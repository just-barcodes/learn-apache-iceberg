import type { Action } from "../domain/reducer";
import type { TableState } from "../domain/types";
import { ActionButton } from "./toolbar/ActionButton";
import { AppendControl } from "./toolbar/AppendControl";
import { PartitionEvolve } from "./toolbar/PartitionEvolve";
import { QueryPlanner } from "./toolbar/QueryPlanner";
import { SchemaEvolve } from "./toolbar/SchemaEvolve";
import { ViewBadge } from "./toolbar/ViewBadge";
import "./toolbar.css";

interface Props {
  state: TableState;
  dispatch: (action: Action) => void;
}

export function Toolbar({ state, dispatch }: Props) {
  const { level } = state;
  const showCompact = level !== "simple";
  const showExpire = level !== "simple";
  const showAdvanced = level === "advanced";

  return (
    <div className="toolbar">
      <div className="toolbar__actions">
        <AppendControl state={state} dispatch={dispatch} />
        <ActionButton
          accent="var(--delete-line)"
          title="Delete rows"
          desc="merge-on-read → delete file"
          onClick={() => dispatch({ type: "openDelete" })}
        />
        {showCompact ? (
          <ActionButton
            accent="var(--manifest-line)"
            title="Compact"
            desc="rewrite small files → one"
            onClick={() => dispatch({ type: "compact" })}
          />
        ) : null}
        {showExpire ? (
          <ActionButton
            accent="var(--accent-gray)"
            title="Expire snapshots"
            desc="drop history → GC old files"
            onClick={() => dispatch({ type: "expire" })}
          />
        ) : null}
        {showAdvanced ? <PartitionEvolve state={state} dispatch={dispatch} /> : null}
        {showAdvanced ? <SchemaEvolve state={state} dispatch={dispatch} /> : null}
        {showAdvanced ? <QueryPlanner state={state} dispatch={dispatch} /> : null}
      </div>
      <div className="toolbar__spacer" />
      <ViewBadge state={state} dispatch={dispatch} />
    </div>
  );
}
