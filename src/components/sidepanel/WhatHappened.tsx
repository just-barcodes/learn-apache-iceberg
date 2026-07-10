import type { LastStep, Operation } from "../../domain/types";

/** CSS variable holding the accent color for each operation. */
const ACCENT_VAR: Record<Operation, string> = {
  append: "var(--data-line)",
  delete: "var(--delete-line)",
  compaction: "var(--manifest-line)",
  expire: "var(--accent-gray)",
  evolve: "var(--meta-line)",
};

interface Props {
  lastStep: LastStep;
}

/** The "What just happened" explainer card that narrates the most recent commit. */
export function WhatHappened({ lastStep }: Props) {
  const accent = ACCENT_VAR[lastStep.op];
  return (
    <div className="whathappened" style={{ ["--accent" as string]: accent }}>
      <div className="whathappened__eyebrow">
        <span className="whathappened__dot" />
        <span>What just happened</span>
      </div>
      <div className="whathappened__title">{lastStep.title}</div>
      <div className="whathappened__body">{lastStep.body}</div>
      {lastStep.bullets.length > 0 ? (
        <ul className="whathappened__bullets">
          {lastStep.bullets.map((b, i) => (
            <li key={i}>
              <span className="whathappened__bullet-mark">·</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
