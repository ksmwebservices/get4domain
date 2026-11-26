import { CHECK_LABELS, evaluateIndexing, indexingChecklist, readiness } from '../src/site-publish/seo/indexing-rule';

/** Website Manager lane A, item g: staff see, per vendor, what is missing for the site to be indexable, as a checklist. */
const base = { businessName: 'Ravi Plumbing', categoryId: 'plumber', claimed: true, verifiedContact: true, address: '1 Main Road', serviceAreas: 0, homeContent: true, forceNoindex: false };

describe('the indexing checklist', () => {
  it('a complete vendor has every check ticked and is ready', () => {
    const r = readiness(evaluateIndexing(base).missing, false, true);
    expect(r.indexable).toBe(true);
    expect(r.checklist.map((c) => c.code)).toEqual(['BUSINESS_NAME', 'CATEGORY', 'CLAIMED', 'VERIFIED_CONTACT', 'ADDRESS_OR_SERVICE_AREA', 'HOME_CONTENT', 'FORCE_NOINDEX']);
    expect(r.checklist.every((c) => c.done)).toBe(true);
    expect(r.needsRebuild).toBe(false);
  });

  it('each missing fact is an open item with its own wording: claimed, address or service area, home content, category, forced noindex', () => {
    const open = (patch: object) => readiness(evaluateIndexing({ ...base, ...patch }).missing, false, null).checklist.filter((c) => !c.done).map((c) => c.code);
    expect(open({ claimed: false, verifiedContact: false })).toEqual(['CLAIMED', 'VERIFIED_CONTACT']);
    expect(open({ address: '', serviceAreas: 0 })).toEqual(['ADDRESS_OR_SERVICE_AREA']);
    expect(open({ address: '', serviceAreas: 2 })).toEqual([]);
    expect(open({ homeContent: false })).toEqual(['HOME_CONTENT']);
    expect(open({ categoryId: null })).toEqual(['CATEGORY']);
    expect(open({ forceNoindex: true })).toEqual(['FORCE_NOINDEX']);
    expect(open({ businessName: ' ' })).toEqual(['BUSINESS_NAME']);
  });

  it('a seeded page is judged by the setting and the quality check, not by the claim', () => {
    const seededOff = evaluateIndexing({ ...base, claimed: false, verifiedContact: false, seeded: { mode: 'OFF', qualityOk: true } }).missing;
    expect(indexingChecklist(seededOff, true).filter((c) => !c.done).map((c) => c.code)).toEqual(['SEEDED_INDEXING_OFF']);
    const seededThin = evaluateIndexing({ ...base, claimed: false, verifiedContact: false, seeded: { mode: 'QUALITY', qualityOk: false } }).missing;
    expect(indexingChecklist(seededThin, true).filter((c) => !c.done).map((c) => c.code)).toEqual(['SEEDED_QUALITY']);
    expect(indexingChecklist(seededOff, true).map((c) => c.code)).not.toContain('CLAIMED');
  });

  it('ready but the published page still says noindex = a rebuild is needed; not ready = no rebuild is asked for', () => {
    expect(readiness([], false, false)).toMatchObject({ indexable: true, publishedIndexable: false, needsRebuild: true });
    expect(readiness([], false, null).needsRebuild).toBe(false);
    expect(readiness([{ code: 'CLAIMED' }], false, false)).toMatchObject({ indexable: false, needsRebuild: false });
  });

  it('every item has plain wording and a code of the rule', () => {
    for (const c of indexingChecklist([], false).concat(indexingChecklist([], true))) { expect(CHECK_LABELS[c.code]).toBe(c.label); expect(c.label.length).toBeGreaterThan(10); }
  });
});
