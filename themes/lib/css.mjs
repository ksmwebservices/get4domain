// A small CSS reader for the lint: enough structure (rules, declarations, at-rules, keyframes) to answer questions about a stylesheet.
// It does not evaluate CSS. Comments are removed first; strings and parentheses are respected so `url(data:...;...)` does not split a declaration.

export function stripComments(css) {
  let out = ''; let i = 0; let q = null;
  while (i < css.length) {
    const ch = css[i];
    if (q) { out += ch; if (ch === '\\') { out += css[i + 1] ?? ''; i += 2; continue; } if (ch === q) q = null; i++; continue; }
    if (ch === '"' || ch === "'") { q = ch; out += ch; i++; continue; }
    if (ch === '/' && css[i + 1] === '*') { const e = css.indexOf('*/', i + 2); i = e < 0 ? css.length : e + 2; continue; }
    out += ch; i++;
  }
  return out;
}

/** Index of the matching `}` for the `{` at `open`, or -1. */
function matchBrace(s, open) {
  let depth = 0; let q = null;
  for (let i = open; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === '\\') i++; else if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'") { q = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

function splitTop(s, sep) {
  const out = []; let depth = 0; let q = null; let cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) { cur += ch; if (ch === '\\') { cur += s[i + 1] ?? ''; i++; } else if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (ch === sep && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

export function parseDecls(body) {
  const decls = [];
  for (const part of splitTop(body, ';')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const prop = part.slice(0, i).trim().toLowerCase();
    let value = part.slice(i + 1).trim();
    const important = /!\s*important\s*$/i.test(value);
    if (important) value = value.replace(/!\s*important\s*$/i, '').trim();
    if (prop) decls.push({ prop, value, important });
  }
  return decls;
}

const BLOCK_RULE_AT = new Set(['media', 'supports', 'layer', 'container', 'document', 'scope']);

/** @returns {{type:'rule',selector:string,selectors:string[],decls:{prop:string,value:string,important:boolean}[]} | {type:'at',name:string,prelude:string,rules:any[]|null,decls:any[]|null}} */
export function parseRules(css) {
  const s = stripComments(css);
  const rules = [];
  let i = 0;
  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i])) i++;
    if (i >= s.length) break;
    if (s[i] === '@') {
      let j = i; let depth = 0;
      while (j < s.length && !((s[j] === '{' || s[j] === ';') && depth === 0)) { if (s[j] === '(') depth++; if (s[j] === ')') depth--; j++; }
      const head = s.slice(i + 1, j).trim();
      const name = head.split(/[\s({]/)[0].toLowerCase();
      const prelude = head.slice(name.length).trim();
      if (s[j] === ';' || j >= s.length) { rules.push({ type: 'at', name, prelude, rules: null, decls: null }); i = j + 1; continue; }
      const end = matchBrace(s, j);
      const body = s.slice(j + 1, end < 0 ? s.length : end);
      if (BLOCK_RULE_AT.has(name) || name === 'keyframes' || name.endsWith('-keyframes')) rules.push({ type: 'at', name: name.replace(/^-\w+-/, ''), prelude, rules: parseRules(body), decls: null });
      else rules.push({ type: 'at', name, prelude, rules: null, decls: parseDecls(body) });
      i = end < 0 ? s.length : end + 1;
      continue;
    }
    const open = s.indexOf('{', i);
    if (open < 0) break;
    const end = matchBrace(s, open);
    const selector = s.slice(i, open).trim();
    const body = s.slice(open + 1, end < 0 ? s.length : end);
    rules.push({ type: 'rule', selector, selectors: splitTop(selector, ',').map((x) => x.trim()).filter(Boolean), decls: parseDecls(body), nested: body.includes('{') });
    i = end < 0 ? s.length : end + 1;
  }
  return rules;
}

/** Visits every plain rule with the chain of enclosing at-rules. */
export function eachRule(rules, fn, chain = []) {
  for (const r of rules) {
    if (r.type === 'rule') fn(r, chain);
    else if (r.rules) eachRule(r.rules, fn, [...chain, r]);
  }
}
export function eachAt(rules, fn, chain = []) {
  for (const r of rules) {
    if (r.type !== 'at') continue;
    fn(r, chain);
    if (r.rules) eachAt(r.rules, fn, [...chain, r]);
  }
}

/** px value of a simple length ("44px", "2.75rem" as 16px rem), or null. `resolve` maps var(--x) to a string. */
export function toPx(value, resolve = () => null) {
  let v = String(value).trim();
  const m0 = v.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)$/);
  if (m0) v = resolve(m0[1]) ?? m0[2] ?? '';
  const m = String(v).trim().match(/^(-?\d*\.?\d+)(px|rem|em)$/);
  if (!m) return null;
  return m[2] === 'px' ? Number(m[1]) : Number(m[1]) * 16;
}

export const classesIn = (selector) => [...selector.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]);
export const tagsIn = (selector) => [...selector.replace(/\[[^\]]*\]|::?[\w-]+(\([^)]*\))?|"[^"]*"|'[^']*'/g, ' ').matchAll(/(?:^|[\s>+~(,])([a-zA-Z][\w-]*)/g)].map((m) => m[1].toLowerCase());
