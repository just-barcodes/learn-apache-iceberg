import { atLeast } from "../domain/levels";
import { liveRows } from "../domain/selectors";
import type { DetailLevel, NodeKind, Operation, TableState } from "../domain/types";

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

interface StatDef extends StatCard {
  /** Lowest detail level at which this card is shown. */
  min: DetailLevel;
}

/**
 * The headline counts for the side panel's stat grid, filtered by detail level:
 * the core counts show everywhere; internal-structure counts (manifests, metadata
 * versions) appear at medium, and partition specs only at advanced.
 */
export function buildStats(state: TableState): StatCard[] {
  const defs: StatDef[] = [
    {
      value: Object.keys(state.dataFiles).length,
      label: "data files on disk",
      colorVar: "var(--data-line)",
      min: "simple",
    },
    {
      value: liveRows(state, state.current),
      label: "live rows (current)",
      colorVar: "var(--snapshot-line)",
      min: "simple",
    },
    {
      value: state.snapshots.length,
      label: "snapshots",
      colorVar: "var(--snapshot-line)",
      min: "simple",
    },
    {
      value: Object.keys(state.deleteFiles).length,
      label: "delete files",
      colorVar: "var(--delete-line)",
      min: "simple",
    },
    {
      value: Object.keys(state.manifests).length,
      label: "manifests",
      colorVar: "var(--manifest-line)",
      min: "medium",
    },
    {
      value: state.metas.length,
      label: "metadata versions",
      colorVar: "var(--meta-line)",
      min: "medium",
    },
    {
      value: state.specs.length,
      label: "partition specs",
      colorVar: "var(--meta-line)",
      min: "advanced",
    },
    {
      value: state.schemas.length,
      label: "schema versions",
      colorVar: "var(--meta-line)",
      min: "advanced",
    },
  ];
  return defs.filter((d) => atLeast(state.level, d.min)).map(({ min, ...card }) => card);
}

export interface LegendEntry {
  kind: NodeKind;
  name: string;
  desc: string;
}

interface LegendDef extends LegendEntry {
  /** Lowest detail level at which this entry's concept is on screen. */
  min: DetailLevel;
}

const LEGEND_DEFS: LegendDef[] = [
  { kind: "meta", name: "Metadata", desc: "schema, snapshot list, pointer", min: "medium" },
  { kind: "snapshot", name: "Snapshot", desc: "point-in-time file set", min: "simple" },
  { kind: "manifest", name: "Manifest", desc: "avro list of files", min: "medium" },
  { kind: "data", name: "Data file", desc: "parquet rows", min: "simple" },
  { kind: "delete", name: "Delete file", desc: "merge-on-read deletes", min: "simple" },
];

/** Legend entries for the concepts actually visible at the given detail level. */
export function legendFor(level: DetailLevel): LegendEntry[] {
  return LEGEND_DEFS.filter((l) => atLeast(level, l.min)).map(({ min, ...entry }) => entry);
}
