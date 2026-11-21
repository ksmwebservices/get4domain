// Which classes in a stylesheet animate, which of those start hidden, and how many animated elements a rendered page shows per section.
// Shared by the lint (motion-count, hero-visible) and the preview's Motion lab readout, so both use one definition.
import { classesIn } from './css.mjs';
import { classesOf } from './html.mjs';

const flattenIs = (sel) => sel.replace(/:(?:is|where)\(([^)]*)\)/g, ' $1 ');
export const MAX_ANIMATED_PER_SECTION = 12;
export const STAGGER_CHILDREN = 6;

/**
 * @param {{selectors:string[],decls:{prop:string,value:string}[]}[]} rules plain rules (no at-rules)
 * @param {Set<string>} hidingKeyframes names of @keyframes whose first frame has opacity 0
 */
export function motionSets(rules, hidingKeyframes = new Set()) {
  const animated = new Set(); const stagger = new Set(); const revealing = new Set();
  for (const r of rules) {
    const anim = r.decls.find((d) => d.prop === 'animation' || d.prop === 'animation-name');
    if (!anim || /^none\b/.test(anim.value)) continue;
    for (const c of r.selectors.flatMap((s) => classesIn(flattenIs(s)).filter((x) => x !== 'g4d-theme'))) {
      animated.add(c);
      if (hidingKeyframes.has(anim.value.split(/\s+/)[0])) revealing.add(c);
    }
    for (const s of r.selectors) for (const m of s.matchAll(/\.([\w-]+)\s*>/g)) stagger.add(m[1]);
  }
  return { animated, stagger, revealing };
}

/** Animated elements per section of a parsed page. An element with a stagger class counts as itself plus its first six children. */
export function countAnimated(nodes, sets) {
  const counts = new Map();
  const walk = (list, sec) => {
    for (const n of list) {
      if (n.type !== 'el') continue;
      const s = n.attrs['data-g4d-section'] ?? sec;
      const cl = classesOf(n);
      if (cl.some((c) => sets.animated.has(c))) {
        const kids = n.children.filter((k) => k.type === 'el').length;
        counts.set(s, (counts.get(s) ?? 0) + 1 + (cl.some((c) => sets.stagger.has(c)) ? Math.min(kids, STAGGER_CHILDREN) : 0));
      }
      walk(n.children, s);
    }
  };
  walk(nodes, '(page)');
  return counts;
}
