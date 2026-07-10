# Iceberg Explorer

An interactive visualization of what happens *inside* an Apache Iceberg table as
you run commits. Append, delete, compact, expire snapshots, evolve the partition
spec, and run a query planner, then watch how the metadata and data files rewire.
Click any node to inspect it; click a snapshot to time-travel.

Imported from the Claude Design project **Apache Iceberg Visualization Tool**.

## Run it

Any static file server works (opening over `http://` lets the CDN and web fonts
load):

```sh
python3 -m http.server 8000
# then open http://localhost:8000/index.html
```

## Files

- `index.html` — the app: a Design Composer component (`<x-dc>` template + a
  `DCLogic` class holding the whole Iceberg simulation).
- `support.js` — the Design Composer runtime. It loads React 18 from a CDN and
  mounts the component, replacing `<x-dc>` with the live React tree.
