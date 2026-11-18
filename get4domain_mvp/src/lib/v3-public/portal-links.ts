import { baseDomain, originFor, readHostConfig, type HostConfig } from './hostnames';
import { directoryHomeHref, hostRoutingActive } from './host-routing';

/**
 * Where a link of the portal goes, seen from the host the page is on. With the host layer on, the main site and the directory are two hosts: a link to the page's own host stays a
 * path (so the crawl, the cache and the address bar all stay on one host) and a link to the other host is absolute. With the layer off (a single host, or local review) every link is a path.
 * Pure of the framework, so the tests can feed it a host config.
 */
export interface PortalLinks {
  /** an address on the main site */
  main: (path: string) => string;
  /** an address on the directory host */
  directoryPath: (path: string) => string;
  directoryHome: string;
  search: string;
  claim: string;
  login: string;
}

export type PortalHost = 'main' | 'directory';

export function portalLinks(from: PortalHost, cfg: HostConfig = readHostConfig(), env: Record<string, string | undefined> = process.env): PortalLinks {
  const active = hostRoutingActive(cfg, env);
  const base = baseDomain(cfg);
  const mainOrigin = active && base && from !== 'main' ? originFor(base) : null;
  const dirOrigin = active && cfg.directory && from !== 'directory' ? originFor(cfg.directory) : null;
  const main = (path: string): string => (mainOrigin ? `${mainOrigin}${path}` : path);
  const dir = (path: string): string => (dirOrigin ? `${dirOrigin}${path}` : path);
  // on the directory host the home is "/"; from the main host it is the directory origin; with one host it is the old /directory route
  const home = active && cfg.directory ? (dirOrigin ? `${dirOrigin}/` : '/') : directoryHomeHref(cfg, env);
  return { main, directoryPath: dir, directoryHome: home, search: dir('/search'), claim: dir('/claim'), login: main('/login') };
}
