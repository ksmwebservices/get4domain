import { parseDocument } from 'htmlparser2';
import { AnyNode, ChildNode, Document, Element, ParentNode, Text, isTag, isText } from 'domhandler';
import render from 'dom-serializer';
import postcss from 'postcss';
import { CONTRACT } from './contract';
import { cleanCssUrls, normaliseAssetPath } from './css';

/**
 * One page template, made safe. Only the contract's elements and attributes survive; scripts, forms, frames, event handlers, script-like and external addresses are
 * removed; pictures must be files in the package (or the engine's own slots); every engine tag is checked. The result is plain HTML the website turns into React elements
 * (never injected as raw HTML), so even a missed case cannot run code.
 */
export interface HtmlResult {
  html: string; errors: string[]; warnings: string[]; stripped: string[];
  usedAssets: string[]; slots: Set<string>; tags: Set<string>; each: Set<string>; ifs: Set<string>;
  h1: number; imgNoAlt: number; externalLinks: number; hasBody: boolean;
}

const ELEMENTS = new Set(CONTRACT.elements);
const DROP = new Set(CONTRACT.dropWithContent);
const ATTRS = new Set(CONTRACT.attributes);
const DATA_G4D = new Set(CONTRACT.dataAttributes);
const TAGS = new Set(CONTRACT.tags);
const SLOT_RE = /\{\{\s*([^{}]*?)\s*\}\}/g;
const PATH_RE = /^[A-Za-z_]\w*(\.\w+)*$/;

/** Every name a {{slot}} may use: the page slots plus <repeater variable>.<field> for every repeater. */
export const KNOWN_SLOTS: Set<string> = (() => {
  const s = new Set(CONTRACT.slots);
  for (const r of Object.values(CONTRACT.repeaters)) for (const f of r.fields) s.add(`${r.as}.${f}`);
  return s;
})();
export const REPEATER_NAMES = new Set(Object.keys(CONTRACT.repeaters));
export const REPEATER_VARS = new Set(Object.values(CONTRACT.repeaters).map((r) => r.as));

/** True when a data-g4d-each path names a list: a top-level repeater, or <variable>.<list field> such as group.items. */
export function knownEach(path: string): boolean {
  if (REPEATER_NAMES.has(path)) return true;
  const [v, f] = path.split('.');
  return !!f && (v === 'group' && f === 'items');
}
export function knownCondition(path: string): boolean {
  return REPEATER_NAMES.has(path) || KNOWN_SLOTS.has(path) || path === 'hours' || /^\w+\.items$/.test(path);
}

const isTemplateEach = (el: Element): boolean => el.attribs['data-g4d-each'] !== undefined;

function cleanStyle(value: string, assetPaths: Set<string>, res: HtmlResult, where: string): string | null {
  let root;
  try { root = postcss.parse(`a{${value}}`); } catch { res.stripped.push(`an unreadable style attribute (${where})`); return null; }
  const out: string[] = [];
  root.walkDecls((d) => {
    if (/expression\s*\(|javascript:|behavior\s*:|-moz-binding|@import/i.test(`${d.prop}:${d.value}`)) { res.stripped.push(`a style that can run code (${d.prop}) in ${where}`); return; }
    if (/url\(/i.test(d.value)) {
      const v = cleanCssUrls(d.value, assetPaths);
      if (!v.ok) { res.stripped.push(`${d.prop} in a style attribute (${v.reason}) in ${where}`); return; }
      if (v.asset) res.usedAssets.push(v.asset);
      out.push(`${d.prop}:${v.value}`);
      return;
    }
    out.push(`${d.prop}:${d.value}`);
  });
  return out.join(';');
}

function noteSlots(text: string, res: HtmlResult, where: string): void {
  for (const m of text.matchAll(SLOT_RE)) {
    const p = m[1].trim();
    if (!PATH_RE.test(p)) { res.warnings.push(`${where}: {{${p}}} is not a valid slot name and will show nothing.`); continue; }
    res.slots.add(p);
    if (!KNOWN_SLOTS.has(p)) res.warnings.push(`${where}: {{${p}}} is not a slot the engine knows and will show nothing.`);
  }
}

function cleanUri(attr: string, value: string, tag: string, assetPaths: Set<string>, res: HtmlResult, where: string): string | null {
  const v = value.trim();
  if (!v) return '';
  if (v.includes('{{')) { noteSlots(v, res, where); return v; }
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(v)?.[1]?.toLowerCase();
  if (attr === 'href') {
    if (v.startsWith('#')) return v;
    if (scheme) {
      if (!CONTRACT.allowedUriSchemes.includes(scheme)) { res.stripped.push(`a ${scheme}: link in ${where}`); return null; }
      if (scheme === 'http' || scheme === 'https') res.externalLinks += 1;
      return v;
    }
    if (v.startsWith('//')) { res.externalLinks += 1; return `https:${v}`; }
    return v; // a page of the same site
  }
  // src and srcset: a file inside the package, or a small inline image
  const one = (u: string): string | null => {
    const t = u.trim();
    if (/^data:image\/(png|jpeg|webp|svg\+xml);/i.test(t)) return t.length <= CONTRACT.limits.dataUriBytes ? t : null;
    if (/^[a-z][a-z0-9+.-]*:/i.test(t) || t.startsWith('//')) return null;
    const p = normaliseAssetPath(t.split('#')[0].split('?')[0]);
    if (!assetPaths.has(p)) return null;
    res.usedAssets.push(p);
    return `asset://${p}`;
  };
  if (attr === 'srcset') {
    const parts = v.split(',').map((x) => x.trim()).filter(Boolean).map((c) => { const [u, ...d] = c.split(/\s+/); const r = one(u); return r ? [r, ...d].join(' ') : null; });
    if (parts.some((x) => x === null)) { res.stripped.push(`a srcset that uses pictures outside the package in ${where}`); return null; }
    return parts.join(', ');
  }
  const r = one(v);
  if (r === null) { res.stripped.push(`${tag === 'img' ? 'a picture' : 'a file'} that is not inside the package (${v.slice(0, 60)}) in ${where}. Put it in assets/ and refer to it as assets/name.webp`); return null; }
  return r;
}

function cleanElement(el: Element, assetPaths: Set<string>, res: HtmlResult, where: string): void {
  const name = el.name;
  const next: Record<string, string> = {};
  const g4dTag = name.startsWith('g4d-');
  const allowedForTag = g4dTag ? new Set(CONTRACT.tagAttributes[name] ?? []) : null;
  for (const [rawKey, rawVal] of Object.entries(el.attribs)) {
    const key = rawKey.toLowerCase();
    const val = rawVal ?? '';
    if (key.startsWith('on')) { res.stripped.push(`an event handler (${key}) in ${where}`); continue; }
    if (key.startsWith('data-g4d-')) {
      if (!DATA_G4D.has(key)) { res.warnings.push(`${where}: ${key} is not an engine attribute and was removed.`); continue; }
      if (key === 'data-g4d-each') {
        const v = val.trim();
        if (!knownEach(v)) { res.errors.push(`${where}: data-g4d-each="${v}" names a list that does not exist. Use one of ${Object.keys(CONTRACT.repeaters).join(', ')} (or group.items inside a group).`); continue; }
        res.each.add(v);
      }
      if (key === 'data-g4d-if' || key === 'data-g4d-if-not') {
        const v = val.trim();
        if (!knownCondition(v)) res.warnings.push(`${where}: ${key}="${v}" is not something the engine knows; the block will be hidden.`);
        res.ifs.add(v);
      }
      if (key === 'data-g4d-as' && !/^[a-z][a-z0-9]*$/.test(val.trim())) { res.errors.push(`${where}: data-g4d-as must be a plain lower-case word.`); continue; }
      next[key] = val; noteSlots(val, res, where);
      continue;
    }
    if (allowedForTag) { if (!allowedForTag.has(key)) { res.warnings.push(`${where}: <${name}> does not take "${key}"; it was removed.`); continue; } next[key] = val; noteSlots(val, res, where); continue; }
    if (key === 'style') { const s = cleanStyle(val, assetPaths, res, where); if (s) next.style = s; continue; }
    if (CONTRACT.uriAttributes.includes(key)) { const u = cleanUri(key, val, name, assetPaths, res, where); if (u !== null) next[key] = u; continue; }
    if (key === 'target') { if (val === '_blank') next.target = '_blank'; continue; }
    if (key === 'rel') { continue; }
    if (ATTRS.has(key) || key.startsWith('aria-') || key.startsWith('data-')) { next[key] = val; noteSlots(val, res, where); continue; }
    res.stripped.push(`the attribute ${key} on <${name}> in ${where}`);
  }
  if (name === 'a' && next.href && /^https?:\/\//i.test(next.href)) next.rel = 'noopener noreferrer nofollow';
  if (name === 'a' && next.target === '_blank' && !next.rel) next.rel = 'noopener noreferrer';
  if (name === 'button') next.type = 'button';
  if (name === 'img') { if (next.alt === undefined) res.imgNoAlt += 1; }
  if (name === 'h1') res.h1 += 1;
  el.attribs = next;
}

function cleanChildren(parent: ParentNode, assetPaths: Set<string>, res: HtmlResult, where: string): void {
  const out: ChildNode[] = [];
  for (const node of [...parent.children]) {
    if (isText(node)) { noteSlots((node as Text).data, res, where); out.push(node); continue; }
    if (!isTag(node)) continue; // comments, directives and the like are dropped
    const el = node as Element;
    const name = el.name.toLowerCase();
    if (DROP.has(name)) { res.stripped.push(`<${name}> in ${where}${name === 'script' ? ' (scripts are not allowed in themes)' : name === 'form' ? ' (forms are supplied by the engine: use <g4d-action>)' : name === 'iframe' ? ' (frames are not allowed; use <g4d-map> for a map)' : ''}`); continue; }
    if (name.startsWith('g4d-')) {
      if (!TAGS.has(name)) { res.errors.push(`${where}: <${name}> is not an engine tag. The tags are ${CONTRACT.tags.join(', ')}.`); continue; }
      res.tags.add(name);
      el.name = name;
      cleanElement(el, assetPaths, res, where);
      cleanChildren(el, assetPaths, res, where);
      out.push(el);
      continue;
    }
    if (!ELEMENTS.has(name)) { res.stripped.push(`the tag <${name}> in ${where} (its content was kept)`); cleanChildren(el, assetPaths, res, where); for (const c of el.children) out.push(c); continue; }
    el.name = name;
    cleanElement(el, assetPaths, res, where);
    cleanChildren(el, assetPaths, res, where);
    out.push(el);
  }
  for (const n of out) n.parent = parent;
  parent.children = out;
}

export function sanitiseHtml(source: string, opts: { file: string; assetPaths: Set<string> }): HtmlResult {
  const res: HtmlResult = { html: '', errors: [], warnings: [], stripped: [], usedAssets: [], slots: new Set(), tags: new Set(), each: new Set(), ifs: new Set(), h1: 0, imgNoAlt: 0, externalLinks: 0, hasBody: false };
  if (Buffer.byteLength(source) > CONTRACT.limits.htmlBytes) { res.errors.push(`${opts.file} is larger than ${Math.round(CONTRACT.limits.htmlBytes / 1000)} KB.`); return res; }
  const doc: Document = parseDocument(source, { lowerCaseTags: true, lowerCaseAttributeNames: true, recognizeSelfClosing: true, decodeEntities: true });
  // the page is whatever is inside <body>; anything in <head> (titles, links, scripts) is ignored on purpose: the engine writes the head
  const find = (n: ParentNode): Element | null => { for (const c of n.children) { if (isTag(c)) { if (c.name === 'body') return c; const f = find(c); if (f) return f; } } return null; };
  const body = find(doc);
  res.hasBody = !!body;
  const root: ParentNode = body ?? doc;
  // a <head> left inside the fragment is never rendered
  cleanChildren(root, opts.assetPaths, res, opts.file);
  res.html = render(root.children as AnyNode[], { decodeEntities: true, selfClosingTags: false }).trim();
  return res;
}
