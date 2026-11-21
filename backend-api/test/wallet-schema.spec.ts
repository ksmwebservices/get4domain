import { LEGACY_MODELS, migrationSql, missingColumns, modelBlock, schemaText } from './support/schema-checks';

/**
 * Batch 4 slices 5.16a and 5.16a-2: the wallet tables and their two migration folders. No database here: the migration text and the Prisma model are checked, and the staging suite
 * (wallet.int.spec.ts) proves the constraints and the trigger on a real database. The V3 wallet table is g4d_v3_wallets because g4d_wallets is the LEGACY wallet (decision D1).
 */
const wallet = migrationSql('_v3_wallet'); const lots = migrationSql('_v3_wallet_lots');
const TABLES = ['g4d_v3_wallets', 'g4d_wallet_ledger', 'g4d_wallet_topups', 'g4d_wallet_receipts'];

describe('slice 5.16a: migration folder', () => {
  it('exists, and is the folder right before the lots folder', () => { expect(wallet.name).toBe('20261117100000_v3_wallet'); expect(lots.name).toBe('20261118100000_v3_wallet_lots'); expect(wallet.code.length).toBeGreaterThan(1000); });
  it('is additive: no DROP, RENAME, TRUNCATE, DELETE FROM, UPDATE of a row or ALTER COLUMN', () => {
    for (const m of [wallet, lots]) expect(m.code).not.toMatch(/\bDROP\b|\bTRUNCATE\b|\bRENAME\b|\bDELETE\s+FROM\b|\bUPDATE\s+"|\bALTER COLUMN\b/i);
  });
  it('creates each table with row level security on', () => { for (const t of TABLES) { expect(wallet.code).toContain(`CREATE TABLE "${t}"`); expect(wallet.code).toContain(`ALTER TABLE "${t}" ENABLE ROW LEVEL SECURITY`); } });
  it('never touches the legacy wallet tables (g4d_wallets, g4d_wallet_transactions) as an object', () => {
    for (const m of [wallet, lots]) { expect(m.code).not.toMatch(/(TABLE|ON|REFERENCES|FROM)\s+"g4d_wallets"/); expect(m.code).not.toMatch(/"g4d_wallet_transactions"/); }
  });
  it('foreign keys point only at Vendor or at the wallet tables', () => {
    for (const m of [wallet, lots]) for (const x of m.code.matchAll(/REFERENCES "([A-Za-z_0-9]+)"/g)) expect(['Vendor', ...TABLES, 'g4d_wallet_lots']).toContain(x[1]);
  });
  it('the database refuses a negative balance, negative held money, held above balance, and a non-positive top-up', () => {
    expect(wallet.code).toMatch(/"g4d_v3_wallets_amounts_chk" CHECK \("balancePaise" >= 0 AND "heldPaise" >= 0 AND "heldPaise" <= "balancePaise"\)/);
    expect(wallet.code).toMatch(/"g4d_wallet_ledger_after_chk" CHECK \("balanceAfterPaise" >= 0 AND "heldAfterPaise" >= 0 AND "heldAfterPaise" <= "balanceAfterPaise"\)/);
    expect(wallet.code).toMatch(/"g4d_wallet_topups_amount_chk" CHECK \("amountPaise" > 0\)/);
  });
  it('the ledger is append-only: a trigger refuses every update and every delete, except the cascade of a wallet that is already gone', () => {
    expect(wallet.code).toContain('CREATE OR REPLACE FUNCTION g4d_wallet_ledger_immutable()');
    expect(wallet.code).toMatch(/BEFORE UPDATE OR DELETE ON "g4d_wallet_ledger" FOR EACH ROW/);
    expect(wallet.code).toMatch(/RAISE EXCEPTION 'g4d_wallet_ledger rows cannot be changed'/);
    expect(wallet.code).toMatch(/IF EXISTS \(SELECT 1 FROM "g4d_v3_wallets" WHERE "id" = OLD\."walletId"\) THEN\s+RAISE EXCEPTION 'g4d_wallet_ledger rows cannot be deleted'/);
  });
  it('every dollar-quoted block is closed', () => { for (const m of [wallet, lots]) expect((m.code.match(/\$\$/g) ?? []).length % 2).toBe(0); });
});

describe('slice 5.16a-2: the lots folder holds only the lots', () => {
  it('creates g4d_wallet_lots, its enums, its checks and RLS, and nothing else', () => {
    expect(lots.code).toContain('CREATE TABLE "g4d_wallet_lots"'); expect(lots.code).toContain('ALTER TABLE "g4d_wallet_lots" ENABLE ROW LEVEL SECURITY');
    expect(lots.code.match(/CREATE TABLE/g)).toHaveLength(1);
    expect(lots.code).toMatch(/"g4d_wallet_lots_amounts_chk" CHECK \("remainingPaise" >= 0 AND "remainingPaise" <= "amountPaise" AND "amountPaise" > 0\)/);
    expect(wallet.code).not.toMatch(/g4d_wallet_lots|V3WalletLot/);
  });
});

describe('models', () => {
  it('every wallet model has a cuid id and no relation to a legacy model', () => {
    for (const t of [...TABLES, 'g4d_wallet_lots']) {
      const b = modelBlock(t); expect(b).not.toBe(''); expect(b).toMatch(/\bid\s+String\s+@id\s+@default\(cuid\(\)\)/);
      for (const l of LEGACY_MODELS) expect(b).not.toMatch(new RegExp(`\\b${l}\\b`));
    }
  });
  it('the wallet: one per vendor, integer paise, a version for the last-resort check, the billing profile for the tax rule', () => {
    const b = modelBlock('g4d_v3_wallets');
    expect(missingColumns(b, ['vendorId', 'status', 'balancePaise', 'heldPaise', 'entryCount', 'version', 'activatedAt', 'activatedByEventId', 'frozenReason', 'billingStateCode', 'billingGstin'])).toEqual([]);
    expect(b).toMatch(/vendorId\s+String\s+@unique/); expect(b).toMatch(/balancePaise\s+Int\b/); expect(b).toMatch(/heldPaise\s+Int\b/);
    expect(b).toMatch(/^model V3Wallet \{/);
    expect(modelBlock('g4d_wallets')).toMatch(/^model Wallet \{/);   // the legacy model keeps its own table, untouched
    expect(modelBlock('g4d_wallets')).not.toMatch(/V3/);
  });
  it('the ledger: signed integer paise, the running totals, a key unique per wallet, one settlement per hold, one reversal per charge', () => {
    const b = modelBlock('g4d_wallet_ledger');
    expect(missingColumns(b, ['walletId', 'vendorId', 'entryNo', 'kind', 'amountPaise', 'balanceDeltaPaise', 'heldDeltaPaise', 'balanceAfterPaise', 'heldAfterPaise', 'refType', 'refId', 'idempotencyKey', 'holdId', 'reversesId', 'reason', 'actorType', 'actorId', 'lotUsesJson', 'at'])).toEqual([]);
    expect(b).toMatch(/@@unique\(\[walletId, idempotencyKey\]\)/); expect(b).toMatch(/@@unique\(\[walletId, entryNo\]\)/); expect(b).toMatch(/@@unique\(\[holdId\]\)/); expect(b).toMatch(/@@unique\(\[reversesId\]\)/);
    expect(b).toMatch(/amountPaise\s+Int\b/);
    expect(missingColumns(b, ['updatedAt', 'deletedAt'])).toEqual(['updatedAt', 'deletedAt']);   // append-only: nothing to update, nothing to soft delete
  });
  it('top-ups: a provider order id and an idempotency key unique per vendor; receipts: one per top-up with a unique number and a document type', () => {
    expect(modelBlock('g4d_wallet_topups')).toMatch(/providerOrderId\s+String\?\s+@unique/); expect(modelBlock('g4d_wallet_topups')).toMatch(/@@unique\(\[vendorId, idempotencyKey\]\)/);
    const r = modelBlock('g4d_wallet_receipts'); expect(r).toMatch(/topupId\s+String\s+@unique/); expect(r).toMatch(/receiptNumber\s+String\s+@unique/); expect(r).toMatch(/documentType\s+String\s+@default\("RECEIPT"\)/);
  });
  it('lots: remaining and original amounts, an expiry date, one lot per top-up', () => {
    const b = modelBlock('g4d_wallet_lots');
    expect(missingColumns(b, ['walletId', 'vendorId', 'topupId', 'source', 'amountPaise', 'remainingPaise', 'expiresAt', 'status'])).toEqual([]);
    expect(b).toMatch(/topupId\s+String\?\s+@unique/);
  });
  it('the enums exist', () => { for (const e of ['V3WalletStatus', 'V3WalletLedgerKind', 'V3WalletTopupStatus', 'V3WalletLotStatus', 'V3WalletLotSource']) expect(schemaText).toMatch(new RegExp(`^enum ${e} \\{`, 'm')); });
  it('the ledger kinds are exactly the nine the owner rules name', () => {
    const body = /^enum V3WalletLedgerKind \{([\s\S]*?)\}/m.exec(schemaText)![1];
    expect(body.split('\n').map((l) => l.trim()).filter(Boolean)).toEqual(['TOPUP', 'HOLD', 'RELEASE', 'CHARGE', 'REVERSAL', 'EXPIRY', 'ADJUSTMENT', 'PACK_PURCHASE', 'PLAN_RENEWAL']);
  });
});
