import { checkProfile, buildProfileSeed, resolveSchema, toSiteOps } from '../src/v3-profile-fields/core/profile-core';
import { emptyDoc, validateBrand, writeLocation } from '../src/v3-website/core/managed-doc';
import { readFileSync } from 'fs';
import { join } from 'path';

/** Website Manager lane A, E2: the three confirmations, pinned as tests so they cannot drift. */
const seed = buildProfileSeed([{ categoryKey: 'plumber', packKey: 'FIELD_SERVICE', fieldHints: [] }]);
const schema = resolveSchema(seed.fields, 'FIELD_SERVICE', 'plumber');

describe('opening_hours through the profile becomes the site hours rows', () => {
  it('text and ready-made rows are both accepted and give seven day rows for the site', () => {
    const fromText = checkProfile(schema, { business_name: 'R', opening_hours: 'Mon-Sat 09:00-18:00; Sun closed' });
    expect(fromText.ok).toBe(true);
    const rows = fromText.value.opening_hours as Array<{ day: string; open: string; close: string; closed: boolean }>;
    expect(rows).toHaveLength(7);
    expect(rows[0]).toEqual({ day: 'Mon', open: '09:00', close: '18:00', closed: false });
    expect(rows[6]).toMatchObject({ day: 'Sun', closed: true });
    const fromRows = checkProfile(schema, { business_name: 'R', opening_hours: rows });
    expect(fromRows.ok).toBe(true);
    expect(fromRows.value.opening_hours).toEqual(rows);
  });
  it('the mapping turns the value into one hours change for the site (the website manager draft)', () => {
    const v = checkProfile(schema, { business_name: 'R', opening_hours: 'Mon-Fri 09:00-17:00' });
    const ops = toSiteOps(schema, seed.maps, v.value, 'FIELD_SERVICE', 'plumber');
    expect(ops.some((o) => o.kind === 'hours' && (o as { rows: unknown[] }).rows.length === 5)).toBe(true);
  });
});

describe('PUT /draft/brand and /draft/location replace the whole object (intended, now stated in the route text)', () => {
  it('brand: whatever is not sent is cleared', () => {
    const first = validateBrand({ accent: '#0a7d4f', logo: 'https://media.example.test/logo.png' }, []);
    const second = validateBrand({ accent: '#112233' }, []);
    expect(first.ok && first.brand).toEqual({ accent: '#0a7d4f', logo: 'https://media.example.test/logo.png' });
    expect(second.ok && second.brand).toEqual({ accent: '#112233' });   // the logo is gone: the caller must send it again
  });
  it('location: parts not sent are cleared; an empty location removes it', () => {
    const a = writeLocation(emptyDoc(), { addressLine1: '1 Main Road', city: 'Madurai', pincode: '625001' });
    if (!a.ok) throw new Error('location');
    const b = writeLocation(a.doc, { city: 'Kochi' });
    expect(b.ok && b.doc.location).toEqual({ city: 'Kochi' });
    const c = writeLocation(a.doc, {});
    expect(c.ok && c.doc.location).toBeUndefined();
  });
});

describe('the theme upload: what the package manifest accepts (category, pack, add-ons; no price, no sub-category field)', () => {
  const schemaFile = JSON.parse(readFileSync(join(__dirname, '..', '..', 'themes', 'schema', 'theme.schema.json'), 'utf8')) as { properties: { marketplace: { properties: Record<string, unknown>; additionalProperties: boolean } } };
  const mk = schemaFile.properties.marketplace;
  it('names the industry packs and the catalogue categories, and the block is closed', () => {
    expect(Object.keys(mk.properties)).toEqual(expect.arrayContaining(['packs', 'catalogueCategories', 'addons', 'capabilities', 'tags']));
    expect(mk.additionalProperties).toBe(false);
  });
  it('has no price field and no separate sub-category field', () => {
    expect(Object.keys(mk.properties).filter((k) => /price|cost|fee|sub/i.test(k))).toEqual([]);
  });
});
