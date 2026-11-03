/* eslint-disable @typescript-eslint/no-require-imports */
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';

const cleanup = require('../../scripts/staging/test-tenant-cleanup');

/** Every row is tagged so cleanup targets only synthetic data: email @v3test.invalid AND businessName starting with V3TEST. */
export interface SeededTenant {
  label: string;
  vendorId: string;
  email: string;
  marker: string;                 // unique text embedded in every row; must never appear in another tenant's responses
  token: string;                  // the vendor owner
  memberToken: string;            // a team member of this vendor (modules: telecrm, website, accounts)
  ids: { contact: string; disposableContact: string; catalogItem: string; record: string; invoice: string; lead: string; product: string; notification: string; member: string };
}

const jwt = () => new JwtService({ secret: process.env.JWT_SECRET });
const sign = (payload: Record<string, unknown>): string => jwt().sign(payload, { expiresIn: '15m' });

/** The owner's JWT for any vendor row (for vendors a test did not create with seedTenant, for example one made by a provisioning job). */
export const vendorToken = (vendorId: string, email: string): string => sign({ sub: vendorId, email, role: 'VENDOR' });

export function newPrisma(): PrismaClient {
  return new PrismaClient({ datasourceUrl: process.env.DATABASE_URL, log: [] });
}

export async function seedTenant(prisma: PrismaClient, label: string, runId: string): Promise<SeededTenant> {
  const email = `${label}-${runId}@v3test.invalid`;
  const marker = `SECRET-${label.toUpperCase()}-${runId}`;
  const vendor = await prisma.vendor.create({
    data: { name: `V3TEST ${label}`, email, password: 'not-a-real-hash', businessName: `V3TEST ${label} ${runId}` },
  });
  const vendorId = vendor.id;
  const contact = await prisma.contact.create({ data: { vendorId, name: `${marker} contact`, phone: '9000000001' } });
  // Nothing references this one, so the owner-side DELETE control can succeed (the main contact is referenced by a record and an invoice).
  const disposableContact = await prisma.contact.create({ data: { vendorId, name: `${marker} disposable`, phone: '9000000003' } });
  const catalogItem = await prisma.catalogItem.create({ data: { vendorId, name: `${marker} item`, price: 10 } });
  const record = await prisma.record.create({ data: { vendorId, date: new Date(), contactId: contact.id, catalogItemId: catalogItem.id, notes: marker } });
  const invoice = await prisma.genericInvoice.create({
    data: {
      vendorId, contactId: contact.id, invoiceNumber: `INV-V3T-${runId}-${label}`,
      items: [{ description: marker, quantity: 1, rate: 100 }], subtotal: 100, total: 100,
    },
  });
  const lead = await prisma.campaignLead.create({ data: { vendorId, name: `${marker} lead`, phone: '9000000002' } });
  const product = await prisma.vendorProduct.create({ data: { vendorId, name: `${marker} product`, trackStock: true, stockQty: 5 } });
  const notification = await prisma.notification.create({
    data: { recipientId: vendorId, recipientType: 'vendor', type: 'TEST', title: marker, message: marker },
  });
  const member = await prisma.teamMember.create({
    data: { vendorId, name: 'V3TEST member', role: 'staff', modules: ['telecrm', 'website', 'accounts'], status: 'active', email: `member-${label}-${runId}@v3test.invalid` },
  });
  return {
    label, vendorId, email, marker,
    token: sign({ sub: vendorId, email, role: 'VENDOR' }),
    memberToken: sign({ sub: vendorId, email: member.email, role: 'VENDOR', kind: 'team_member', memberId: member.id }),
    ids: {
      contact: contact.id, disposableContact: disposableContact.id, catalogItem: catalogItem.id, record: record.id, invoice: invoice.id,
      lead: lead.id, product: product.id, notification: notification.id, member: member.id,
    },
  };
}

/** An extra team member of `vendorId` with exactly the given team areas (e.g. ['telecrm'] = no 'accounts'). Returns the member's JWT. */
export async function seedMember(prisma: PrismaClient, vendorId: string, label: string, runId: string, modules: string[]): Promise<string> {
  const email = `member-${label}-${runId}@v3test.invalid`;
  const m = await prisma.teamMember.create({ data: { vendorId, name: 'V3TEST member', role: 'staff', modules, status: 'active', email } });
  return sign({ sub: vendorId, email, role: 'VENDOR', kind: 'team_member', memberId: m.id });
}

/** A synthetic Get4Domain STAFF member with the given role (status 'active'). Returns the JWT JwtStrategy accepts for `kind: 'admin_member'`. */
export async function seedStaff(prisma: PrismaClient, label: string, runId: string, role: 'SUPER_ADMIN' | 'OPERATIONS' | 'MARKETING', status = 'active'): Promise<string> {
  const email = `staff-${label}-${runId}@v3test.invalid`;
  const m = await prisma.adminTeamMember.create({ data: { name: 'V3TEST staff', email, role, status } });
  return sign({ sub: m.id, email, role: 'ADMIN', kind: 'admin_member' });
}

/** A synthetic platform admin stored as a Vendor row with role ADMIN (how the seeded admin@get4domain.com works). Returns its JWT. */
export async function seedBootstrapAdmin(prisma: PrismaClient, label: string, runId: string): Promise<string> {
  const email = `${label}-${runId}@v3test.invalid`;
  const v = await prisma.vendor.create({ data: { name: `V3TEST ${label}`, email, password: 'not-a-real-hash', businessName: `V3TEST ${label} ${runId}`, role: 'ADMIN' } });
  return sign({ sub: v.id, email, role: 'ADMIN' });
}

/** A tenant with nothing but the vendor row (for tests of one subsystem, e.g. the wallet). Same deletion markers as seedTenant. */
export async function seedBareVendor(prisma: PrismaClient, label: string, runId: string): Promise<{ vendorId: string; email: string }> {
  const email = `${label}-${runId}@v3test.invalid`;
  const vendor = await prisma.vendor.create({ data: { name: `V3TEST ${label}`, email, password: 'not-a-real-hash', businessName: `V3TEST ${label} ${runId}` } });
  return { vendorId: vendor.id, email };
}

/** A wallet holding `balance` paise, as if it had been topped up (so balance === totalCredited - totalDebited holds). */
export async function seedWallet(prisma: PrismaClient, vendorId: string, balance: number) {
  return prisma.wallet.create({ data: { vendorId, balance, totalCredited: balance } });
}

/** Exact current state of every seeded row, as JSON, to prove an attack changed nothing (including updatedAt). */
export async function snapshot(prisma: PrismaClient, t: SeededTenant): Promise<Record<string, string>> {
  const j = (v: unknown) => JSON.stringify(v);
  return {
    contact: j(await prisma.contact.findUnique({ where: { id: t.ids.contact } })),
    disposableContact: j(await prisma.contact.findUnique({ where: { id: t.ids.disposableContact } })),
    catalogItem: j(await prisma.catalogItem.findUnique({ where: { id: t.ids.catalogItem } })),
    record: j(await prisma.record.findUnique({ where: { id: t.ids.record } })),
    invoice: j(await prisma.genericInvoice.findUnique({ where: { id: t.ids.invoice } })),
    lead: j(await prisma.campaignLead.findUnique({ where: { id: t.ids.lead } })),
    product: j(await prisma.vendorProduct.findUnique({ where: { id: t.ids.product } })),
    notification: j(await prisma.notification.findUnique({ where: { id: t.ids.notification } })),
  };
}

/** Row counts for one tenant, to prove an attack did not create anything under it. */
export async function counts(prisma: PrismaClient, vendorId: string): Promise<Record<string, number>> {
  return {
    contacts: await prisma.contact.count({ where: { vendorId } }),
    catalogItems: await prisma.catalogItem.count({ where: { vendorId } }),
    records: await prisma.record.count({ where: { vendorId } }),
    invoices: await prisma.genericInvoice.count({ where: { vendorId } }),
    leads: await prisma.campaignLead.count({ where: { vendorId } }),
    callLogs: await prisma.callLog.count({ where: { vendorId } }),
    products: await prisma.vendorProduct.count({ where: { vendorId } }),
    stockMovements: await prisma.stockMovement.count({ where: { vendorId } }),
    notifications: await prisma.notification.count({ where: { recipientId: vendorId } }),
  };
}

export const cleanupTenants = (prisma: PrismaClient, runId?: string): Promise<Record<string, number>> =>
  cleanup.cleanupTestTenants(prisma, { runId });
export const countTestTenants = (prisma: PrismaClient): Promise<number> => cleanup.countTestTenants(prisma);
