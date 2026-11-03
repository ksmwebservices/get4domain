import { ResolvedEntitlements } from '../../src/plans/entitlements/entitlement-engine';
import { SiteAudit } from '../../src/site-publish/publish/site-audit';
import { SiteBuildService } from '../../src/site-publish/publish/site-build.service';
import { PublishService } from '../../src/site-publish/publish/publish.service';
import { SiteSettingsService } from '../../src/site-publish/publish/site-settings.service';
import { SitePublicService } from '../../src/site-publish/publish/site-public.service';
import { loadKit } from '../../src/site-publish/renderer/renderer-loader';
import { ThemeRenderService } from '../../src/site-publish/renderer/theme-render.service';
import { SourceDocument } from '../../src/site-publish/content/content-types';
import { doc as makeDoc, entitlements, NOW } from './site-fixtures';
import { MemorySiteRepo } from './memory-site-repo';

/** One real ThemeRenderService per test file (it lints the five themes at start, about 3 seconds). */
let sharedThemes: ThemeRenderService | null = null;
export const themeService = (): ThemeRenderService => { if (!sharedThemes) { sharedThemes = new ThemeRenderService(loadKit()); sharedThemes.init(); } return sharedThemes; };

export const STAFF = { type: 'STAFF' as const, id: 'staff-1', ip: null };
export const OWNER = { type: 'VENDOR' as const, id: 'vendor-1', ip: null };

export interface SiteWorld {
  repo: MemorySiteRepo; build: SiteBuildService; publish: PublishService; settings: SiteSettingsService; pub: SitePublicService;
  state: { doc: SourceDocument | null; ent: ResolvedEntitlements; vendorHosts: Map<string, { vendorId: string; suspended: boolean }> };
  audit: string[];
}

export function siteWorld(o: { kind?: 'plumber' | 'dentist' | 'jewellery'; level?: 'FREE' | 'PRO'; claimed?: boolean; doc?: SourceDocument } = {}): SiteWorld {
  const kind = o.kind ?? 'plumber';
  const track = kind === 'jewellery' ? 'ecommerce' : kind === 'dentist' ? 'professional' : 'handyman';
  const state: SiteWorld['state'] = { doc: o.doc ?? makeDoc(kind, { claimed: o.claimed ?? false }), ent: entitlements(o.level ?? 'FREE', track), vendorHosts: new Map() };
  const audit: string[] = [];
  const repo = new MemorySiteRepo();
  const content = { load: async () => state.doc };
  const ents = { resolve: async () => state.ent };
  const auditSink: SiteAudit = { hook: (_actor, action) => async () => { audit.push(action); } };
  const themes = themeService();
  const build = new SiteBuildService(repo, themes, content as never, ents as never, auditSink); build.clock = () => NOW;
  const publish = new PublishService(repo, themes, content as never, ents as never, auditSink); publish.clock = () => NOW;
  const settings = new SiteSettingsService(repo, themes, content as never, ents as never, build, publish, auditSink);
  const hosts = { resolve: async (host: string) => { const h = state.vendorHosts.get(host); return h && !h.suspended ? { vendorId: h.vendorId } : null; } };
  const pub = new SitePublicService(repo, hosts as never);
  return { repo, build, publish, settings, pub, state, audit };
}
