// Generates the tables inside themes/CONTRACT.md from the code, so the document cannot drift from the data.
import { CATEGORIES, FAMILIES, TRACK_LABELS } from './categories.mjs';
import { SLOTS, REQUIRED_SLOTS_ALL, GATED_SLOTS } from './vocabulary.mjs';

const cell = (s) => String(s).replace(/\|/g, '\\|');

export function categoryTable() {
  const head = '| # | Category id | Label | Track | V3 family | Schema type | Primary call to action | Extra blocks (first is shown first) | Flow (as built) | Pack (as built) |\n|---:|---|---|---|---|---|---|---|---|---|';
  const rows = CATEGORIES.map((c, i) => `| ${i + 1} | \`${c.id}\` | ${cell(c.label)} | ${TRACK_LABELS[c.track]} | \`${c.family}\` | ${c.schemaType} | ${cell(c.ctaPrimary)} | ${c.extraBlocks.map((b) => `\`${b}\``).join(', ')} | \`${c.flow}\` | \`${c.packKey}\` |`);
  return `${head}\n${rows.join('\n')}`;
}

export function variantTable() {
  const head = '| V3 family | Track | Variant id | Hero | Header | Services | Secondary | Card | Divider | Decor | Default motion | Notes |\n|---|---|---|---|---|---|---|---|---|---|---|---|';
  const rows = Object.entries(FAMILIES).map(([id, f]) => {
    const v = f.variant;
    return `| \`${id}\` | ${TRACK_LABELS[f.track]} | \`${v.id}\` | ${v.hero} | ${v.header} | ${v.services} | ${v.secondaryServices ?? '-'} | ${v.card} | ${v.divider} | ${v.decor} | ${v.motion} | ${cell(v.notes)} |`;
  });
  return `${head}\n${rows.join('\n')}`;
}

export function slotTable() {
  const head = '| Slot | Tag in a template | Origin | Required in a theme | Drawn when |\n|---|---|---|---|---|';
  const rows = Object.entries(SLOTS).map(([name, s]) => {
    const req = REQUIRED_SLOTS_ALL.includes(name) ? 'every theme' : name === 'product-grid' ? 'Ecommerce categories' : 'optional';
    const when = GATED_SLOTS[name] ? `the vendor has the \`${GATED_SLOTS[name]}\` entitlement` : name === 'claim-banner' ? 'the page is unclaimed' : 'always (when it has something to show)';
    return `| \`${name}\` | \`<${s.tag}>\` | ${s.as === 'engine' ? 'as built' : 'V3 addition'} | ${req} | ${when} |`;
  });
  return `${head}\n${rows.join('\n')}`;
}

export const GENERATED_BLOCKS = { categories: categoryTable, variants: variantTable, slots: slotTable };

const re = (name) => new RegExp(`(<!-- GENERATED:${name}:START -->)[\\s\\S]*?(<!-- GENERATED:${name}:END -->)`);

/** Replaces every generated block in `doc`. Returns the new text. */
export function renderDoc(doc) {
  let out = doc;
  for (const [name, fn] of Object.entries(GENERATED_BLOCKS)) {
    if (!re(name).test(out)) throw new Error(`CONTRACT.md has no GENERATED:${name} block`);
    out = out.replace(re(name), (_m, a, b) => `${a}\n${fn()}\n${b}`);
  }
  return out;
}
