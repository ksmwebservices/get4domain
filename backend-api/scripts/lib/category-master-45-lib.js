'use strict';
/** Pure helpers for lane E1: parse the owner's input file and build the master data. No file or database access. */

/** Stable slug: lowercase, "&" read as "and", every run of other characters becomes one hyphen. */
function slugify(name) {
  return String(name).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Input lines: "NN. FAMILY NAME" then one line of comma separated names ending in a full stop. Returns [{ order, name, items[] }]. */
function parseInput(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const families = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\d{2})\.\s+(.+)$/.exec(lines[i]);
    if (!m) throw new Error(`unexpected line ${i + 1}: ${lines[i].slice(0, 60)}`);
    const body = lines[++i];
    if (body === undefined || /^\d{2}\.\s/.test(body)) throw new Error(`family ${m[1]} has no list`);
    const items = body.replace(/\.$/, '').split(',').map((s) => s.trim()).filter(Boolean);
    families.push({ order: Number(m[1]), name: m[2].trim(), items });
  }
  return families;
}

const KEEP_UPPER = new Set(['IT']);
const titleCase = (s) => s.split(/(\s+)/).map((w) => (KEEP_UPPER.has(w.replace(/[^A-Za-z]/g, '')) ? w : w.charAt(0) + w.slice(1).toLowerCase())).join('');

/**
 * families: [{ order, name, items }] -> { source, version, families[{ order, slug, name, plannedPackKey }], categories[{ slug, name }], links[{ family, category }] }.
 * A category name that appears in several families is ONE category (same slug) with several links; a name repeated inside one family is linked once.
 * The first spelling seen is the stored name. Two different names with the same slug would silently merge, so that is reported as an error.
 */
function buildMaster(parsed, { source = 'REQ_CATEGORY_MASTER_45_FAMILIES', version = 1 } = {}) {
  const families = [];
  const categories = new Map();
  const links = [];
  const listed = { n: 0 };
  const seenFamily = new Set();
  for (const f of parsed) {
    const slug = slugify(f.name);
    if (seenFamily.has(slug)) throw new Error(`duplicate family slug ${slug}`);
    seenFamily.add(slug);
    families.push({ order: f.order, slug, name: titleCase(f.name), plannedPackKey: slug.toUpperCase().replace(/-/g, '_') });
    const inFamily = new Set();
    for (const raw of f.items) {
      listed.n++;
      const cs = slugify(raw);
      if (!cs) throw new Error(`empty slug for "${raw}"`);
      const known = categories.get(cs);
      if (!known) categories.set(cs, { slug: cs, name: raw });
      if (!inFamily.has(cs)) { inFamily.add(cs); links.push({ family: slug, category: cs }); }
    }
  }
  return {
    source, version, listedLinks: listed.n,
    families,
    categories: [...categories.values()].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0)),
    links,
  };
}

module.exports = { slugify, parseInput, buildMaster, titleCase };
