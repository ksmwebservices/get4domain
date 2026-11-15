import { DEFAULT_SEO_TEMPLATES, SEO_PAGE_TYPES } from '../src/seo-directory/core/default-templates';
import { buildDescription, buildH1, buildTitle, cutWords, fillTemplate, placeholdersIn, SEO_PLACEHOLDERS, titleCase } from '../src/seo-directory/core/template-engine';
import { resolveSeoTemplates, seoTemplatesProblem } from '../src/seo-directory/settings/seo-settings';

const T = DEFAULT_SEO_TEMPLATES;

describe('template filling', () => {
  it('fills every placeholder, and returns null when one has no value', () => {
    expect(fillTemplate('{categoryPlural} in {locality}, {city}', { categoryPlural: 'Plumbers', locality: 'Nungambakkam', city: 'Chennai' })).toBe('Plumbers in Nungambakkam, Chennai');
    expect(fillTemplate('{categoryPlural} in {locality}, {city}', { categoryPlural: 'Plumbers', city: 'Chennai' })).toBeNull();
    expect(fillTemplate('{x}', {})).toBeNull();
    expect(fillTemplate('Find {count} plumbers', { count: 0 })).toBe('Find 0 plumbers');
    expect(fillTemplate('Find {count} plumbers', { count: '' })).toBeNull();
  });
  it('lists the placeholders used', () => { expect(placeholdersIn('{a} and {b} {a}')).toEqual(['a', 'b', 'a']); });
  it('title-cases a category name but keeps small words low', () => { expect(titleCase('pumps and motors supplier')).toBe('Pumps and Motors Supplier'); });
});

describe('truncation at a word boundary', () => {
  it('leaves short text alone and never cuts a word', () => {
    expect(cutWords('Plumbers in Chennai', 60)).toBe('Plumbers in Chennai');
    expect(cutWords('Agricultural machinery dealers in Nungambakkam', 29)).toBe('Agricultural machinery');
    expect(cutWords('Plumbers, in', 9)).toBe('Plumbers');
  });
  it('a single word longer than the room is cut hard rather than dropped', () => { expect(buildTitle(['{vendorName}'], { vendorName: 'A'.repeat(80) }).length).toBeLessThanOrEqual(60); });
});

describe('titles', () => {
  const v = { categoryPlural: 'Plumbers', locality: 'Nungambakkam', city: 'Chennai' };
  it('uses the full template and adds the brand when the whole title fits in 60', () => {
    expect(buildTitle(T.localityCategory.title, v)).toBe('Plumbers in Nungambakkam, Chennai | Get4Domain');
  });
  it('falls back to a shorter template when a placeholder is missing', () => {
    expect(buildTitle(T.localityCategory.title, { categoryPlural: 'Plumbers', city: 'Chennai' })).toBe('Plumbers in Chennai | Get4Domain');
  });
  it('shortens the keyword part, never the brand, when it does not fit', () => {
    const t = buildTitle(T.localityCategory.title, { categoryPlural: 'Agricultural Machinery Dealers', locality: 'Thiruvanmiyur Industrial Estate', city: 'Chennai' });
    expect(t.length).toBeLessThanOrEqual(60);
    expect(t.endsWith(' | Get4Domain')).toBe(true);
  });
  it('page 2 and later say "Page N" before the brand and still fit', () => {
    const t = buildTitle(T.localityCategory.title, v, { page: 2 });
    expect(t).toBe('Plumbers in Nungambakkam, Chennai - Page 2 | Get4Domain');
    expect(t.length).toBeLessThanOrEqual(60);
    expect(buildTitle(T.localityCategory.title, v, { page: 1 })).toBe('Plumbers in Nungambakkam, Chennai | Get4Domain');
  });
  it('a long title with a page marker keeps both the marker and the brand', () => {
    const t = buildTitle(T.localityCategory.title, { categoryPlural: 'Agricultural Machinery Dealers', locality: 'Thiruvanmiyur Industrial Estate', city: 'Chennai' }, { page: 12 });
    expect(t.length).toBeLessThanOrEqual(60);
    expect(t).toMatch(/ - Page 12 \| Get4Domain$/);
  });
  it('drops the brand only when asked (a vendor site on a custom domain)', () => { expect(buildTitle(T.cityCategory.title, v, { brand: false })).toBe('Plumbers in Chennai'); });
  it('is never blank', () => {
    expect(buildTitle(T.localityCategory.title, {})).toBe('Get4Domain');
    expect(buildTitle([], {})).toBe('Get4Domain');
    expect(buildTitle(['{x}'], {}, { page: 3 })).toBe('Get4Domain - Page 3');
  });
  it('refuses a price or a retired product name in a filled title', () => { expect(buildTitle(['{vendorName} from ₹999', '{vendorName}'], { vendorName: 'Acme' })).toBe('Acme | Get4Domain'); });
  it('different pages give different titles', () => {
    const a = buildTitle(T.localityCategory.title, v); const b = buildTitle(T.localityCategory.title, { ...v, locality: 'Adyar' });
    expect(a).not.toBe(b);
  });
});

describe('descriptions and H1', () => {
  const v = { categoryPlural: 'Plumbers', locality: 'Nungambakkam', city: 'Chennai', count: 12 };
  it('fills the default and stays within 160', () => {
    const d = buildDescription(T.localityCategory.description, v);
    expect(d).toBe('Find 12 Plumbers in Nungambakkam, Chennai: addresses, services and websites.');
    expect(d.length).toBeLessThanOrEqual(160);
  });
  it('without a count it falls to a shorter template instead of printing nothing', () => { expect(buildDescription(T.localityCategory.description, { ...v, count: undefined })).toBe('Plumbers in Nungambakkam, Chennai: addresses, services and websites.'); });
  it('cuts a too long description at a word with a full stop', () => {
    const d = buildDescription(['{vendorName}'], { vendorName: 'word '.repeat(60) });
    expect(d.length).toBeLessThanOrEqual(160);
    expect(d.endsWith('.')).toBe(true);
  });
  it('falls back to a brand sentence when nothing fills', () => { expect(buildDescription(['{x}'], {})).toContain('Get4Domain'); });
  it('H1 is the first filled candidate, else the brand', () => {
    expect(buildH1(T.localityCategory.h1, v)).toBe('Plumbers in Nungambakkam, Chennai');
    expect(buildH1(T.localityCategory.h1, { categoryPlural: 'Plumbers', city: 'Chennai' })).toBe('Plumbers in Chennai');
    expect(buildH1(['{x}'], {})).toBe('Get4Domain');
  });
  it('home and the directory pages carry get4domain.com in the default description', () => {
    expect(buildDescription(T.home.description, {})).toContain('get4domain.com');
    expect(buildDescription(T.city.description, { city: 'Chennai', count: 4 })).toContain('get4domain.com');
    expect(buildDescription(T.category.description, { categoryPlural: 'Plumbers', count: 4 })).toContain('get4domain.com');
  });
});

describe('default templates', () => {
  it('cover every page type, use only known placeholders, carry no markup, price or banned word', () => {
    const known = new Set<string>(SEO_PLACEHOLDERS);
    for (const type of SEO_PAGE_TYPES) {
      for (const field of ['title', 'description', 'h1'] as const) {
        expect(T[type][field].length).toBeGreaterThan(0);
        for (const t of T[type][field]) { expect(placeholdersIn(t).every((p) => known.has(p))).toBe(true); expect(t).not.toMatch(/[<>₹]/); expect(t).not.toMatch(/Workspace|BOS|LeadSpace/); }
      }
    }
    expect(seoTemplatesProblem(T)).toBeNull();
  });
  it('the last title candidate of every directory page needs at most the placeholders a page always has', () => {
    expect(buildTitle(T.business.title, { vendorName: 'Ranjith Plumber' })).toBe('Ranjith Plumber | Get4Domain');
    expect(buildTitle(T.vendorPage.title, { pageName: 'Services', vendorName: 'Ranjith Plumber' })).toBe('Services | Ranjith Plumber | Get4Domain');
  });
});

describe('stored templates', () => {
  it('overlay the defaults one field at a time', () => {
    const r = resolveSeoTemplates({ cityCategory: { title: ['Local {categoryPlural} in {city}'] } });
    expect(r.cityCategory.title).toEqual(['Local {categoryPlural} in {city}']);
    expect(r.cityCategory.description).toEqual(T.cityCategory.description);
    expect(r.home).toEqual(T.home);
  });
  it('an invalid stored value is ignored whole, so a bad edit cannot blank a title', () => {
    expect(resolveSeoTemplates({ cityCategory: { title: [''] } })).toEqual(T);
    expect(resolveSeoTemplates('nonsense')).toEqual(T);
    expect(resolveSeoTemplates(undefined)).toEqual(T);
  });
  it('validation names the problem', () => {
    expect(seoTemplatesProblem([])).toMatch(/object/);
    expect(seoTemplatesProblem({ nope: {} })).toMatch(/not a page type/);
    expect(seoTemplatesProblem({ home: { title: [] } })).toMatch(/1 to 6/);
    expect(seoTemplatesProblem({ home: { title: ['{bogus}'] } })).toMatch(/not a placeholder/);
    expect(seoTemplatesProblem({ home: { title: ['<b>x</b>'] } })).toMatch(/markup/);
    expect(seoTemplatesProblem({ home: { title: ['From ₹999 {city}'] } })).toMatch(/price/);
    expect(seoTemplatesProblem({ home: { title: ['x'.repeat(201)] } })).toMatch(/200/);
    expect(seoTemplatesProblem({ home: { heading: ['x'] } })).toMatch(/title, description or h1/);
    expect(seoTemplatesProblem({ home: { title: ['Local {category} in {city}'] } })).toBeNull();
  });
});
