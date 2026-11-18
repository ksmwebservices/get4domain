import { baseDomain, originFor, readHostConfig } from './hostnames';
import { directoryHomeHref, hostRoutingActive } from './host-routing';

/**
 * Where a link of the portal shell goes. With the host layer on, the main site and the directory are two hosts, so a link across them is absolute; with it off
 * (a single host, or local review) every link is a path on the same host. Pure of the framework, so the tests can feed it a host config.
 */
export interface PortalLinks {
  main: (path: string) => string;
  directoryHome: string;
  search: string;
  claim: string;
  login: string;
  directoryPath: (path: string) => string;
}

export function portalLinks(cfg = readHostConfig(), env: Record<string, string | undefined> = process.env): PortalLinks {
  const active = hostRoutingActive(cfg, env);
  const base = baseDomain(cfg);
  const mainOrigin = active && base ? originFor(base) : null;
  const dirOrigin = active && cfg.directory ? originFor(cfg.directory) : null;
  const main = (path: string): string => (mainOrigin ? `${mainOrigin}${path}` : path);
  const dir = (path: string): string => (dirOrigin ? `${dirOrigin}${path}` : path);
  return {
    main,
    directoryHome: dirOrigin ? `${dirOrigin}/` : directoryHomeHref(cfg, env),
    search: dir('/search'),
    claim: dir('/claim'),
    login: main('/login'),
    directoryPath: dir,
  };
}
