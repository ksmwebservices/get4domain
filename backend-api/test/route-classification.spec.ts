import * as path from 'path';
import { RouteInfo, scanRoutes, violatesStaffPath } from './support/route-scan';
import baseline from './baselines/route-classification.json';

/**
 * Drift alarm for the API's access surface. The baseline (test/baselines/route-classification.json) is a REVIEWED snapshot of
 * every HTTP route and how it is protected. Adding a route, or changing how one is protected, fails this test until
 * `npm run routes:baseline` is run and the resulting git diff is reviewed. It cannot prove a handler is safe; it makes sure
 * nobody changes the access surface silently.
 */
const srcDir = path.resolve(__dirname, '../src');
const current = scanRoutes(srcDir);
const key = (r: Pick<RouteInfo, 'route' | 'controller'>) => `${r.route}  ←  ${r.controller}`;
const saved = baseline.routes as RouteInfo[];
const savedByKey = new Map(saved.map((r) => [key(r), r]));
const currentByKey = new Map(current.map((r) => [key(r), r]));

/** /admin... paths that are intentionally NOT staff-guarded, each with the reason. Adding to this list needs a security decision. */
const STAFF_PATH_EXCEPTIONS: Record<string, string> = {
  'POST /admin-team/invite/accept': 'a newly invited staff member accepts with a one-time token before they have an account',
};

describe('route classification (static scan of all controllers)', () => {
  it('finds a plausible number of routes (the scanner itself is working)', () => {
    expect(current.length).toBeGreaterThan(600);
    expect(new Set(current.map((r) => r.cls))).toEqual(new Set(['public', 'admin', 'authenticated']));
  });

  it('has no route that is missing from the reviewed baseline', () => {
    const added = [...currentByKey.keys()].filter((k) => !savedByKey.has(k));
    expect(added).toEqual([]);   // fix: npm run routes:baseline, then review the diff of the baseline file
  });

  it('has no route that disappeared from the code but is still in the baseline', () => {
    const removed = [...savedByKey.keys()].filter((k) => !currentByKey.has(k));
    expect(removed).toEqual([]); // fix: npm run routes:baseline
  });

  it('has not changed how any existing route is protected', () => {
    const changed: string[] = [];
    for (const [k, now] of currentByKey) {
      const was = savedByKey.get(k);
      if (!was) continue;
      if (was.cls !== now.cls) changed.push(`${k}: ${was.cls} -> ${now.cls}`);
      if (was.readsPrincipal !== now.readsPrincipal) changed.push(`${k}: readsPrincipal ${was.readsPrincipal} -> ${now.readsPrincipal}`);
      if ((was.module ?? null) !== (now.module ?? null)) changed.push(`${k}: module ${was.module ?? '-'} -> ${now.module ?? '-'}`);
      if ((was.roles ?? null) !== (now.roles ?? null)) changed.push(`${k}: roles ${was.roles ?? '-'} -> ${now.roles ?? '-'}`);
    }
    expect(changed).toEqual([]);
  });

  it('keeps every /admin... route behind a staff guard, except the documented exceptions', () => {
    const open = current.filter(violatesStaffPath).map((r) => r.route).filter((r) => !(r in STAFF_PATH_EXCEPTIONS));
    expect(open).toEqual([]);
  });

  it('documents each staff-path exception with a reason that still matches a real route', () => {
    for (const route of Object.keys(STAFF_PATH_EXCEPTIONS)) {
      expect(current.some((r) => r.route === route && violatesStaffPath(r))).toBe(true);
    }
  });

  it('never marks a route both @Public and staff-guarded without a decision (public wins and skips JWT)', () => {
    // The scanner reports "public" when both are present; list those so a human looks. None today.
    const both = current.filter((r) => r.cls === 'public' && /^(GET|POST|PUT|PATCH|DELETE) \/admin(\/|$)/.test(r.route)).map((r) => r.route);
    expect(both).toEqual([]);
  });
});
