import { fetchPageModel } from './api';
import { directoryHomeHref } from './host-routing';
import { directoryCandidate } from './routes';
import { S } from './strings';

/**
 * The directory gate: the one place that decides, before any page renders, whether a directory address exists.
 * Why here: the live root loading.tsx sends a page's HTTP status before the page runs, so a page cannot answer 404 or 410 itself.
 * The middleware asks the directory API (the same call the page makes) and answers the real status; only an address that exists is rewritten to the page.
 * It never looks at a live route (LIVE_SEGMENTS) and does nothing at all while the flag is off.
 */
export type GateResult = { kind: 'pass' } | { kind: 'rewrite'; path: string } | { kind: 'status'; status: 404 | 410 | 503 };

interface Memo { at: number; result: GateResult }
const memo = new Map<string, Memo>();
const MAX = 500;
const TTL_OK_MS = 30_000;
const TTL_ERROR_MS = 3_000;

export async function gateDirectory(pathname: string, now: () => number = Date.now): Promise<GateResult> {
  const path = directoryCandidate(pathname);
  if (!path) return { kind: 'pass' };
  const key = path.toLowerCase();
  const hit = memo.get(key);
  if (hit && now() - hit.at < (hit.result.kind === 'status' && hit.result.status === 503 ? TTL_ERROR_MS : TTL_OK_MS)) return hit.result;
  const r = await fetchPageModel(path);
  const result: GateResult =
    r.kind === 'ok' ? { kind: 'rewrite', path }
    : r.kind === 'notFound' ? { kind: 'status', status: 404 }
    : r.kind === 'gone' ? { kind: 'status', status: 410 }
    : { kind: 'status', status: 503 };
  if (memo.size >= MAX) { const first = memo.keys().next(); if (!first.done) memo.delete(first.value); }
  memo.set(key, { at: now(), result });
  return result;
}

/** A small page for a status the gate answers: noindex in the header and in the page, a way back to the directory. */
export function gateBody(status: 404 | 410 | 503): string {
  const t = status === 404 ? S.notFound : status === 410 ? S.gone : { title: S.error.title, body: S.error.body };
  return `<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>${t.title} | ${S.brand}</title></head><body style="font-family:system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:0 1rem"><main><h1>${t.title}</h1><p>${t.body}</p><p><a href="${directoryHomeHref()}">${S.empty.browse}</a></p></main></body></html>`;
}

export function resetGateMemo(): void { memo.clear(); }
