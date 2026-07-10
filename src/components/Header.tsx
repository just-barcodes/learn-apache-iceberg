import type { Action } from "../domain/reducer";
import type { DetailLevel, TableState } from "../domain/types";
import { ThemeToggle } from "../theme/ThemeToggle";
import type { ResolvedTheme } from "../theme/useTheme";
import "./header.css";

interface Props {
  state: TableState;
  dispatch: (action: Action) => void;
  resolved: ResolvedTheme;
  onToggleTheme: () => void;
}

const LEVELS: { key: DetailLevel; label: string }[] = [
  { key: "simple", label: "Simple" },
  { key: "medium", label: "Medium" },
  { key: "advanced", label: "Advanced" },
];

export function Header({ state, dispatch, resolved, onToggleTheme }: Props) {
  return (
    <header className="header">
      <div className="header__logo">
        <IcebergMark />
      </div>
      <div className="header__titles">
        <h1 className="header__title">Inside an Apache Iceberg Table</h1>
        <p className="header__subtitle">
          Run commits and watch how metadata and data files rewire. Click any node to inspect it;
          click a snapshot to time-travel.
        </p>
      </div>
      <div className="header__spacer" />
      <div className="header__level">
        <span className="header__level-label">Detail level</span>
        <div className="segmented" role="group" aria-label="Detail level">
          {LEVELS.map((lv) => (
            <button
              key={lv.key}
              type="button"
              className={"segmented__btn" + (state.level === lv.key ? " is-active" : "")}
              aria-pressed={state.level === lv.key}
              onClick={() => dispatch({ type: "setLevel", level: lv.key })}
            >
              {lv.label}
            </button>
          ))}
        </div>
      </div>
      <button type="button" className="btn-ghost" onClick={() => dispatch({ type: "reset" })}>
        Reset table
      </button>
      <ThemeToggle resolved={resolved} onToggle={onToggleTheme} />
    </header>
  );
}

function IcebergMark() {
  return (
    <svg width="34" height="34" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" fill="#dcebf8" />
      <rect y="13.5" width="32" height="18.5" fill="#b6d3ec" />
      <path d="M16 3.5 L21.5 13.5 L10.5 13.5 Z" fill="#ffffff" />
      <path d="M10.5 13.5 H21.5 L25 22 L18.5 29.5 L10 28.5 L6 20 Z" fill="#eef6ff" opacity="0.7" />
      <line x1="0" y1="13.5" x2="32" y2="13.5" stroke="#4f86bd" strokeWidth="1.3" />
    </svg>
  );
}
