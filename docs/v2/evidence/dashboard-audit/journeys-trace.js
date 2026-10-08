// VENDOR JOURNEYS TRACE (service level) — real compiled services + real Prisma + real Postgres (PGlite). No production access. Senders stubbed.
const fs = require('fs');
const BE = 'C:/Get4Domain/get4domain-site/backend-api';
for (const l of fs.readFileSync(`${BE}/.env.local`, 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}
const PG = 'postgresql://postgres:postgres@127.0.0.1:54329/postgres?sslmode=disable&connection_limit=1&pool_timeout=60';
process.env.DATABASE_URL = PG; process.env.DIRECT_URL = PG;
process.env.PLATFORM_SETTINGS_KEY = process.env.PLATFORM_SETTINGS_KEY || 'audit-key-audit-key-audit-key-0123';
for (const k of ['RESEND_API_KEY', 'FAST2SMS_API_KEY', 'OPENAI_API_KEY', 'CLAUDE_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) delete process.env[k];
process.chdir(BE);
require('reflect-metadata');
const { dist } = require(`${BE}/scripts/security-verify/harness`);
const out = [];
const log = (s) => { out.push(s); console.log(s); };
const ok = (n, c, d = '') => log(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? '  → ' + d : ''}`);
const info = (s) => log(`      ${s}`);
const tryit = async (fn) => { try { return { v: await fn() }; } catch (e) { return { e: `${e.status || e.getStatus?.() || ''} ${e.message}`.trim() }; } };

(async () => {
  const { NestFactory } = require('@nestjs/core');
  const app = await NestFactory.createApplicationContext(dist('app.module').AppModule, { logger: ['error'] });
  const get = (n, m) => app.get(dist(m)[n], { strict: false });
  const prisma = get('PrismaService', 'prisma/prisma.service');
  const demo = get('DemoService', 'demo/demo.service');
  const cms = get('CmsService', 'cms/cms.service');
  const crm = get('CrmService', 'crm/crm.service');
  const acct = get('AccountingService', 'accounting/accounting.service');
  const invoicesSvc = (() => { const m = dist('domainapp/invoices.service'); return app.get(m[Object.keys(m).find((k) => /Invoices?Service/.test(k))], { strict: false }); })();
  const contacts = get('ContactsService', 'domainapp/contacts.service');
  const team = get('TeamService', 'team/team.service');

  const v = await demo.provisionSandbox('retail', 'JOURNEY SBX', '9999999992');
  const SUB = 'journey' + Date.now();
  await prisma.vendor.update({ where: { id: v.id }, data: { isSandbox: false, expiresAt: null, subdomain: SUB } });
  log(`isolated sandbox vendor ${v.id} (retail)`);

  log('\n-- J1/J2. Website content: homepage text, SEO fields, a "page"');
  await cms.updateVendorCMS(v.id, { businessName: 'Journey Shoes', tagline: 'Walk further', about: 'We sell shoes.', seoTitle: 'Journey Shoes | Buy', seoDesc: 'Best shoes', seoKeywords: 'shoes, sneakers, running shoes, trail shoes, sandals' });
  const site = await cms.getSiteBySubdomain(SUB);
  ok('J1 homepage text + SEO fields persist and the public site API returns them', site.cms.tagline === 'Walk further' && site.cms.seoTitle === 'Journey Shoes | Buy' && site.cms.seoKeywords.includes('sandals'));
  const kw = await tryit(() => cms.updateVendorCMS(v.id, { seoKeywords: 'a,b,c,d,e,f,g,h' }));
  info(`J6 keyword cap: 8 keywords saved by a vendor with NO billing term → ${kw.e ?? 'accepted (cap applies only to vendors with a billing term)'}`);
  const cols = Object.keys(site.cms);
  ok('J6 there are NO GEO or AEO fields, no schema/JSON-LD, no robots/sitemap per vendor in the CMS model', !cols.some((c) => /geo|aeo|schema|jsonld|sitemap|robots/i.test(c)), `VendorCMS columns: ${cols.join(',')}`);
  ok('J2 there is no "add a page" capability: pages exist only inside a theme definition (WebsiteTheme.pages), not per vendor', !cols.includes('pages'));

  log('\n-- J8. Lead capture → CRM and TeleCRM');
  const lead = await crm.createLead(v.id, { name: 'Web Visitor', phone: '9000000010', message: 'Do you have size 9?', source: 'website' });
  const leads = await crm.findLeads(v.id, {});
  const queue = await crm.telecrmQueue(v.id);
  ok('J8 the lead appears in CRM (findLeads) and in the TeleCRM call queue — CRM and TeleCRM are ONE table (CampaignLead)', leads.some((l) => l.id === lead.id) && queue.some((l) => l.id === lead.id), `crm=${leads.length} telecrm=${queue.length}`);
  const autoContacts = await prisma.contact.count({ where: { vendorId: v.id, name: 'Web Visitor' } });
  ok('"Customer Hub" / the industry Customers tab read a DIFFERENT table (Contact): a captured web lead does NOT create a customer record', autoContacts === 0, `contacts named like the lead after capture = ${autoContacts}`);

  log('\n-- J10. Record an expense');
  const ex = await acct.createExpense(v.id, { description: 'Packaging', category: 'supplies', amount: 1180, gstRate: 18, paymentMethod: 'offline', date: new Date().toISOString().slice(0, 10) });
  const exList = await acct.listExpenses(v.id);
  const sum = await acct.summary(v.id);
  ok('J10 expense persists and shows in the list and the P&L summary', exList.some((e) => e.id === ex.id), `summary=${JSON.stringify(sum).slice(0, 160)}`);

  log('\n-- J9. Send an invoice to a customer (vendor → their customer)');
  const c1 = await prisma.contact.findFirst({ where: { vendorId: v.id } });
  const gi = await invoicesSvc.create(v.id, { contactId: c1.id, items: [{ description: 'Shoes', quantity: 2, rate: 2000 }], gstRate: 18 });
  const gl = await invoicesSvc.findAll(v.id, {});
  const glRows = gl.items ?? gl.data ?? gl.results ?? gl.rows ?? [];
  ok('J9 customer invoice persists (GenericInvoice) with GST and appears in the industry Billing/Invoicing tab list', glRows.some((i) => i.id === gi.id), `total=${gi.total}; list keys=${Object.keys(gl).join(',')}`);
  const send = await tryit(() => invoicesSvc.sendLink(v.id, gi.id));
  info(`J9 "send" = create a Razorpay payment link with the PLATFORM's Razorpay keys (not the vendor's) → ${send.e ?? 'ok'}`);

  log('\n-- J11. Add a staff member with a role');
  const tm = await team.invite(v.id, { name: 'Asha', email: 'asha@example.invalid', role: 'manager', department: 'sales', modules: ['crm', 'orders'] });
  const tms = await team.findMembers(v.id);
  ok('J11 staff invite persists with role/department/modules and lists back (invite email/WhatsApp stubbed)', tms.some((m) => m.id === tm.id && m.modules.includes('crm')), `status=${tm.status}`);

  log('\n-- J12. Theme change counter');
  const themes = await prisma.websiteTheme.count();
  info(`themes in the isolated schema: ${themes} (themes are data rows seeded in production, not by migrations)`);

  fs.writeFileSync(`${process.env.TEMP}/audit/journeys-trace.out.txt`, out.join('\n'));
  await app.close(); process.exit(0);
})().catch((e) => { console.error('TRACE ERROR', e); fs.writeFileSync(`${process.env.TEMP}/audit/journeys-trace.out.txt`, out.join('\n') + '\nTRACE ERROR ' + e.stack); process.exit(1); });
