type Step = (() => Promise<unknown>) | null | undefined;

/** Runs every cleanup step in order, even when one throws, then rethrows the FIRST failure. For afterAll in the staging suites (B2.0). */
export async function runCleanup(steps: Step[]): Promise<void> {
  let first: unknown; let failed = false;
  for (const s of steps) {
    if (!s) continue;
    try { await s(); } catch (e) { if (!failed) { failed = true; first = e; } }
  }
  if (failed) throw first;
}
