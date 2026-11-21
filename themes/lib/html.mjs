// A small tolerant HTML parser and serializer for theme templates. It never executes anything and never decodes entities: text and attribute
// values are kept exactly as written, so what the template author wrote is what the lint sees. Shared by the renderer and the lint.
export const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style']);

/** @typedef {{type:'text',value:string}|{type:'comment',value:string}|{type:'raw',value:string}|{type:'el',tag:string,attrs:Record<string,string>,order:string[],children:Node[],selfClosed:boolean}} Node */

export function parse(html) {
  const root = { type: 'el', tag: '#root', attrs: {}, order: [], children: [], selfClosed: false };
  const stack = [root];
  const top = () => stack[stack.length - 1];
  const re = /<!--([\s\S]*?)-->|<!doctype[^>]*>|<\/([a-zA-Z][^\s>/]*)\s*>|<([a-zA-Z][^\s>/]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>/gi;
  let last = 0;
  let m;
  const pushText = (s) => { if (s) top().children.push({ type: 'text', value: s }); };
  while ((m = re.exec(html))) {
    pushText(html.slice(last, m.index));
    last = re.lastIndex;
    if (m[1] !== undefined) { top().children.push({ type: 'comment', value: m[1] }); continue; }
    if (m[0].toLowerCase().startsWith('<!doctype')) continue;
    if (m[2] !== undefined) {
      const tag = m[2].toLowerCase();
      for (let i = stack.length - 1; i > 0; i--) if (stack[i].tag === tag) { stack.length = i; break; }
      continue;
    }
    const tag = m[3].toLowerCase();
    const attrs = {};
    const order = [];
    for (const a of m[4].matchAll(/([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
      const name = a[1].toLowerCase();
      if (!(name in attrs)) order.push(name);
      attrs[name] = a[2] ?? a[3] ?? a[4] ?? '';
    }
    const el = { type: 'el', tag, attrs, order, children: [], selfClosed: m[5] === '/' };
    top().children.push(el);
    if (VOID.has(tag) || el.selfClosed) continue;
    if (RAW.has(tag)) {
      const close = new RegExp(`</${tag}\\s*>`, 'i');
      const rest = html.slice(last);
      const c = close.exec(rest);
      const body = c ? rest.slice(0, c.index) : rest;
      if (body) el.children.push({ type: 'text', value: body });
      last += c ? c.index + c[0].length : rest.length;
      re.lastIndex = last;
      continue;
    }
    stack.push(el);
  }
  pushText(html.slice(last));
  return root.children;
}

const escAttr = (v) => String(v).replace(/&(?!(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;').replace(/"/g, '&quot;');

export function serialize(nodes) {
  let out = '';
  for (const n of nodes) {
    if (n.type === 'text' || n.type === 'raw') out += n.value;
    else if (n.type === 'comment') continue;
    else {
      out += `<${n.tag}`;
      for (const name of n.order) if (name in n.attrs) out += n.attrs[name] === '' && !/^(alt|value|content)$/.test(name) ? ` ${name}` : ` ${name}="${escAttr(n.attrs[name])}"`;
      if (VOID.has(n.tag)) out += '>';
      else out += `>${serialize(n.children)}</${n.tag}>`;
    }
  }
  return out;
}

export function walk(nodes, fn, parent = null) {
  for (const n of nodes) {
    if (n.type === 'el') { if (fn(n, parent) === false) continue; walk(n.children, fn, n); }
  }
}
export function findAll(nodes, pred) {
  const out = [];
  walk(nodes, (n) => { if (pred(n)) out.push(n); });
  return out;
}
export const byTag = (nodes, tag) => findAll(nodes, (n) => n.tag === tag);
export const textOf = (nodes) => nodes.map((n) => (n.type === 'text' ? n.value : n.type === 'el' ? textOf(n.children) : '')).join('');
export const el = (tag, attrs = {}, children = []) => ({ type: 'el', tag, attrs, order: Object.keys(attrs), children, selfClosed: false });
export const classesOf = (n) => (n.attrs.class ?? '').split(/\s+/).filter(Boolean);
