/**
 * Add-on eligibility (Wave 2 Part H2): which add-on packs a pack may buy, as DATA (table g4d_addon_eligibility), seeded by the migration and editable by staff. Pure: no database, no clock.
 *
 * The owner's rules are written here ONCE and used twice: the edit route refuses a row that breaks one, and the check that decides what a business sees ignores such a row even if one was
 * written some other way. Everything else is data. A second case for HOME_SAMPLE_COLLECTION ("direct", not yet defined) is simply one more row that staff add through the route.
 */
export const ADDON_SHOP = 'SHOP';
export const ADDON_ORDERING = 'ONLINE_ORDERING_DELIVERY';
export const ADDON_PHARMACY_COUNTER = 'PHARMACY_COUNTER';
export const ADDON_HOME_SAMPLE = 'HOME_SAMPLE_COLLECTION';
export const PHARMACY_PACK = 'PHARMACY';
export const LAB_PACK = 'LAB';

/**
 * The packs that SELL GOODS, derived from the pack catalogue (prisma/seed/pack-engine): a pack is here when its sheet lists products, a catalogue, a menu, parts or product sales, or its engine
 * flags say it holds stock. PHARMACY sells goods too but is NEVER listed (owner rule). The owner confirms this list; changing it later is a data edit, not a release.
 */
export const GOODS_PACKS: readonly string[] = ['RETAIL', 'FOOD_SERVICE', 'MEMBERSHIP_WELLNESS', 'VEHICLE_SERVICE', 'B2B_DEALER'];
export const GOODS_ADDONS: readonly string[] = [ADDON_SHOP, ADDON_ORDERING];

export interface EligibilityRow { addonKey: string; packKey: string; active: boolean }

/** The first state of the table. The migration inserts exactly these rows (test/wave2-addon-eligibility.spec.ts compares the two). */
export const ELIGIBILITY_SEED: ReadonlyArray<{ addonKey: string; packKey: string }> = [
  ...GOODS_ADDONS.flatMap((addonKey) => GOODS_PACKS.map((packKey) => ({ addonKey, packKey }))),
  { addonKey: ADDON_PHARMACY_COUNTER, packKey: PHARMACY_PACK },
  { addonKey: ADDON_HOME_SAMPLE, packKey: LAB_PACK },
];

/** The owner's fixed rules. Returns why a pairing is not allowed, or null when it may be a row. */
export function eligibilityRuleBroken(addonKey: string, packKey: string): string | null {
  if (GOODS_ADDONS.includes(addonKey) && packKey === PHARMACY_PACK) return `${addonKey} is never offered to the pharmacy pack`;
  if (addonKey === ADDON_PHARMACY_COUNTER && packKey !== PHARMACY_PACK) return `${ADDON_PHARMACY_COUNTER} is only for the pharmacy pack`;
  return null;
}

/** May a business on this pack buy this add-on? A row must exist and be active, and the fixed rules must hold. No pack (no registration yet) means no. */
export function isEligible(rows: readonly EligibilityRow[], addonKey: string, packKey: string | null): boolean {
  if (!packKey || eligibilityRuleBroken(addonKey, packKey) !== null) return false;
  return rows.some((r) => r.addonKey === addonKey && r.packKey === packKey && r.active);
}

export interface EligibilityEdit { addonKey: string; packKey: string; active: boolean }
/** Problems with one staff edit, given the add-on keys and pack keys that exist. Empty when it is fine. */
export function checkEligibilityEdit(e: EligibilityEdit, addonKeys: ReadonlySet<string>, packKeys: ReadonlySet<string>): string[] {
  const p: string[] = [];
  if (!addonKeys.has(e.addonKey)) p.push(`add-on pack ${e.addonKey} does not exist`);
  if (!packKeys.has(e.packKey)) p.push(`pack ${e.packKey} does not exist`);
  if (e.active) { const broken = eligibilityRuleBroken(e.addonKey, e.packKey); if (broken) p.push(broken); }
  return p;
}
