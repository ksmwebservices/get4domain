import * as path from 'path';

/**
 * Detects use of the LEGACY billing, BOS, commercial-engine and menu-gating tables or constants in a source file (owner decision D1: V3 never reads or
 * writes them). Returns a list of human-readable hits; empty = clean.
 * Imports are RESOLVED against src/: only the top-level legacy modules count, so V3's own src/plans/subscriptions/ is not mistaken for src/subscriptions/.
 */
const SRC = path.resolve(__dirname, '../../src');
const LEGACY_DELEGATES = [
  'subscription', 'invoice', 'billingTerm', 'billingDeal', 'planOverride', 'planChangeRequest', 'promoCode', 'manualPaymentSubmission',
  'specialArrangement', 'commercialAuditLog', 'paymentRecord', 'vendorAddon', 'vendorModule', 'genericInvoice',
];
const LEGACY_TABLES = [
  'Subscription', 'Invoice', 'BillingTerm', 'BillingDeal', 'PlanOverride', 'PlanChangeRequest', 'PromoCode', 'ManualPaymentSubmission',
  'SpecialArrangement', 'CommercialAuditLog', 'PaymentRecord', 'VendorAddon', 'VendorModule',
];
/** top-level src folders (and one constants file) that belong to the legacy billing / commercial / BOS / menu-gating world */
const LEGACY_TOP = ['registry', 'commercial', 'addons', 'bos', 'subscriptions', 'invoices', 'payments', 'vendor-payments', 'leadspace', 'domain-campaign', 'wallet'];
const DEFAULT_FILE = path.join(SRC, 'plans', 'x', 'y.ts');

export function findLegacyUse(source: string, fromFile: string = DEFAULT_FILE): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');   // comments may name legacy things
  const hits: string[] = [];
  const delegate = new RegExp(`\\b(?:prisma|tx|db)\\.(${LEGACY_DELEGATES.join('|')})\\b`, 'g');
  for (const m of code.matchAll(delegate)) hits.push(`delegate ${m[0]}`);
  const raw = new RegExp(`"(${LEGACY_TABLES.join('|')})"`, 'g');
  for (const m of code.matchAll(raw)) hits.push(`raw table ${m[0]}`);
  for (const m of code.matchAll(/from\s+'([^']+)'/g)) {
    const spec = m[1];
    if (!spec.startsWith('.')) continue;
    const rel = path.relative(SRC, path.resolve(path.dirname(fromFile), spec));
    const top = rel.split(path.sep)[0];
    if (!rel.startsWith('..') && (LEGACY_TOP.includes(top) || /plan-pricing\.constants/.test(rel))) hits.push(`import ${spec}`);
  }
  return hits;
}
