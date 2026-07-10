import { liveRows } from "../domain/selectors";
import type { NodeKind, Operation, TableState } from "../domain/types";

/** CSS variable holding the accent color for each operation (cards, logs, explainer). */
export const ACCENT_VAR: Record<Operation, string> = {
  append: "var(--data-line)",
  delete: "var(--delete-line)",
  compaction: "var(--manifest-line)",
  expire: "var(--accent-gray)",
  evolve: "var(--meta-line)",
};

export interface StatCard {
  value: number;
  label: string;
  colorVar: string;
}

/** The seven headline counts shown in the side panel's stat grid. */
export function buildStats(state: TableState): StatCard[] {
  return [
    { value: Object.keys(state.dataFiles).length, label: "data files on disk", colorVar: "var(--data-line)" },
    { value: liveRows(state, state.current), label: "live rows (current)", colorVar: "var(--snapshot-line)" },
    { value: state.snapshots.length, label: "snapshots", colorVar: "var(--snapshot-line)" },
    { value: Object.keys(state.deleteFiles).length, label: "delete files", colorVar: "var(--delete-line)" },
    { value: Object.keys(state.manifests).length, label: "manifests", colorVar: "var(--manifest-line)" },
    { value: state.metas.length, label: "metadata versions", colorVar: "var(--meta-line)" },
    { value: state.specs.length, label: "partition specs", colorVar: "var(--meta-line)" },
  ];
}

export interface LegendEntry {
  kind: NodeKind;
  name: string;
  desc: string;
}

/** Static legend for the five entity kinds. */
export const LEGEND: LegendEntry[] = [
  { kind: "meta", name: "Metadata", desc: "schema, snapshot list, pointer" },
  { kind: "snapshot", name: "Snapshot", desc: "point-in-time file set" },
  { kind: "manifest", name: "Manifest", desc: "avro list of files" },
  { kind: "data", name: "Data file", desc: "parquet rows" },
  { kind: "delete", name: "Delete file", desc: "merge-on-read deletes" },
];
