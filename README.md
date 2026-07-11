# Iceberg Explorer

An interactive visualization of what happens _inside_ an Apache Iceberg table as
you run commits. Append, delete (merge-on-read), compact, expire snapshots,
evolve the partition spec, evolve the schema, and run a query planner, then watch
how the metadata and data files rewire. Click any node to inspect it; click a
snapshot to time-travel. Supports light and dark mode.

**Live demo:** https://just-barcodes.github.io/learn-apache-iceberg/

Reimplemented from scratch (React + TypeScript + Vite) from the Claude Design
project **Apache Iceberg Visualization Tool**.

## Detail levels

A header control tiers the interface by how much of the Iceberg model it reveals,
so each level teaches one layer:

- **Simple** — the core mental model: Catalog → Snapshot → Data files, with just
  Append/Delete and the essential counts. The metadata/manifest layers, raw
  files, and plumbing notes are hidden.
- **Medium** — reveals how the pointer is stored: the metadata and manifest
  columns, Compact/Expire, and more panel detail.
- **Advanced** — the physical/optimization layer: the query planner, partition
  evolution, schema evolution (add/rename/drop/widen columns, resolved by stable
  field id), per-column min/max stats, and raw metadata/Avro JSON.

## Getting started

```sh
npm install
npm run dev          # http://localhost:5173
```

```sh
npm run build        # type-check + production bundle in dist/
npm run preview      # serve the production build
npm test             # unit tests (Vitest)
npm run test:e2e     # end-to-end smoke tests (Playwright)
npm run typecheck    # tsc, no emit
```

Everything is bundled locally (React and the IBM Plex fonts are self-hosted), so
the app runs fully offline.

## How it is structured

The code separates a pure, framework-free **domain core** from the React
**presentation**, so the Iceberg simulation is understandable and unit-testable
on its own.

```
src/
  domain/       Pure Iceberg model — no React, no DOM
    types.ts          The TableState shape and its parts
    records.ts        Deterministic order-record generation
    ids.ts, specs.ts  Stable ids/timestamps and partition specs
    schemas.ts        Schema versions + field-id resolution rules
    initialState.ts   The table's starting point (snapshot s1)
    selectors.ts      Derived reads: referenced files, deleted set, live rows
    stats.ts          Per-column min/max bounds, computed at write time
    query.ts          Query-planner file pruning (reads stored bounds)
    operations.ts     Each commit as a pure state transition
    reducer.ts        Action union → operations
  viewmodel/    Pure state → view data (no JSX)
    graph.ts          Node cards + connector edges
    panels.ts         Stat cards, legend, operation accents
    inspector.ts      Inspector contents per node kind
    picker.ts         Delete-picker rows
  state/        useTableModel — useReducer wrapper
  theme/        Token-based light/dark theming + useTheme + toggle
  components/   Header, Toolbar, graph/, sidepanel/, Inspector, DeletePicker
  styles/       Layout and base CSS
```

### Domain model

A `TableState` holds the `metas`, `snapshots`, `manifests`, `dataFiles`, and
`deleteFiles` that make up the table, plus the current/selected snapshot and UI
state. Every commit (`append`, `confirmDelete`, `compact`, `expire`, `evolve`,
`evolveSchema`) is a pure function `TableState → TableState`, dispatched through a reducer. The
UI is a pure projection of this state.

### Theming

All colors are CSS custom properties in [`src/theme/tokens.css`](./src/theme/tokens.css).
Dark mode follows the OS by default (a pre-JS media-query fallback) and is
pinned by a header toggle that writes `data-theme` and persists to
`localStorage`. SVG connectors re-resolve their token colors when the theme
changes.
