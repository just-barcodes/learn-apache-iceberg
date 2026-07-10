import { LEGEND } from "../../viewmodel/panels";

/** Colour key for the five entity kinds plus the time-travel current pointer. */
export function Legend() {
  return (
    <div className="panel-card">
      <div className="panel-card__head">Legend</div>
      <div className="legend">
        {LEGEND.map((l) => (
          <div key={l.kind} className="legend__row">
            <span className={`legend__swatch node--${l.kind}`} />
            <span className="legend__text">
              <b>{l.name}</b>: {l.desc}
            </span>
          </div>
        ))}
        <div className="legend__row">
          <span className="legend__swatch legend__swatch--pointer" />
          <span className="legend__text">
            <b>Current pointer</b>: while time-travelling
          </span>
        </div>
      </div>
    </div>
  );
}
