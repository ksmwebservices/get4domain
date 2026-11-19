import { hostNotRewritten, normalizeHost, readHostConfig, type HostConfig } from './hostnames';

/**
 * One server log line when a request is NOT sent to a vendor site: the host (a public name), its class and a short reason code. Nothing else: no path, no query, no cookie, no address of a person.
 * The same host and reason is logged once per ten minutes per server process, so a busy portal host does not fill the log. A host that is not a valid name is logged as "invalid".
 */
const WINDOW_MS = 10 * 60_000;
const MAX_KEYS = 500;
const seen = new Map<string, number>();

export function hostNotRewrittenLine(host: string, hostClass: string, reason: string): string {
  return JSON.stringify({ evt: 'host_not_rewritten', host, class: hostClass, reason });
}

/** Logs (throttled) when the host is not a vendor host. Returns the line it wrote, or null (a vendor host, or already logged recently). */
export function logHostNotRewritten(rawHost: string | null | undefined, cfg: HostConfig = readHostConfig(), now: number = Date.now()): string | null {
  const why = hostNotRewritten(rawHost, cfg);
  if (!why) return null;
  const host = normalizeHost(rawHost) || 'invalid';
  const key = `${host}|${why.reason}`;
  const at = seen.get(key);
  if (at !== undefined && now - at < WINDOW_MS) return null;
  if (seen.size >= MAX_KEYS) seen.clear();
  seen.set(key, now);
  const line = hostNotRewrittenLine(host, why.hostClass, why.reason);
  console.warn(line);
  return line;
}

/** Forget what was logged (tests). */
export function resetHostLog(): void { seen.clear(); }
