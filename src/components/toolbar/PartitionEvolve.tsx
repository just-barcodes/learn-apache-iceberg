import type { Action } from "../../domain/reducer";
import { SPEC_DEFS } from "../../domain/specs";
import type { TableState } from "../../domain/types";

interface Props {
  state: TableState;
  dispatch: (action: Action) => void;
}

/** Evolve the partition spec (metadata-only), showing the currently-active spec. */
export function PartitionEvolve({ state, dispatch }: Props) {
  const currentSpec = SPEC_DEFS[state.specId || 0].label;
  return (
    <button type="button" className="action action--evolve" onClick={() => dispatch({ type: "evolve" })}>
      <span className="action__row">
        <span className="action__dot" />
        <span className="action__label">
          <span className="action__title">Evolve partition</span>
          <span className="action__desc">change spec (metadata only)</span>
        </span>
      </span>
      <span className="spec-pill">
        <span className="spec-pill__tag">active</span>
        {currentSpec}
      </span>
    </button>
  );
}
