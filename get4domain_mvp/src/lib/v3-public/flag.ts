/**
 * The V3 public site switch. Pure (no framework import) so it can be tested without Next.
 * Both values are read at call time from the server environment, so staging can flip them without a rebuild.
 */
type Env = Record<string, string | undefined>;

/** Off unless the value is exactly "true". Off means every new public route answers 404 and nothing existing changes. */
export function isV3PublicEnabled(env: Env = process.env): boolean {
  return (env.V3_PUBLIC_ENABLED ?? '').trim().toLowerCase() === 'true';
}

/** On unless the value is exactly "false": the typed client then returns fixtures and never touches the network. */
export function useMocks(env: Env = process.env): boolean {
  return (env.V3_PUBLIC_USE_MOCKS ?? 'true').trim().toLowerCase() !== 'false';
}
