import { LEGAL_PAGE_PATHS } from './legal-paths';

/**
 * The rules of the phone bottom bar (dispatch P2.6), pure of the framework so the tests and the component use the same ones.
 * Five places: Home, Search, Categories, Plans and More. A place is "active" only when its address is a path on THIS host (a link to the other host is absolute and never active).
 */
export type AppTab = 'home' | 'search' | 'categories' | 'plans' | 'more';

export interface AppTabLink { key: AppTab; href: string }

const isAbsolute = (href: string): boolean => /^https?:\/\//i.test(href);
const pathOf = (href: string): string => href.split('#')[0].split('?')[0].replace(/\/+$/, '') || '/';
const within = (pathname: string, base: string): boolean => pathname === base || pathname.startsWith(`${base}/`);

/** Pages of the "More" sheet; the More tab is marked while one of them is open. */
export const MORE_PATHS: readonly string[] = ['/login', '/register', '/product', '/growth', '/how-it-works', '/guides', '/partners', '/account'];

/** Policy pages: long reading with their own links, so the bar stays away from them. */
export function isLegalPath(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, '') || '/';
  return LEGAL_PAGE_PATHS.includes(p) || p === '/legal' || p.startsWith('/legal/');
}

/** Whether the bar is shown for this path at all. */
export const showAppNav = (pathname: string): boolean => !isLegalPath(pathname);

/** The active tab for a path, or null. `homeHref` is where Home goes on this host. Only links that are paths on this host can be active. */
export function activeTab(pathname: string, links: readonly AppTabLink[]): AppTab | null {
  const p = pathname.replace(/\/+$/, '') || '/';
  const href = (k: AppTab): string | null => { const l = links.find((x) => x.key === k); return l && !isAbsolute(l.href) ? pathOf(l.href) : null; };
  const search = href('search');
  if (search && within(p, search)) return 'search';
  const cats = href('categories');
  if (cats && within(p, cats)) return 'categories';
  const plans = href('plans');
  if (plans && within(p, plans)) return 'plans';
  if (MORE_PATHS.some((m) => within(p, m))) return 'more';
  const home = href('home');
  if (home && p === home) return 'home';
  return null;
}

/** The three ways the Install item behaves. 'hidden' when the app is already installed (opened from the home screen) or the browser offers no way. */
export type InstallMode = 'prompt' | 'ios' | 'hidden';

export function installMode(input: { standalone: boolean; hasPrompt: boolean; ios: boolean }): InstallMode {
  if (input.standalone) return 'hidden';
  if (input.hasPrompt) return 'prompt';
  return input.ios ? 'ios' : 'hidden';
}

/** iPhone, iPad (including iPadOS, which reports itself as a Mac with touch) and iPod. Other iOS browsers can add to the home screen too, so the hint is the same. */
export function isIosDevice(userAgent: string, maxTouchPoints: number): boolean {
  return /iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}
