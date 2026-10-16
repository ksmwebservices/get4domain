import postcss, { AtRule, ChildNode, Container, Declaration, Rule } from 'postcss';
import { CONTRACT } from './contract';

/**
 * The theme's stylesheet, made safe and scoped. Everything is rewritten under one scope class (`.g4d-theme-<id>`) so a theme can never style another site or the
 * dashboard; external addresses, imports, expressions and script-like values are removed; pictures and fonts must be files inside the package.
 */
export interface CssResult { css: string; errors: string[]; warnings: string[]; stripped: string[]; usedAssets: string[]; googleFontsUsed: string[] }

const BAD_VALUE = /expression\s*\(|javascript:|vbscript:|behavior\s*:|-moz-binding|@import/i;
const URL_RE = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;
const KEEP_AT = new Set(['media', 'supports', 'font-face', 'layer', 'container']);

export const normaliseAssetPath = (raw: string): string => raw.trim().replace(/^(\.\.?\/)+/, '').replace(/^\/+/, '');

export interface UrlVerdict { ok: boolean; value: string; reason?: string; asset?: string }

/** Rewrites every url(...) in a CSS value. A url must be a file inside the package (assets/...) or a small inline image or font; anything else makes the value unusable. */
export function cleanCssUrls(value: string, assetPaths: Set<string>): UrlVerdict {
  let bad: string | undefined; let asset: string | undefined;
  const out = value.replace(URL_RE, (_m, _q, raw: string) => {
    const u = raw.trim();
    if (/^data:(image\/(png|jpeg|webp|svg\+xml)|font\/woff2?|application\/font-woff2?);/i.test(u)) {
      if (u.length > CONTRACT.limits.dataUriBytes) { bad = `an inline picture or font is larger than ${Math.round(CONTRACT.limits.dataUriBytes / 1000)} KB`; return 'none'; }
      return `url("${u.replace(/"/g, '')}")`;
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(u) || u.startsWith('//')) { bad = `an external address (${u.slice(0, 60)})`; return 'none'; }
    const p = normaliseAssetPath(u.split('#')[0].split('?')[0]);
    if (!assetPaths.has(p)) { bad = `a file that is not in the package (${p || u})`; return 'none'; }
    asset = p;
    return `url("asset://${p}")`;
  });
  return bad ? { ok: false, value: out, reason: bad } : { ok: true, value: out, asset };
}

/** One selector, scoped. :root, html and body become the scope itself. */
export function scopeSelector(selector: string, scope: string): string {
  let s = selector.trim();
  if (!s) return s;
  if (s === scope || s.startsWith(`${scope} `) || s.startsWith(`${scope}.`) || s.startsWith(`${scope}:`)) return s; // already scoped (the lint fix writes scoped files)
  s = s.replace(/^html(?![\w-])\s*/i, (m) => (/^html\s*$/i.test(s) ? m : '')).trim();
  const m = /^(:root|html|body)(?![\w-])/i.exec(s);
  if (m) return `${scope}${s.slice(m[0].length)}`.replace(/\s+/g, ' ').trim();
  return `${scope} ${s}`;
}

export function sanitiseCss(source: string, opts: { scope: string; assetPaths: Set<string>; googleFonts: string[]; file: string }): CssResult {
  const res: CssResult = { css: '', errors: [], warnings: [], stripped: [], usedAssets: [], googleFontsUsed: [] };
  if (Buffer.byteLength(source) > CONTRACT.limits.cssBytes) { res.errors.push(`${opts.file} is larger than ${Math.round(CONTRACT.limits.cssBytes / 1000)} KB. Split out pictures and keep the stylesheet small.`); return res; }
  let root;
  try { root = postcss.parse(source, { from: opts.file }); } catch (e) {
    const err = e as { reason?: string; line?: number };
    res.errors.push(`${opts.file} has a mistake${err.line ? ` on line ${err.line}` : ''}: ${err.reason ?? 'the stylesheet could not be read'}. Fix it and upload again.`);
    return res;
  }
  const drop = (n: ChildNode, why: string): void => { res.stripped.push(why); n.remove(); };

  const walk = (container: Container): void => {
    container.each((node) => {
      if (node.type === 'comment') { node.remove(); return; }
      if (node.type === 'atrule') {
        const at = node as AtRule;
        const name = at.name.toLowerCase().replace(/^-\w+-/, '');
        if (name === 'import') {
          const m = /url\(\s*['"]?([^'")]+)['"]?\s*\)|['"]([^'"]+)['"]/.exec(at.params);
          const u = (m?.[1] ?? m?.[2] ?? '').trim();
          if (u.startsWith(CONTRACT.googleFontsPrefix) && opts.googleFonts.includes(u)) { res.googleFontsUsed.push(u); at.remove(); return; }
          drop(at, `an @import of ${u.slice(0, 60) || 'another stylesheet'} (external style sheets are not allowed; list Google Fonts in theme.json, "googleFonts")`);
          return;
        }
        if (name === 'keyframes') { return; }
        if (!KEEP_AT.has(name)) { drop(at, `@${at.name} (not allowed)`); return; }
        walk(at);
        if (name !== 'font-face' && at.nodes && at.nodes.length === 0) at.remove();
        return;
      }
      if (node.type === 'rule') {
        const rule = node as Rule;
        const inKeyframes = rule.parent && rule.parent.type === 'atrule' && /keyframes$/i.test((rule.parent as AtRule).name);
        if (!inKeyframes) rule.selectors = rule.selectors.map((s) => scopeSelector(s, opts.scope));
        walk(rule);
        return;
      }
      if (node.type === 'decl') {
        const d = node as Declaration;
        if (BAD_VALUE.test(d.value) || BAD_VALUE.test(d.prop)) { drop(d, `a style rule that can run code (${d.prop})`); return; }
        if (/url\(/i.test(d.value)) {
          const v = cleanCssUrls(d.value, opts.assetPaths);
          if (!v.ok) { drop(d, `${d.prop} (${v.reason})`); return; }
          if (v.asset) res.usedAssets.push(v.asset);
          d.value = v.value;
        }
        if (/^--/.test(d.prop) && /[<>]/.test(d.value)) { drop(d, `the variable ${d.prop} (it contains markup)`); }
      }
    });
  };
  walk(root);
  res.css = root.toString().trim();
  return res;
}
