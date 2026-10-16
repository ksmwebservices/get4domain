import { Fragment, createElement, type ReactNode } from 'react';
import { parseFragment } from 'parse5';
import type { DefaultTreeAdapterMap } from 'parse5';
import CartButton from '../shell/CartButton';
import ShellFooter from '../shell/ShellFooter';
import TabsClient from '../shell/TabsClient';
import { HoursBlock, MapEmbed } from '../shell/ShellExtras';
import { SocialLinks } from '../shell/SocialLinks';
import type { ShellRuntime } from '../shell/types';
import { CONTRACT, type PageEntry, type SiteGroup } from './data';

/**
 * Turns a sanitised theme page into React elements on the server: {{slots}} filled from the vendor's data, data-g4d-each lists repeated, data-g4d-if blocks kept or hidden, and
 * the engine tags (<g4d-action>, <g4d-footer>, <g4d-tabs> and the rest) replaced by the real components. Nothing is ever injected as raw HTML, and the element and attribute
 * lists are checked again here (the import already did), so a page that somehow slipped past the sanitiser still cannot run script.
 */
type N = DefaultTreeAdapterMap['node'];
type El = DefaultTreeAdapterMap['element'];
type Tx = DefaultTreeAdapterMap['textNode'];
type Scope = Record<string, unknown>;

export interface RenderCtx {
  base: string; assetBase: string; assets: Map<string, string>;
  data: Record<string, unknown>;
  shell: ShellRuntime;
  nav: PageEntry[];
  pageHref: Record<string, string>;
  groups: SiteGroup[];
  state: { h1: boolean; images: number; n: number; bottomNavPlaced: boolean };
}

const ELEMENTS = new Set(CONTRACT.elements);
const ATTRS = new Set(CONTRACT.attributes);
const VOID = new Set(['br', 'hr', 'img', 'source', 'wbr', 'col']);
const NO_WS = new Set(['table', 'tbody', 'thead', 'tfoot', 'tr', 'ul', 'ol', 'dl', 'colgroup', 'select', 'picture']);
const SLOT_RE = /\{\{\s*([^{}]*?)\s*\}\}/g;
const PROP: Record<string, string> = { class: 'className', for: 'htmlFor', tabindex: 'tabIndex', colspan: 'colSpan', rowspan: 'rowSpan', srcset: 'srcSet', datetime: 'dateTime', viewbox: 'viewBox', preserveaspectratio: 'preserveAspectRatio', gradientunits: 'gradientUnits', gradienttransform: 'gradientTransform', 'xlink:href': 'xlinkHref', 'clip-path': 'clipPath', 'fill-rule': 'fillRule', 'clip-rule': 'clipRule', 'stroke-width': 'strokeWidth', 'stroke-linecap': 'strokeLinecap', 'stroke-linejoin': 'strokeLinejoin', 'stop-color': 'stopColor', 'stop-opacity': 'stopOpacity', crossorigin: 'crossOrigin' };
const BOOL = new Set(['hidden', 'open']);
/** the sanitiser lower-cases every tag name; these SVG names are case sensitive */
const SVG_TAG: Record<string, string> = { lineargradient: 'linearGradient', radialgradient: 'radialGradient', clippath: 'clipPath' };

function lookup(path: string, scopes: Scope[], root: Record<string, unknown>): unknown {
  const parts = path.split('.');
  let cur: unknown; let found = false;
  for (let i = scopes.length - 1; i >= 0 && !found; i--) if (parts[0] in scopes[i]) { cur = scopes[i][parts[0]]; found = true; }
  if (!found) { if (!(parts[0] in root)) return undefined; cur = root[parts[0]]; }
  for (const p of parts.slice(1)) { if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) cur = (cur as Record<string, unknown>)[p]; else return undefined; }
  return cur;
}
const truthy = (v: unknown): boolean => (Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.trim().length > 0 : typeof v === 'number' ? true : !!v && typeof v === 'object' ? true : !!v);
const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
const interp = (s: string, scopes: Scope[], ctx: RenderCtx): string => s.replace(SLOT_RE, (_m, p: string) => str(lookup(p.trim(), scopes, ctx.data)));

const isText = (n: N): n is Tx => n.nodeName === '#text';
const isEl = (n: N): n is El => 'tagName' in n;
const attrsOf = (el: El): Record<string, string> => Object.fromEntries(el.attrs.map((a) => [a.name, a.value]));
const kids = (n: N): N[] => ('childNodes' in n ? (n as { childNodes: N[] }).childNodes : []);
const templateKids = (el: El): N[] => ((el as unknown as { content?: { childNodes: N[] } }).content?.childNodes ?? el.childNodes);

function parseStyle(v: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of v.split(';')) {
    const i = d.indexOf(':'); if (i < 1) continue;
    const k = d.slice(0, i).trim(); const val = d.slice(i + 1).trim(); if (!k || !val) continue;
    out[k.startsWith('--') ? k : k.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase())] = val;
  }
  return out;
}

/** An address inside the package becomes the picture's address on the API; a page link becomes an address on this site. */
function uri(attr: string, v: string, ctx: RenderCtx): string {
  const t = v.trim();
  if (t.startsWith('asset://')) { const flat = ctx.assets.get(t.slice(8)); return flat ? `${ctx.assetBase}${flat}` : ''; }
  if (/^\s*(javascript|vbscript|data):/i.test(t) && !/^data:image\/(png|jpeg|webp|svg\+xml);/i.test(t)) return '';
  if (attr !== 'href') return t;
  if (t === '' || t === '/' || /^(index|home)\.html$/i.test(t)) return ctx.base;
  if (/^(#|[a-z][a-z0-9+.-]*:|\/\/)/i.test(t)) return t;
  if (t === ctx.base || t.startsWith(`${ctx.base}/`) || t.startsWith(`${ctx.base}#`)) return t; // an address the engine already made (an item's page)
  const bare = t.replace(/^\/+/, '').replace(/^\.\//, '');
  const m = /^([a-z0-9-]+)\.html$/i.exec(bare);
  if (m) return ctx.pageHref[m[1].toLowerCase()] ?? `${ctx.base}/${m[1].toLowerCase()}`;
  return `${ctx.base}/${bare}`;
}

function toProps(el: El, tag: string, scopes: Scope[], ctx: RenderCtx, svg: boolean): Record<string, unknown> | null {
  const props: Record<string, unknown> = {};
  for (const [name, raw] of Object.entries(attrsOf(el))) {
    if (name.startsWith('on')) continue;
    if (name.startsWith('data-g4d-')) {
      if (name === 'data-g4d-open' || name === 'data-g4d-quickview' || name === 'data-g4d-item') props[name] = interp(raw, scopes, ctx);
      continue;
    }
    const value = interp(raw, scopes, ctx);
    if (name === 'style') { props.style = parseStyle(value.replace(/asset:\/\/([^)'"\s]+)/g, (_m, p: string) => { const f = ctx.assets.get(p); return f ? `${ctx.assetBase}${f}` : ''; })); continue; }
    if (name === 'href' || name === 'src' || name === 'srcset') {
      const out = name === 'srcset' ? value.split(',').map((c) => { const [u, ...d] = c.trim().split(/\s+/); return [uri('src', u, ctx), ...d].join(' '); }).join(', ') : uri(name, value, ctx);
      if (out) props[PROP[name] ?? name] = out; else if (name === 'src') return null;
      continue;
    }
    if (name === 'target') { if (value === '_blank') props.target = '_blank'; continue; }
    if (name === 'rel') { props.rel = value; continue; }
    if (BOOL.has(name)) { props[name] = true; continue; }
    if (ATTRS.has(name.toLowerCase()) || name.startsWith('aria-') || name.startsWith('data-')) {
      const key = PROP[name.toLowerCase()] ?? (svg && !name.startsWith('data-') && !name.startsWith('aria-') ? name.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase()) : name);
      props[key] = value;
    }
  }
  if (tag === 'a' && props['data-g4d-open'] !== undefined && !props.href) props.href = ctx.shell.flowPath;
  if (tag === 'button') props.type = 'button';
  return props;
}

function engineTag(el: El, tag: string, scopes: Scope[], ctx: RenderCtx, key: string): ReactNode {
  const a = Object.fromEntries(Object.entries(attrsOf(el)).map(([k, v]) => [k, interp(v, scopes, ctx)]));
  const cls = a.class || undefined;
  const item = a.item || undefined;
  switch (tag) {
    case 'g4d-action': {
      const label = a.label || ctx.shell.primaryLabel;
      const inner = kids(el).length ? renderNodes(kids(el), scopes, ctx, key) : label;
      return <a key={key} className={cls} data-g4d-open="primary" data-g4d-item={item} href={`${ctx.shell.flowPath}${item ? `?item=${encodeURIComponent(item)}` : ''}`}>{inner}</a>;
    }
    case 'g4d-header-nav':
      return <nav key={key} className={cls ? `g4d-header-nav ${cls}` : 'g4d-header-nav'} aria-label={a.label || 'Main'}>{ctx.nav.map((p) => <a key={p.href} href={p.href}>{p.navLabel}</a>)}</nav>;
    case 'g4d-bottom-nav': ctx.state.bottomNavPlaced = true; return null; // the engine draws the bottom bar once, at the end of the page
    case 'g4d-footer': return <ShellFooter key={key} runtime={ctx.shell} variant={(['columns', 'centered', 'minimal'].includes(a.variant) ? a.variant : 'columns') as 'columns'} tagline={str((ctx.data.site as Record<string, unknown>).tagline)} links={ctx.nav.map((p) => ({ label: p.navLabel, href: p.href }))} />;
    case 'g4d-social': return <SocialLinks key={key} social={ctx.shell.social} className={cls} />;
    case 'g4d-hours': return <HoursBlock key={key} runtime={ctx.shell} variant={a.variant} title={a.title || 'Opening hours'} className={cls} />;
    case 'g4d-map': return <MapEmbed key={key} runtime={ctx.shell} title={a.title || 'Map'} height={Math.min(600, Math.max(160, Number(a.height) || 320))} className={cls} />;
    case 'g4d-cart': return ctx.shell.cart.enabled ? <CartButton key={key} label={a.label || 'Cart'} className={cls} /> : null;
    case 'g4d-tabs': {
      const tpl = el.childNodes.find((c): c is El => isEl(c) && c.tagName === 'template');
      const groups = ctx.groups;
      if (!tpl || groups.length === 0) return null;
      const panels = groups.map((g, gi) => <Fragment key={g.slug}>{renderNodes(templateKids(tpl), [...scopes, { group: g, index: gi + 1 }], ctx, `${key}-g${gi}`)}</Fragment>);
      return <TabsClient key={key} labels={groups.map((g) => g.name)} panels={panels} tabClass={a['tab-class'] || ''} panelClass={a['panel-class'] || ''} />;
    }
    default: return null;
  }
}

function renderEl(el: El, scopes: Scope[], ctx: RenderCtx, key: string, svg: boolean): ReactNode {
  const tag = el.tagName;
  const raw = attrsOf(el);
  const ifp = raw['data-g4d-if']; const ifn = raw['data-g4d-if-not'];
  if (ifp !== undefined && !truthy(lookup(ifp.trim(), scopes, ctx.data))) return null;
  if (ifn !== undefined && truthy(lookup(ifn.trim(), scopes, ctx.data))) return null;
  if (tag.startsWith('g4d-')) return CONTRACT.tags.includes(tag) ? engineTag(el, tag, scopes, ctx, key) : null;
  if (tag === 'template') {
    const path = raw['data-g4d-each'];
    if (path === undefined) return null;
    const list = lookup(path.trim(), scopes, ctx.data);
    if (!Array.isArray(list)) return null;
    const last = path.trim().split('.').pop() ?? path;
    const as = (raw['data-g4d-as'] || CONTRACT.repeaters[last]?.as || (last === 'items' ? 'item' : 'row')).trim();
    return list.slice(0, 200).map((row, i) => (
      <Fragment key={`${key}-${i}`}>{renderNodes(templateKids(el), [...scopes, { [as]: row, index: i + 1, first: i === 0, last: i === list.length - 1 }], ctx, `${key}-${i}`)}</Fragment>
    ));
  }
  if (!ELEMENTS.has(tag.toLowerCase())) return null;
  const isSvg = svg || tag === 'svg';
  let outTag = SVG_TAG[tag] ?? tag;
  if (tag === 'h1') { if (ctx.state.h1) outTag = 'h2'; else ctx.state.h1 = true; }
  const props = toProps(el, tag, scopes, ctx, isSvg);
  if (props === null) return null; // a picture with no address
  if (tag === 'img') {
    props.loading = ctx.state.images++ === 0 ? 'eager' : 'lazy'; props.decoding = 'async';
    if (props.alt === undefined) { const it = lookup('item.name', scopes, ctx.data); props.alt = typeof it === 'string' ? it : ''; }
  }
  if (tag === 'a' && typeof props.href === 'string' && /^https?:\/\//i.test(props.href)) props.rel = 'noopener noreferrer nofollow';
  props.key = key;
  const children = VOID.has(tag) ? undefined : renderNodes(kids(el), scopes, ctx, key, isSvg, tag);
  return createElement(outTag, props, ...(children ?? []));
}

export function renderNodes(nodes: N[], scopes: Scope[], ctx: RenderCtx, prefix: string, svg = false, parentTag = ''): ReactNode[] {
  const out: ReactNode[] = [];
  nodes.forEach((n, i) => {
    const key = `${prefix}.${i}`;
    if (isText(n)) {
      const v = n.value;
      if (!v.trim() && (NO_WS.has(parentTag) || v.includes('\n'))) return;
      out.push(interp(v, scopes, ctx));
      return;
    }
    if (isEl(n)) { const r = renderEl(n, scopes, ctx, key, svg); if (r !== null && r !== undefined) out.push(r); }
  });
  return out;
}

const cache = new Map<string, N[]>();
/** Parses a template once per theme version (the result is read-only). */
export function parsedPage(cacheKey: string, html: string): N[] {
  let n = cache.get(cacheKey);
  if (!n) { n = parseFragment(html).childNodes as N[]; if (cache.size > 400) cache.clear(); cache.set(cacheKey, n); }
  return n;
}
