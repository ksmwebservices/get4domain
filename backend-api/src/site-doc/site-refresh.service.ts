import { Injectable, Logger } from '@nestjs/common';

/**
 * After a publish the public pages of that vendor must show the change within seconds. Public pages are cached (fast), so Publish asks the frontend
 * to drop that vendor's cached data. If the frontend cannot be reached the change is still published; the cache then expires on its own within a minute.
 *   FRONTEND_INTERNAL_URL   e.g. http://get4domain_frontend:3006   (the frontend as the backend container sees it)
 *   REVALIDATE_SECRET       the same long random string in the frontend container
 */
@Injectable()
export class SiteRefreshService {
  private readonly log = new Logger(SiteRefreshService.name);

  async refresh(subdomain: string | null): Promise<{ refreshed: boolean; detail: string }> {
    if (!subdomain) return { refreshed: false, detail: 'This account has no site address yet.' };
    const base = process.env.FRONTEND_INTERNAL_URL;
    const secret = process.env.REVALIDATE_SECRET;
    if (!base || !secret) return { refreshed: false, detail: 'Instant refresh is not set up on the server; the page updates within a minute.' };
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(`${base.replace(/\/+$/, '')}/api/revalidate-site`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-revalidate-secret': secret }, body: JSON.stringify({ subdomain }), signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) { this.log.warn(`revalidate-site answered ${res.status} for ${subdomain}`); return { refreshed: false, detail: 'Published. The page updates within a minute.' }; }
      return { refreshed: true, detail: 'Your site is updated.' };
    } catch (e) {
      this.log.warn(`revalidate-site failed for ${subdomain}: ${e instanceof Error ? e.message : String(e)}`);
      return { refreshed: false, detail: 'Published. The page updates within a minute.' };
    }
  }
}
