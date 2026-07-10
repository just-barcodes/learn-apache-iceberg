// Deterministic, human-friendly identifiers derived from a snapshot's sequence number.
// Keeping these pure makes generated metadata JSON reproducible in tests.

/** A wall-clock "HH:MM" label that advances 7 minutes per commit. */
export function clock(seq: number): string {
  const t = 600 + seq * 7;
  const h = Math.floor(t / 60) % 24;
  const m = t % 60;
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}

/** A stable, large snapshot-id number as it would appear in Iceberg metadata. */
export function snapNum(seq: number): number {
  return 100000000 + seq * 7654321;
}

/** A stable epoch-millis timestamp for a commit. */
export function tsMs(seq: number): number {
  return 1704067200000 + seq * 420000;
}
