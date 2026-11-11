import { FIELD_DEFS, LIST_DEFS } from './managed-doc';

/**
 * The editable-field map (slice 5.5a), pure. It is DERIVED from a theme's own page templates, never written by hand: every `data-g4d-section` in a template is one
 * section (id, label, optional), and the bindings and repeaters used inside it say what the vendor can edit there.
 *
 *   field            a binding the vendor may write (it is in FIELD_DEFS)
 *   list             a repeater the vendor may edit (it is in LIST_DEFS)
 *   fromOfferings    a repeater of the vendor's own services or products: the site reads the Offerings or Catalogue, the manager never writes them
 *   visibilityOnly   the platform draws it (reviews, hours, booking, share, price blocks...): the vendor can only show or hide it
 *
 * Gaps are listed, not hidden: a standard page or section the theme does not have, plus the platform gaps that no theme can fill today.
 */
export interface EditorSection { id: string; label: string; optional: boolean; fields: string[]; lists: string[]; fromOfferings: boolean; visibilityOnly: boolean }
export interface EditorPage { key: string; sections: EditorSection[] }
export interface EditorMap { pages: EditorPage[]; gaps: string[] }

const STANDARD_PAGES = ['home', 'about', 'services', 'gallery', 'contact'] as const;
/** sections every site is expected to be able to show; a theme without one gets a gap line, nothing is invented for it */
const EXPECTED_SECTIONS = ['hero', 'about', 'services', 'faq', 'gallery', 'contact'] as const;
/** the repeater a template uses -> the list the vendor edits */
const REPEATER_LIST: Readonly<Record<string, string>> = { faqs: 'faqs', gallery: 'gallery', steps: 'steps', trust: 'trust', stats: 'stats', team: 'team', credentials: 'credentials' };
/** gaps no theme can fill today: the renderer has no landing-page template, no editable menu labels and no structured opening hours */
const PLATFORM_GAPS = ['landing-pages:no-template', 'navigation:renderer-menu-fixed', 'hours:free-text-only'] as const;

const SECTION_OPEN = /<section\b[^>]*\bdata-g4d-section="([^"]+)"[^>]*>/g;

export function deriveEditorMap(templates: Readonly<Record<string, string>>): EditorMap {
  const pages: EditorPage[] = [];
  const seen = new Set<string>();
  for (const [key, html] of Object.entries(templates)) {
    const marks = [...html.matchAll(SECTION_OPEN)];
    const sections: EditorSection[] = marks.map((m, i) => {
      const body = html.slice(m.index ?? 0, i + 1 < marks.length ? marks[i + 1].index : html.length);
      const bindings = new Set([...body.matchAll(/\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g)].map((x) => x[1]));
      const repeaters = new Set([...body.matchAll(/data-g4d-each="([a-z]+)"/g)].map((x) => x[1]));
      const fields = key === 'item' || key === 'page' ? [] : [...bindings].filter((b) => Object.prototype.hasOwnProperty.call(FIELD_DEFS, b)).sort();
      const lists = [...repeaters].map((r) => REPEATER_LIST[r]).filter((l): l is string => !!l && Object.prototype.hasOwnProperty.call(LIST_DEFS, l)).sort();
      const pageList = key === 'page' && m[1] === 'content' ? ['pages'] : [];
      const fromOfferings = repeaters.has('items') || repeaters.has('products') || (key === 'item' && m[1] === 'content');
      const all = [...lists, ...pageList];
      seen.add(m[1]);
      return {
        id: m[1], label: /data-g4d-label="([^"]*)"/.exec(m[0])?.[1] ?? m[1], optional: (/data-g4d-optional="([^"]*)"/.exec(m[0])?.[1] ?? 'true') !== 'false' && m[1] !== 'hero',
        fields, lists: all, fromOfferings, visibilityOnly: fields.length === 0 && all.length === 0 && !fromOfferings,
      };
    });
    pages.push({ key, sections });
  }
  const gaps: string[] = [];
  for (const p of STANDARD_PAGES) if (!templates[p]) gaps.push(`page:${p}`);
  for (const s of EXPECTED_SECTIONS) if (!seen.has(s)) gaps.push(`section:${s}`);
  gaps.push(...PLATFORM_GAPS);
  return { pages, gaps };
}

/** every section id of every page of a theme (the names a vendor may hide or reorder) */
export const sectionIdsOf = (m: EditorMap): string[] => [...new Set(m.pages.flatMap((p) => p.sections.map((s) => s.id)))];
/** the page keys a navigation menu may use: the theme's standard pages plus the extra pages the vendor has */
export const navPageKeysOf = (m: EditorMap, extraSlugs: readonly string[]): string[] => [...new Set([...m.pages.map((p) => p.key).filter((k) => !['item', 'page'].includes(k)), ...extraSlugs])];
