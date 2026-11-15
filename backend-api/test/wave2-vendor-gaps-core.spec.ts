import {
  barGroupOf, BAR_GROUPS, checkAreas, checkPromoDraft, checkTeamInvite, COMMON_TAB_GROUP, nextSteps, NextStepFacts, renderInvoiceHtml, VENDOR_DEPARTMENTS,
} from '../src/v3-vendor-gaps/core/gaps-core';
import { checkSiteUrl } from '../src/v3-vendor-gaps/vendor-gaps.service';
import { realSeed } from './support/pack-fakes';

describe('B4: the five bar groups', () => {
  it('every seeded COMMON tab has a group, every group is one of the five, and pack, capability and add-on tabs are Business', () => {
    for (const t of realSeed().tabs) {
      const g = barGroupOf(t.scope, t.key);
      expect(BAR_GROUPS).toContain(g);
      if (t.scope === 'COMMON') expect(COMMON_TAB_GROUP[t.key]).toBeDefined(); else expect(g).toBe('business');
    }
  });
  it('follows Amendment 14 F3: Grow holds promotion, social, AI studio, website and domain; Money billing and accounting; More support, plan and migration', () => {
    expect(['promotion', 'social', 'ai_studio', 'website', 'domain'].map((k) => barGroupOf('COMMON', k))).toEqual(Array(5).fill('grow'));
    expect(['billing', 'accounting'].map((k) => barGroupOf('COMMON', k))).toEqual(['money', 'money']);
    expect(['support', 'plan', 'migration'].map((k) => barGroupOf('COMMON', k))).toEqual(['more', 'more', 'more']);
  });
  it('an unknown common tab falls into Business, never nowhere', () => { expect(barGroupOf('COMMON', 'made_up')).toBe('business'); });
});

describe('B5: next steps come from real state only', () => {
  const none: NextStepFacts = { sitePublished: true, draftStarted: true, missingDetails: [], unpaidPlanOrder: false, unconnectedDomain: null };
  it('nothing to do gives an empty list, never a made-up task', () => { expect(nextSteps(none)).toEqual([]); });
  it('each fact gives its own step, in the order a person would do them', () => {
    const s = nextSteps({ sitePublished: false, draftStarted: false, missingDetails: ['Opening hours', 'Phone', 'Address', 'Logo'], unpaidPlanOrder: true, unconnectedDomain: 'acme.example' });
    expect(s.map((x) => x.id)).toEqual(['publish_site', 'site_details', 'plan_payment', 'connect_domain']);
    expect(s[0].text).toBe('Start your website.'); expect(s[1].text).toContain('Opening hours, Phone, Address and more'); expect(s[3].text).toContain('acme.example');
    expect(nextSteps({ ...none, sitePublished: false, draftStarted: true })[0].text).toContain('ready to look over');
  });
  it('the text holds no number, price, timeframe or internal word', () => {
    const all = nextSteps({ sitePublished: false, draftStarted: false, missingDetails: ['Phone'], unpaidPlanOrder: true, unconnectedDomain: 'x.example' }).map((x) => x.text).join(' ');
    expect(all).not.toMatch(/₹|\bRs\b|\d|workspace|\bbos\b|leadspace|\bleads?\b|days|weeks|months/i);
  });
});

describe('B8: promotion and social drafts', () => {
  it('accepts a channel of its own kind, a title and a body, and cleans them', () => {
    expect(checkPromoDraft('SOCIAL', { channel: 'INSTAGRAM', title: '  New   stock ', body: 'Fresh arrivals\r\nthis week' })).toEqual({ ok: true, value: { channel: 'INSTAGRAM', title: 'New stock', body: 'Fresh arrivals\nthis week' } });
    expect(checkPromoDraft('PROMOTION', { channel: 'OFFER', title: 'Festival offer', body: 'x' }).ok).toBe(true);
  });
  it('a social channel is not a promotion channel and the other way round', () => {
    expect(checkPromoDraft('PROMOTION', { channel: 'INSTAGRAM', title: 't', body: 'b' }).ok).toBe(false);
    expect(checkPromoDraft('SOCIAL', { channel: 'OFFER', title: 't', body: 'b' }).ok).toBe(false);
  });
  it('refuses markup, empty text and oversize text, naming each field', () => {
    const r = checkPromoDraft('SOCIAL', { channel: 'X', title: '<b>hi</b>', body: '' });
    expect(r.ok).toBe(false); if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['body', 'title']);
    const big = checkPromoDraft('SOCIAL', { channel: 'X', title: 't'.repeat(121), body: 'b'.repeat(2001) });
    expect(big.ok).toBe(false); if (!big.ok) expect(Object.keys(big.errors).sort()).toEqual(['body', 'title']);
  });
});

describe('B9: team', () => {
  it('lists the four vendor departments, which are not staff roles', () => {
    expect([...VENDOR_DEPARTMENTS]).toEqual(['Sales', 'Support', 'Accounts', 'Marketing']);
    for (const staff of ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'SUPPORT', 'SALES', 'MARKETING']) expect((VENDOR_DEPARTMENTS as readonly string[]).includes(staff)).toBe(false);
  });
  it('an invite needs a name, a role and an email or a phone; the department gives its default areas', () => {
    const ok = checkTeamInvite({ name: 'Ravi Kumar', role: 'Counter staff', email: ' Ravi@Example.com ', department: 'Sales' });
    expect(ok).toMatchObject({ ok: true, value: { name: 'Ravi Kumar', email: 'ravi@example.com', phone: null, department: 'Sales', areas: ['telecrm', 'communication', 'reports'] } });
    expect(checkTeamInvite({ name: 'R', role: '', department: 'Boss' }).ok).toBe(false);
    expect(checkTeamInvite({ name: 'Ravi', role: 'x' }).ok).toBe(false);   // neither an email nor a phone
    expect(checkTeamInvite({ name: 'Ravi', role: 'x', phone: '+91 98765 43210' })).toMatchObject({ ok: true, value: { phone: '+919876543210' } });
  });
  it('areas: wallet is never offered, unknown areas are refused, no areas sent gives the department default', () => {
    expect(checkAreas(['wallet'], null).ok).toBe(false); expect(checkAreas(['nope'], null).ok).toBe(false); expect(checkAreas('website', null).ok).toBe(false);
    expect(checkAreas(['CRM', 'Campaigns'], null)).toEqual({ ok: true, value: ['telecrm', 'campaigns'] });
    expect(checkAreas(undefined, 'Accounts')).toEqual({ ok: true, value: ['accounts', 'reports'] });
  });
});

describe('B3: the address of a site to move', () => {
  it('takes a public web address and tidies it', () => {
    expect(checkSiteUrl('Example.com')).toEqual({ ok: true, value: 'https://example.com' });
    expect(checkSiteUrl('http://shop.example.in/store/')).toEqual({ ok: true, value: 'http://shop.example.in/store' });
  });
  it('refuses sign-in details, this machine, private networks, other schemes and rubbish', () => {
    for (const bad of ['', 'localhost', 'http://127.0.0.1', 'http://192.168.1.4/x', 'https://user:pw@example.com', 'ftp://example.com', 'javascript:alert(1)', 'nodots', 'https://box.local', 5 as never, 'x'.repeat(301)]) expect(checkSiteUrl(bad).ok).toBe(false);
  });
});

describe('B6: the plan invoice as a page', () => {
  const inv = {
    invoiceNumber: 'G4D/2026-27/0001', financialYear: '2026-27', issuedAt: new Date('2026-11-10T08:00:00Z'),
    snapshot: { seller: { name: 'Get4Domain', address: 'Kochi', gstin: '32ABCDE1234F1Z5' }, buyer: { businessName: '<script>alert(1)</script> Traders', email: 'o@x.example' }, plan: { name: 'Pro' }, termMonths: 12, period: { from: '2026-11-10T08:00:00Z', to: '2027-11-10T08:00:00Z' }, amountPaise: 1_198_800 },
    taxBreakdown: { name: 'GST', ratePercent: 18, taxableMinor: 1_016_000, taxMinor: 182_800, creditPaise: 0 },
  };
  it('builds a self-contained page from the stored invoice with the tax lines and the total', () => {
    const html = renderInvoiceHtml(inv);
    expect(html).toContain('Invoice G4D/2026-27/0001'); expect(html).toContain('Amount before tax'); expect(html).toContain('GST at 18%'); expect(html).toContain('11,988.00'); expect(html).toContain('32ABCDE1234F1Z5');
    expect(html).toContain('noindex');
  });
  it('escapes every value, so a business name cannot inject markup', () => {
    const html = renderInvoiceHtml(inv);
    expect(html).not.toContain('<script>'); expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; Traders');
  });
  it('copes with a thin snapshot without throwing', () => { expect(() => renderInvoiceHtml({ invoiceNumber: 'X', financialYear: '', issuedAt: 'bad', snapshot: {}, taxBreakdown: {} })).not.toThrow(); });
});
