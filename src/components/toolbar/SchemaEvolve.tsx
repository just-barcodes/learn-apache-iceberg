import type { Action } from "../../domain/reducer";
import { SCHEMA_DEFS } from "../../domain/schemas";
import type { TableState } from "../../domain/types";

/** Evolve the table schema (metadata-only), showing the currently-active schema version. */
export function SchemaEvolve({
  state,
  dispatch,
}: {
  state: TableState;
  dispatch: (action: Action) => void;
}) {
  const atLatest = (state.schemaId || 0) >= SCHEMA_DEFS.length - 1;
  const next = atLatest ? null : SCHEMA_DEFS[state.schemaId + 1];
  return (
    <button
      type="button"
      className="action action--evolve"
      onClick={() => dispatch({ type: "evolveSchema" })}
    >
      <span className="action__row">
        <span className="action__dot" />
        <span className="action__label">
          <span className="action__title">Evolve schema</span>
          <span className="action__desc">
            {next ? next.change.verb + " (metadata only)" : "change columns (metadata only)"}
          </span>
        </span>
      </span>
      <span className="spec-pill">
        <span className="spec-pill__tag">active</span>
        {atLatest ? "schema-v" + state.schemaId + " (latest)" : "schema-v" + state.schemaId}
      </span>
    </button>
  );
}
