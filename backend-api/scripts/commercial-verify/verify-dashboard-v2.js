// Release 1A, Dashboard v2: lead -> customer in one step (Phase 3), plus later phases append their own sections here.
// Runs the REAL compiled services against the in-memory Prisma stand-in. Run `npx nest build` first.
const { dist, ok, section, rejects, finish } = require('../security-verify/harness');
const { createMemPrisma } = require('./mem-prisma');
const { CrmService } = dist('crm/crm.service');

const seed = () => ({
  vendor: [
    { id: 'v_a', name: 'A', email: 'a@x.in', businessName: 'A Co', subdomain: 'aco' },
    { id: 'v_b', name: 'B', email: 'b@x.in', businessName: 'B Co', subdomain: 'bco' },
  ],
  campaignLead: [
    { id: 'l1', vendorId: 'v_a', name: 'Priya', phone: '9876500001', message: 'Wants a quote', source: 'website', status: 'new', customFields: { size: 'M' } },
    { id: 'l2', vendorId: 'v_a', name: 'Priya again', phone: '9876500001', message: null, source: 'whatsapp', status: 'new', customFields: null },
    { id: 'l3', vendorId: 'v_b', name: 'Other', phone: '9000000000', message: null, source: 'website', status: 'new', customFields: null },
  ],
  contact: [],
});

(async () => {
  section('[feat:sales.leads.convert] lead -> customer in one step');
  {
    const prisma = createMemPrisma(seed());
    const crm = new CrmService(prisma);
    const r1 = await crm.convertToCustomer('l1', 'v_a');
    const t = prisma.$tables;
    ok('creates one customer for this vendor with the lead\'s name and phone', r1.created === true && t.contact.length === 1 && t.contact[0].vendorId === 'v_a' && t.contact[0].name === 'Priya' && t.contact[0].phone === '9876500001' && t.contact[0].type === 'customer');
    ok('the lead is marked won and remembers the customer; its other custom fields are kept', t.campaignLead[0].status === 'won' && t.campaignLead[0].customFields.contactId === r1.contact.id && t.campaignLead[0].customFields.size === 'M');
    const r2 = await crm.convertToCustomer('l1', 'v_a');
    ok('IDEMPOTENT: converting the same lead again returns the same customer and creates nothing', r2.created === false && r2.contact.id === r1.contact.id && t.contact.length === 1);
    const r3 = await crm.convertToCustomer('l2', 'v_a');
    ok('a second lead with the SAME phone does not create a duplicate customer', r3.created === false && r3.contact.id === r1.contact.id && t.contact.length === 1);
    await rejects('vendor B cannot convert vendor A\'s lead', crm.convertToCustomer('l1', 'v_b'), { status: 403 });
    ok('…and nothing was created for vendor B', t.contact.every((c) => c.vendorId === 'v_a'));
    await rejects('an unknown lead is a clean 404', crm.convertToCustomer('nope', 'v_a'), { status: 404 });
  }
  finish();
})().catch((e) => { console.error(e); process.exit(1); });
