import type { TableState } from "../domain/types";
import { WhatHappened } from "./sidepanel/WhatHappened";
import "./sidepanel.css";

interface Props {
  state: TableState;
}

// NOTE: minimal side panel — stat cards, legend, and commit log are added next.
export function SidePanel({ state }: Props) {
  return (
    <aside className="sidepanel">
      <WhatHappened lastStep={state.lastStep} />
    </aside>
  );
}
