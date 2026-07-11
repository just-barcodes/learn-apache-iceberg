import type { Action } from "../domain/reducer";
import type { TableState } from "../domain/types";
import { buildPicker } from "../viewmodel/picker";
import { Modal } from "./Modal";
import "./picker.css";

interface Props {
  state: TableState;
  dispatch: (action: Action) => void;
}

/** Modal for choosing rows to merge-on-read delete. */
export function DeletePicker({ state, dispatch }: Props) {
  const model = buildPicker(state);
  if (!model) return null;
  const cancel = () => dispatch({ type: "cancelPicker" });
  const canDelete = model.count > 0;

  // A leading checkbox, one grid track per schema column (mono/numeric sized to
  // content, text columns sharing the rest), then a fixed file column.
  const template = [
    "18px",
    ...model.cols.map((c) => (c.align === "right" ? "max-content" : "minmax(0, 1fr)")),
    "92px",
  ].join(" ");

  return (
    <Modal onClose={cancel} width={640}>
      <div className="modal-head">
        <span className="pill node--delete">DELETE</span>
        <div className="modal-head__titles">
          <div className="modal-head__title">Delete rows</div>
          <div className="modal-head__subtitle">
            Pick the rows to remove; a merge-on-read delete file will mark them
          </div>
        </div>
        <button type="button" className="modal-close" aria-label="Close" onClick={cancel}>
          ×
        </button>
      </div>

      <div className="picker__cols" style={{ gridTemplateColumns: template }}>
        <span className="picker__check-col" />
        {model.cols.map((c) => (
          <span key={c.label} className={"picker__cell picker__cell--" + c.align}>
            {c.label}
          </span>
        ))}
        <span className="picker__cell picker__cell--right">file</span>
      </div>

      <div className="picker__rows">
        {model.rows.map((r) => (
          <div
            key={r.oid}
            className={"picker__row" + (r.checked ? " is-checked" : "")}
            style={{ gridTemplateColumns: template }}
            onClick={() => dispatch({ type: "togglePick", oid: r.oid, file: r.file })}
          >
            <span className="picker__box">{r.checked ? "✓" : ""}</span>
            {r.cells.map((cell, i) => (
              <span
                key={i}
                className={
                  "picker__cell picker__cell--" + cell.align + (cell.mono ? " picker__mono" : "")
                }
              >
                {cell.value}
              </span>
            ))}
            <span className="picker__cell picker__cell--right picker__file">{r.file}.parquet</span>
          </div>
        ))}
      </div>

      <div className="picker__footer">
        <div className="picker__random">
          <button
            type="button"
            className="picker__random-btn"
            onClick={() => dispatch({ type: "randomPick" })}
          >
            Select random
          </button>
          <input
            type="text"
            inputMode="numeric"
            className="picker__random-input"
            value={model.randomN}
            aria-label="Random count"
            onChange={(e) => dispatch({ type: "setRandomN", value: e.target.value })}
          />
          <span className="picker__of">of {model.liveCount}</span>
        </div>
        <span className="picker__count">
          <b>{model.count}</b> selected
        </span>
        <div className="picker__spacer" />
        <button type="button" className="picker__cancel" onClick={cancel}>
          Cancel
        </button>
        <button
          type="button"
          className={"picker__confirm" + (canDelete ? " is-enabled" : "")}
          disabled={!canDelete}
          onClick={() => dispatch({ type: "confirmDelete" })}
        >
          {canDelete ? `Delete ${model.count} row${model.count === 1 ? "" : "s"}` : "Select rows"}
        </button>
      </div>
    </Modal>
  );
}
