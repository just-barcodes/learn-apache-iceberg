import type { Action } from "../domain/reducer";
import type { TableState } from "../domain/types";
import {
  buildInspector,
  type GridColumn,
  type GridRow,
  type ManifestEntry,
  type Summary,
} from "../viewmodel/inspector";
import { Modal, ModalHeader } from "./Modal";
import "./inspector.css";

interface Props {
  state: TableState;
  dispatch: (action: Action) => void;
}

/** The node inspector modal. Renders one of three body layouts by node kind. */
export function Inspector({ state, dispatch }: Props) {
  const m = buildInspector(state);
  if (!m.open) return null;
  const close = () => dispatch({ type: "closeInspect" });

  return (
    <Modal onClose={close} width={640}>
      <ModalHeader pillKind={m.pillKind} pill={m.pill} title={m.title} subtitle={m.subtitle} mono onClose={close} />
      <div className="modal-body">
        {m.view === "grid" ? <GridView caption={m.caption} cols={m.cols} rows={m.rows} stats={m.stats} /> : null}
        {m.view === "entries" ? (
          <EntriesView
            caption={m.caption}
            entries={m.entries}
            summary={m.summary}
            dispatch={dispatch}
          />
        ) : null}
        {m.view === "json" ? (
          <JsonView
            caption={m.caption}
            jsonText={m.jsonText}
            summary={m.summary}
            deletedList={m.deletedList}
            dispatch={dispatch}
          />
        ) : null}
      </div>
    </Modal>
  );
}

function GridView({
  caption,
  cols,
  rows,
  stats,
}: {
  caption: string;
  cols: GridColumn[];
  rows: GridRow[];
  stats: string | null;
}) {
  return (
    <>
      <div className="inspector-caption">{caption}</div>
      <div className="grid-wrap">
        <table className="grid">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.label} className={`grid__th grid__th--${c.align}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={r.deleted ? "grid__row--deleted" : undefined}>
                {r.cells.map((cell, j) => (
                  <td
                    key={j}
                    className={[
                      "grid__td",
                      `grid__td--${cell.align}`,
                      cell.mono && "grid__td--mono",
                      r.deleted && "grid__td--struck",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {cell.value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {stats ? <div className="inspector-stats">{stats}</div> : null}
    </>
  );
}

/** The shared "At a glance" facts + jump-to links block, used by the json and entries views. */
function SummarySection({
  summary,
  dispatch,
}: {
  summary: Summary | null;
  dispatch: (action: Action) => void;
}) {
  if (!summary) return null;
  return (
    <>
      <div className="inspector-section">At a glance</div>
      <div className="facts">
        {summary.facts.map((f) => (
          <div key={f.k} className="fact">
            <div className="fact__k">{f.k}</div>
            <div className="fact__v">{f.v}</div>
          </div>
        ))}
      </div>
      {summary.links.length > 0 ? (
        <div className="jump-links">
          <span className="jump-links__label">Jump to</span>
          {summary.links.map((l, i) => (
            <button
              key={i}
              type="button"
              className={`jump-link node--${l.kind}`}
              onClick={() => dispatch({ type: "openInspect", kind: l.kind, id: l.id })}
            >
              {l.label} <span className="jump-link__arrow">→</span>
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}

function EntriesView({
  caption,
  entries,
  summary,
  dispatch,
}: {
  caption: string;
  entries: ManifestEntry[];
  summary: Summary | null;
  dispatch: (action: Action) => void;
}) {
  return (
    <>
      <SummarySection summary={summary} dispatch={dispatch} />
      {summary ? <div className="inspector-section">Files</div> : null}
      <div className="inspector-caption">{caption}</div>
      <div className="entries">
        {entries.map((e, i) => (
          <div key={i} className="entry">
            <div className="entry__head">
              <span className={`entry__status entry__status--${e.statusVariant}`}>{e.status}</span>
              <span className={`entry__content entry__content--${e.contentVariant}`}>{e.content}</span>
              <span className="entry__path">{e.path}</span>
            </div>
            <div className="entry__meta">
              <span>{e.partition}</span>
              <span>{e.rows}</span>
              <span>{e.size}</span>
              {e.extra ? <span className="entry__extra">{e.extra}</span> : null}
            </div>
            {e.bounds ? <div className="entry__stats">{e.bounds}</div> : null}
          </div>
        ))}
      </div>
    </>
  );
}

function JsonView({
  caption,
  jsonText,
  summary,
  deletedList,
  dispatch,
}: {
  caption: string;
  jsonText: string;
  summary: Summary | null;
  deletedList: string | null;
  dispatch: (action: Action) => void;
}) {
  return (
    <>
      <SummarySection summary={summary} dispatch={dispatch} />
      {summary ? <div className="inspector-section">Raw file</div> : null}
      <div className="inspector-caption">{caption}</div>
      <pre className="json">{jsonText}</pre>
      {deletedList ? (
        <div className="inspector-deleted">
          Removes order_id → <span className="inspector-deleted__ids">{deletedList}</span>
        </div>
      ) : null}
    </>
  );
}
