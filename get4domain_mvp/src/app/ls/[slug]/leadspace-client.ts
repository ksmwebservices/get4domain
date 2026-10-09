// Browser side helpers for a LeadSpace page. The page is a server component; only the form, the beacons and the report box run in the browser.
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://gapi.get4domain.com';

export type TrackKind = 'view' | 'cta' | 'form';

/** Fire and forget: a failed beacon must never get in the way of a visitor. */
export function track(slug: string, kind: TrackKind): void {
  try {
    const body = JSON.stringify({ slug, kind });
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(`${API_BASE}/leadspace/public/track`, new Blob([body], { type: 'application/json' }));
      return;
    }
    void fetch(`${API_BASE}/leadspace/public/track`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true });
  } catch {
    /* ignore */
  }
}

export async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as { message?: string; data?: T };
  if (!res.ok) throw new Error(json.message || 'Something went wrong. Please try again in a minute.');
  return json.data as T;
}

/** A stable id for this browser, used only to limit how many codes one device can ask for in an hour. */
export function deviceId(): string {
  try {
    const k = 'ls_device';
    let v = localStorage.getItem(k);
    if (!v) {
      v = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(k, v);
    }
    return v;
  } catch {
    return '';
  }
}

export function utmFromUrl(): Record<string, string> {
  try {
    const q = new URLSearchParams(window.location.search);
    const out: Record<string, string> = {};
    for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
      const v = q.get(k);
      if (v) out[k] = v.slice(0, 80);
    }
    return out;
  } catch {
    return {};
  }
}
