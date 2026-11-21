'use client';

import { useEffect } from 'react';

const KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'kw'] as const;

/**
 * Reports a directory page opened with campaign tokens. Fire and forget: it runs after the page is shown, sends only the path and the tokens,
 * never blocks rendering and never reports an error. Nothing is sent when the address has no campaign token.
 */
export default function PageVisitBeacon() {
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const body: Record<string, string> = { path: window.location.pathname };
      let tokens = 0;
      for (const k of KEYS) {
        const v = q.get(k);
        if (v) { body[k] = v; tokens++; }
      }
      if (tokens === 0) return;
      void fetch('/directory-api/page-visit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).catch(() => undefined);
    } catch {
      // the beacon never affects the page
    }
  }, []);
  return null;
}
