import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { fallbackFirm, firmRows, getFirmFacts, hasGrievanceContact, mergeFirm, readContactConfig } from '../firm-facts';
import { decideHost } from '../host-routing';
import { readHostConfig } from '../hostnames';
import { legalDocByPath, LEGAL_DOC_PATHS, sectionIdsOk } from '../legal-docs';
import { formatEffectiveDate, LEGAL_EFFECTIVE_DATE, LEGAL_VERSION } from '../legal-meta';
import { LEGAL_PAGE_PATHS } from '../legal-paths';
import { LEGAL_DOCS, LEGAL_UI } from '../legal-strings';
import { breadcrumbLd, firmOrganizationLd } from '../site-jsonld';
import { siteMetadata } from '../site-metadata';
import { SITE } from '../site-strings';
import { serializeJsonLd } from '../metadata';
import { isV3PublicEnabled } from '../flag';

const HOSTS = { MAIN_HOST: 'main.example.invalid', DIRECTORY_HOST: 'directory.main.example.invalid' };
const cfg = readHostConfig(HOSTS);
const ON = { ...HOSTS, V3_PUBLIC_ENABLED: 'true' };

describe('the registry and the path list agree', () => {
  test('LEGAL_PAGE_PATHS (used by the middleware) lists exactly the documents of the registry', () => {
    assert.deepEqual([...LEGAL_PAGE_PATHS].sort(), [...LEGAL_DOC_PATHS].sort());
    assert.equal(new Set(LEGAL_DOC_PATHS).size, LEGAL_DOC_PATHS.length);
  });
  test('every document has a path with one segment, unique anchors, an intro and sections with text', () => {
    for (const d of LEGAL_DOCS) {
      assert.match(d.path, /^\/[a-z][a-z-]*$/, d.path);
      assert.ok(sectionIdsOk(d), `${d.path} anchors`);
      assert.ok(d.intro.length > 20 && d.sections.length >= 3, d.path);
      for (const s of d.sections) assert.ok((s.paragraphs?.length ?? 0) + (s.bullets?.length ?? 0) > 0, `${d.path}#${s.id} has text`);
      assert.equal(legalDocByPath(d.path), d);
      assert.equal(legalDocByPath(`${d.path}/`), d);
    }
    assert.equal(legalDocByPath('/nope'), null);
  });
});

describe('effective date and version come from one constant', () => {
  test('the date formats the same everywhere and the version is set', () => {
    assert.match(LEGAL_EFFECTIVE_DATE, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(formatEffectiveDate(), /^\d{1,2} [A-Z][a-z]+ \d{4}$/);
    assert.equal(formatEffectiveDate('not a date'), '');
    assert.ok(LEGAL_VERSION.length > 0);
  });
});

describe('metadata of every policy page', () => {
  test('title with the brand is at most 60 characters, a description is set, the canonical is on the main host', () => {
    const saved = { ...process.env };
    Object.assign(process.env, HOSTS);
    try {
      for (const d of LEGAL_DOCS) {
        const m = siteMetadata({ title: d.metaTitle, description: d.metaDescription, path: d.path });
        const title = (m.title as { absolute: string }).absolute;
        assert.ok(title.length <= 60, `${d.path}: ${title.length}`);
        assert.ok(d.metaTitle.length <= 60);
        assert.ok(d.metaDescription.length >= 40 && d.metaDescription.length <= 170, `${d.path} description ${d.metaDescription.length}`);
        assert.equal(m.alternates?.canonical, `https://main.example.invalid${d.path}`);
        assert.deepEqual(m.robots, { index: true, follow: true });
      }
    } finally {
      for (const k of Object.keys(HOSTS)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
    }
  });
  test('the BreadcrumbList JSON-LD parses and names the page', () => {
    const saved = process.env.MAIN_HOST;
    process.env.MAIN_HOST = HOSTS.MAIN_HOST;
    try {
      for (const d of LEGAL_DOCS) {
        const ld = breadcrumbLd([{ name: 'Home', path: '/' }, { name: d.title, path: d.path }]);
        assert.ok(ld);
        const parsed = JSON.parse(serializeJsonLd(ld)) as { '@type': string; itemListElement: Array<{ name: string; item: string }> };
        assert.equal(parsed['@type'], 'BreadcrumbList');
        assert.equal(parsed.itemListElement[1].name, d.title);
        assert.equal(parsed.itemListElement[1].item, `https://main.example.invalid${d.path}`);
      }
    } finally { if (saved === undefined) delete process.env.MAIN_HOST; else process.env.MAIN_HOST = saved; }
  });
});

describe('the flag keeps the live site unchanged', () => {
  test('flag off: the host layer gives no decision for a policy path, and the page guard sees the flag off', () => {
    for (const p of LEGAL_PAGE_PATHS) assert.equal(decideHost({ host: HOSTS.MAIN_HOST, pathname: p }, cfg, HOSTS), null, p);
    // the page guard (assertV3Public) answers notFound exactly when this is false; the smoke script checks the real 404 over HTTP
    assert.equal(isV3PublicEnabled({}), false);
    assert.equal(isV3PublicEnabled(HOSTS), false);
  });
  test('flag on with a main host: the main host rewrites each policy path to its internal page; the directory host does not serve it as a policy', () => {
    for (const p of LEGAL_PAGE_PATHS) {
      assert.deepEqual(decideHost({ host: HOSTS.MAIN_HOST, pathname: p }, cfg, ON), { action: 'rewrite', pathname: `/v3-site${p}` }, p);
      assert.deepEqual(decideHost({ host: HOSTS.MAIN_HOST, pathname: `${p}/` }, cfg, ON), { action: 'rewrite', pathname: `/v3-site${p}` }, `${p}/`);
      const d = decideHost({ host: HOSTS.DIRECTORY_HOST, pathname: p, isBusinessId: () => false }, cfg, ON);
      assert.ok(!d || d.action !== 'rewrite', `${p} on the directory host`);
    }
  });
});

describe('firm facts: an empty value prints nothing', () => {
  const rowLabels = LEGAL_UI.rows;
  test('the config is empty by default and an invalid value counts as empty', () => {
    assert.deepEqual(readContactConfig({}), { cin: '', supportEmail: '', supportPhone: '', grievanceName: '', grievanceEmail: '', grievancePhone: '' });
    const c = readContactConfig({ V3_PUBLIC_SUPPORT_EMAIL: 'not an email', V3_PUBLIC_SUPPORT_PHONE: 'call me', V3_PUBLIC_GRIEVANCE_OFFICER_EMAIL: 'a@b' });
    assert.equal(c.supportEmail, '');
    assert.equal(c.supportPhone, '');
    assert.equal(c.grievanceEmail, '');
  });
  test('with no config and no GSTIN only the name and the address are printed, with no placeholder text', () => {
    const rows = firmRows(fallbackFirm(readContactConfig({})), rowLabels);
    assert.deepEqual(rows.map((r) => r.key), ['name', 'address']);
    assert.equal(rows[0].value, 'KSM QUANTUM TECHNOLOGIES');
    assert.match(rows[1].value, /Tidel Park, Chennai, Tamil Nadu, India/);
    for (const r of rows) assert.doesNotMatch(r.value, /x{3}|pending|tbd|n\/a|placeholder/i);
  });
  test('values that are set are printed, with a mailto and a tel link', () => {
    const cfgSet = readContactConfig({ V3_PUBLIC_SUPPORT_EMAIL: 'help@example.invalid', V3_PUBLIC_SUPPORT_PHONE: '+91 44 0000 0000', V3_PUBLIC_FIRM_CIN: 'U00000TN0000PTC000000' });
    const rows = firmRows({ ...fallbackFirm(cfgSet), gstin: '33ABCDE1234F1Z5' }, rowLabels);
    assert.deepEqual(rows.map((r) => r.key), ['name', 'address', 'gstin', 'cin', 'supportEmail', 'supportPhone']);
    assert.equal(rows.find((r) => r.key === 'supportEmail')!.href, 'mailto:help@example.invalid');
    assert.equal(rows.find((r) => r.key === 'supportPhone')!.href, 'tel:+914400000000');
  });
  test('the grievance section exists only when some grievance value is set', () => {
    assert.equal(hasGrievanceContact(fallbackFirm(readContactConfig({}))), false);
    assert.equal(hasGrievanceContact(fallbackFirm(readContactConfig({ V3_PUBLIC_GRIEVANCE_OFFICER_NAME: 'A Person' }))), true);
  });
  test('the public firm answer replaces the name and address; a missing GSTIN stays empty; a bad answer keeps the decided facts', () => {
    const c = readContactConfig({});
    const m = mergeFirm({ legalName: 'KSM QUANTUM TECHNOLOGIES', registeredAddress: 'Tidel Park, D Block, Chennai', gstin: '33ABCDE1234F1Z5' }, c);
    assert.equal(m.address, 'Tidel Park, D Block, Chennai');
    assert.equal(m.gstin, '33ABCDE1234F1Z5');
    assert.equal(mergeFirm({ legalName: 'KSM QUANTUM TECHNOLOGIES', registeredAddress: 'Tidel Park, D Block, Chennai' }, c).gstin, '');
    assert.equal(mergeFirm({ gstin: 42 as unknown as string }, c).gstin, '');
    assert.deepEqual(mergeFirm(null, c), fallbackFirm(c));
  });
  test('mock mode (the default) never touches the network', async () => {
    const real = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (() => { calls += 1; return Promise.reject(new Error('no network in mock mode')); }) as typeof fetch;
    try {
      const f = await getFirmFacts();
      assert.equal(f.legalName, 'KSM QUANTUM TECHNOLOGIES');
      assert.equal(calls, 0);
    } finally { globalThis.fetch = real; }
  });
});

describe('Organization JSON-LD is written from the firm facts only', () => {
  test('with nothing set it has the name, the legal name and the decided location, and no tax id, email or phone', () => {
    const saved = process.env.MAIN_HOST;
    process.env.MAIN_HOST = HOSTS.MAIN_HOST;
    try {
      const f = fallbackFirm(readContactConfig({}));
      const ld = JSON.parse(serializeJsonLd(firmOrganizationLd(f))) as Record<string, unknown>;
      assert.equal(ld['@type'], 'Organization');
      assert.equal(ld.legalName, 'KSM QUANTUM TECHNOLOGIES');
      assert.equal(ld.url, 'https://main.example.invalid/');
      assert.deepEqual(ld.address, { '@type': 'PostalAddress', streetAddress: f.address, addressLocality: 'Chennai', addressRegion: 'Tamil Nadu', addressCountry: 'IN' });
      for (const k of ['taxID', 'email', 'telephone', 'aggregateRating', 'review', 'logo', 'sameAs', 'foundingDate']) assert.ok(!(k in ld), k);
    } finally { if (saved === undefined) delete process.env.MAIN_HOST; else process.env.MAIN_HOST = saved; }
  });
  test('values that are set appear, and only those', () => {
    const f = { ...fallbackFirm(readContactConfig({ V3_PUBLIC_SUPPORT_EMAIL: 'help@example.invalid' })), gstin: '33ABCDE1234F1Z5' };
    const ld = firmOrganizationLd(f);
    assert.equal(ld.taxID, '33ABCDE1234F1Z5');
    assert.equal(ld.email, 'help@example.invalid');
    assert.ok(!('telephone' in ld));
  });
});

describe('the accept notice of /pricing and /register', () => {
  test('it reads as one sentence naming the Terms of Service and the Privacy Policy, and the names match the policy titles', () => {
    const N = SITE.acceptNotice;
    assert.equal(`${N.before}${N.terms}${N.between}${N.privacy}${N.after}`, 'By continuing, you accept the Terms of Service and the Privacy Policy.');
    assert.equal(LEGAL_DOCS.find((d) => d.path === '/terms')!.title, N.terms);
    assert.equal(LEGAL_DOCS.find((d) => d.path === '/privacy-policy')!.title, N.privacy);
  });
});

