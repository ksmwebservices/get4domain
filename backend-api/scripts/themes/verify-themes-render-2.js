// Second half of the theme render suite: the shell (header, footer, phone bar), the popup, social icons, editable fields, SEO, speed, no hard-coded text and a category made only in Admin.
// Called by verify-themes-render.js with the sites it already made.
const path = require('path');

module.exports = async function part2(L, { h, A, browser, page, consoleErrors, pageErrors, ctx }) {
  const { ok, section, FRONT, FE, get, sleep } = L;
  const { prisma, call } = h;
  const { clinic, resto, sw, packs, flag, realSite, strip, count, getWithHost } = ctx;
  const J = (x) => JSON.stringify(x);
  const sub = (v) => `${FRONT}/site/${v.subdomain}`;
  const labelsOf = (pack) => pack.config.shell?.bottomNav?.map((n) => n.label) ?? [];
  const phoneBarOf = (html) => { const m = /<nav aria-label="Main" class="fixed[^"]*"[^>]*>([\s\S]*?)<\/nav>/.exec(html); return m ? { classes: /<nav aria-label="Main" class="([^"]*)"/.exec(html)[1], items: [...m[1].matchAll(/<(?:a|button)\b[\s\S]*?<\/(?:a|button)>/g)].map((x) => x[0].replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '').trim()) } : null; };
  const wait = (ms) => sleep(ms);
  const open = async (url, w = 390) => { await page.setViewport({ width: w, height: 800, deviceScaleFactor: 1, isMobile: w < 700, hasTouch: w < 700 }); await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 }); await wait(400); };
  const clinicPack = packs.find((p) => p.key === 'clinic');

  // ───────────────────────────── shell
  section('[feat:industry-designs.shell] A header, a footer and a phone bar in every design and theme; the bar only below the tablet width; the words come from data');
  const noShell = []; const wrongLabels = []; let checked = 0;
  for (const p of packs) {
    const r = await call('POST', '/admin/category-packs/sites', { categoryKey: p.key, businessName: `Sh ${p.name}`, subdomain: `sh-${p.key}`.slice(0, 40), city: 'Chennai', phone: '9876543210' }, A);
    const g = await get(`${FRONT}${r.data.previewUrl}`);
    const bar = phoneBarOf(g.t);
    checked += 1;
    if (g.status !== 200 || !/data-g4d-footer/.test(g.t) || !/<header/.test(g.t) || !bar || bar.items.length !== 5) { noShell.push(`${p.key}:${g.status}:${bar ? bar.items.length : 'no bar'}`); continue; }
    const want = labelsOf(p).map((x) => x.slice(0, 14));
    const centreIsCart = p.config.shell?.bottomNav?.[2]?.target === 'cart';
    if (want.length === 5 && !want.filter((x, i) => !(centreIsCart && i === 2)).every((x) => bar.items.some((i) => i === x || i.includes(x)))) wrongLabels.push(`${p.key}: wanted ${want.join('/')} got ${bar.items.join('/')}`);
  }
  ok(`all ${checked} categories (default design) have a header, a footer with its data marker and a five-slot phone bar`, noShell.length === 0, noShell.join(' | '));
  ok('the phone bar words are the category\'s own (taken from the category pack, no code per category)', wrongLabels.length === 0, wrongLabels.slice(0, 4).join(' | '));
  const bpOk = [];
  for (const [pk, v] of [['clinic', clinic], ['restaurant', resto]]) {
    const ds = (await call('GET', '/site-doc/me/designs', undefined, v.token)).data.designs.map((d) => d.key);
    const themeKey = pk === 'clinic' ? 't:clinic-calm' : 't:restaurant-hearth';
    for (const k of [...ds.filter((x) => x !== themeKey), themeKey]) {
      await call('POST', '/site-doc/me/design', { designKey: k }, v.token); await call('POST', '/site-doc/me/publish', {}, v.token);
      const g = await get(v.url); const bar = phoneBarOf(g.t);
      const row = { k: `${pk}/${k}`, footer: /data-g4d-footer/.test(g.t), bar: !!bar && bar.items.length === 5, md: !!bar && /\bmd:hidden\b/.test(bar.classes), header: /<header/.test(g.t) };
      if (page) {
        for (const [w, wantShown] of [[390, true], [1280, false]]) {
          await open(v.url, w);
          const info = await page.evaluate(() => { const n = document.querySelector('nav[aria-label="Main"].fixed'); if (!n) return null; const cs = getComputedStyle(n); const r = n.getBoundingClientRect(); return { shown: cs.display !== 'none' && cs.position === 'fixed' && r.bottom >= window.innerHeight - 2, display: cs.display, cls: n.className.slice(0, 80) }; });
          row[`@${w}`] = (info ? info.shown : null) === wantShown; if (row[`@${w}`] !== true) row[`dbg${w}`] = info;
        }
      }
      bpOk.push(row);
    }
  }
  ok(`every design of a clinic and of a restaurant, and both themes (${bpOk.length} pages), have the header, the footer and the five-slot phone bar`, bpOk.every((r) => r.footer && r.bar && r.header), J(bpOk.filter((r) => !(r.footer && r.bar && r.header))));
  ok('the phone bar is hidden from the tablet width up (md:hidden) and, in Chrome, shown fixed at the bottom of a 390 px screen and absent at 1280 px, on every one of them', bpOk.every((r) => r.md && (!page || (r['@390'] === true && r['@1280'] === true))), J(bpOk.filter((r) => !(r.md && (!page || (r['@390'] === true && r['@1280'] === true))))));
  // a vendor's own words
  const swv = sw;
  await call('POST', '/site-doc/me/design', { designKey: 'classic' }, swv.token);
  await call('PUT', '/site-doc/me/draft', { extras: { navigation: { primaryLabel: 'Visit us', header: [{ label: 'Our Doctors', target: 'doctors' }, { label: 'Say hello', target: 'tel:+919876543210' }], bottom: [{ key: 'action', label: 'Come in' }] }, headline: 'Rt Switch headline', team: [{ name: 'Dr Real', role: 'Doctor' }] } }, swv.token);
  await call('POST', '/site-doc/me/publish', {}, swv.token);
  let g = await get(swv.url); let bar = phoneBarOf(g.t);
  ok('a vendor can rename the middle button of the phone bar and the main button, and it shows on a built-in design', !!bar && bar.items.some((i) => i.includes('Come in')) && g.t.includes('Visit us'), J(bar));
  await call('POST', '/site-doc/me/design', { designKey: 't:clinic-calm' }, swv.token); await call('POST', '/site-doc/me/publish', {}, swv.token);
  g = await get(swv.url); bar = phoneBarOf(g.t);
  const hdr = /<nav class="g4d-header-nav[^>]*>([\s\S]*?)<\/nav>/.exec(g.t)?.[1] ?? '';
  ok('the same words show on an imported theme, and the vendor\'s own header menu replaces the automatic one', !!bar && bar.items.some((i) => i.includes('Come in')) && /Our Doctors/.test(hdr) && /href="tel:\+919876543210"/.test(hdr) && !/Treatments/.test(hdr), hdr.slice(0, 300));

  // ───────────────────────────── popup
  section('[feat:industry-designs.popup] Every trigger opens the dialog; submit goes through the existing flow and creates the lead; focus is trapped; Escape closes and returns focus; the fallback address has the same form');
  if (!page) console.log('  SKIP  no Chrome or Edge found (set G4D_CHROME): popup behaviour not run');
  else {
    const results = [];
    const trySite = async (label, url, w, selectors) => {
      for (const sel of selectors) {
        await open(url, w);
        const handle = await page.$(sel);
        const visible = handle ? await page.evaluate((el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; }, handle) : false;
        if (!handle || !visible) { results.push({ label, sel, skipped: true }); continue; }
        await handle.evaluate((el) => el.scrollIntoView({ block: 'center' }));
        await handle.focus(); await handle.click();
        let dlg = null; try { dlg = await page.waitForSelector('[role="dialog"]', { timeout: 4000 }); } catch { /* no dialog */ }
        const row = { label, sel, opened: !!dlg };
        if (dlg) {
          row.focusIn = await page.evaluate(() => !!document.activeElement && !!document.activeElement.closest('[role="dialog"]'));
          let trapped = true;
          for (let i = 0; i < 24; i++) { await page.keyboard.press('Tab'); if (!(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')))) { trapped = false; break; } }
          for (let i = 0; i < 6; i++) { await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift'); if (!(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')))) { trapped = false; break; } }
          row.trapped = trapped;
          await page.keyboard.press('Escape'); await wait(300);
          row.closed = !(await page.$('[role="dialog"]'));
          row.focusBack = await page.evaluate((s) => { const a = document.activeElement; const t = document.querySelector(s); return !!a && (a === t || !!(t && t.contains(a)) || !!(a.closest && t && a.closest(s))); }, sel);
        }
        results.push(row);
      }
    };
    const themeTriggers = ['.head-cta', 'nav[aria-label="Main"].fixed a[data-g4d-open]', '.hero .actions a[data-g4d-open]', 'article.card a[data-g4d-open]'];
    await trySite('clinic theme @390', clinic.url, 390, themeTriggers);
    await trySite('clinic theme @1280', clinic.url, 1280, themeTriggers);
    const bi = await realSite('rtpopbuiltin', 'clinic', 'WORKSPACE', 'clinic', 'Rt Popup Built-in', 'classic');
    const builtTriggers = ['header a[href="#enquiry"]', 'nav[aria-label="Main"].fixed a[data-g4d-open]', 'a[href="#enquiry"]'];
    await trySite('built-in design @390', bi.url, 390, builtTriggers);
    await trySite('built-in design @1280', bi.url, 1280, builtTriggers);
    const ran = results.filter((r) => !r.skipped);
    ok(`${ran.length} triggers were tried (header button, phone bar centre, hero button, item card; theme and built-in design; phone and computer): every one opens the dialog`, ran.length >= 8 && ran.every((r) => r.opened), J(results.filter((r) => !r.skipped && !r.opened).concat(ran.length < 8 ? [{ only: ran.length }] : [])));
    ok('keyboard focus moves into the dialog and Tab and Shift+Tab never leave it', ran.filter((r) => r.opened).every((r) => r.focusIn && r.trapped), J(ran.filter((r) => r.opened && !(r.focusIn && r.trapped))));
    ok('Escape closes the dialog and focus returns to the button that opened it', ran.filter((r) => r.opened).every((r) => r.closed && r.focusBack), J(ran.filter((r) => r.opened && !(r.closed && r.focusBack))));

    // submit through the popup on a live site: a lead is created in the vendor's CRM
    await open(clinic.url, 390);
    await page.evaluate(() => document.querySelector('nav[aria-label="Main"].fixed a[data-g4d-open]').click());
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    const stepText = async () => page.evaluate(() => document.querySelector('[role="dialog"]').innerText);
    const first = await stepText();
    ok('the popup shows the steps the category pack defines (a progress bar and the first question)', /Choose a service/.test(first) && (await page.$$('[role="dialog"] ol li')).length >= 3, first.slice(0, 200));
    await page.click('[role="dialog"] input[type="radio"]');
    await page.click('[role="dialog"] button[type="submit"]'); await wait(300);
    const needDate = await stepText();
    await page.click('[role="dialog"] button[type="submit"]'); await wait(300);
    ok('a required step cannot be skipped, and the message is a plain sentence', /Please pick a date/.test(await stepText()), needDate.slice(0, 160));
    await page.evaluate(() => { const i = document.querySelector('[role="dialog"] input[type="date"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; const d = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10); set.call(i, d); i.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.select('[role="dialog"] select', 'Morning');
    await page.click('[role="dialog"] button[type="submit"]'); await wait(300);
    await page.type('#sh-name', 'Popup Tester'); await page.type('#sh-phone', 'abc');
    await page.click('[role="dialog"] button[type="submit"]'); await wait(300);
    ok('a wrong phone number is refused in a plain sentence', /10-digit mobile/.test(await stepText()));
    await page.click('#sh-phone', { clickCount: 3 }); await page.type('#sh-phone', '9123456780');
    await page.click('[role="dialog"] button[type="submit"]'); await wait(300);
    ok('the last step shows what will be sent for checking', /Please check and send/.test(await stepText()) && /Popup Tester/.test(await stepText()));
    const before = await prisma.campaignLead.count({ where: { vendorId: clinic.id } });
    await page.click('[role="dialog"] button[type="submit"]'); await wait(1500);
    ok('after sending, the dialog says so and offers call, WhatsApp and add-to-calendar', /Request sent/.test(await stepText()) && /Call us/.test(await stepText()) && /Add to calendar/.test(await stepText()));
    const lead = await prisma.campaignLead.findFirst({ where: { vendorId: clinic.id, phone: { contains: '9123456780' } }, orderBy: { createdAt: 'desc' } });
    ok('the request is a lead in the vendor\'s own CRM through the existing flow (name, phone, the service and the date in the message)', !!lead && lead.name === 'Popup Tester' && /Real Alpha Service|Real Beta Service|Real Gamma Service/.test(lead.message ?? '') && /Morning/.test(lead.message ?? '') && (await prisma.campaignLead.count({ where: { vendorId: clinic.id } })) === before + 1, J(lead));
    // the page behind does not scroll while open (iOS safe) and is restored
    await open(clinic.url, 390);
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.evaluate(() => document.querySelector('nav[aria-label="Main"].fixed a[data-g4d-open]').click());
    await page.waitForSelector('[role="dialog"]');
    const locked = await page.evaluate(() => getComputedStyle(document.body).position === 'fixed');
    await page.keyboard.press('Escape'); await wait(300);
    const restored = await page.evaluate(() => getComputedStyle(document.body).position !== 'fixed' && Math.abs(window.scrollY - 400) < 5);
    ok('while the dialog is open the page behind does not scroll, and the scroll position is restored on close', locked && restored, J({ locked, restored }));
    // quick view
    await open(resto.url + '/menu', 390);
    const qv = await page.$('button[data-g4d-quickview]');
    if (qv) { await qv.evaluate((el) => el.scrollIntoView({ block: 'center' })); await qv.click(); await page.waitForSelector('[role="dialog"]', { timeout: 4000 }).catch(() => null); }
    const qvText = (await page.$('[role="dialog"]')) ? await stepText() : '';
    ok('a quick view opens the dish in a dialog with the vendor\'s own name and price', /Real (Butter Naan|Paneer Tikka|Dal Fry)/.test(qvText) && /₹/.test(qvText), qvText.slice(0, 150));
    await page.keyboard.press('Escape');
    // fallback address
    const fb = await get(`${clinic.url}/book`);
    ok('the fallback address (/book) is a real page with the same form: name, phone, e-mail, message and the same services', /<form/.test(fb.t) && /name="name"/.test(fb.t) && /name="phone"/.test(fb.t) && /Real Alpha Service/.test(fb.t) && fb.status === 200);
    // A browser with scripts off posts the form natively (multipart, the server action's id in a hidden field). We send exactly that, so the fallback is proved without a browser.
    const postForm = async (values) => {
      const page0 = await get(`${clinic.url}/book`);
      const form = new FormData();
      for (const m of page0.raw.matchAll(/<input type="hidden" name="([^"]+)"(?: value="([^"]*)")?/g)) form.append(m[1].replace(/&amp;/g, '&'), (m[2] ?? '').replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
      for (const [k, v] of Object.entries(values)) form.append(k, v);
      const r = await fetch(`${clinic.url}/book`, { method: 'POST', body: form, redirect: 'manual' });
      const loc = r.headers.get('location') ?? '';
      const after = loc ? await get(loc.startsWith('http') ? loc : `${FRONT}${loc}`) : null;
      return { status: r.status, loc, text: after ? strip(after.t) : '' };
    };
    const okPost = await postForm({ name: 'Plain Tester', phone: '9345678901', choice: 'Real Alpha Service', message: 'hello' });
    ok('with scripts off the form still works: the browser own form post sends it, comes back with a thank-you, and the lead is in the CRM', okPost.status >= 300 && okPost.status < 400 && /sent=1/.test(okPost.loc) && /Request sent/.test(okPost.text) && !!(await prisma.campaignLead.findFirst({ where: { vendorId: clinic.id, phone: { contains: '9345678901' } } })), J(okPost).slice(0, 300));
    const badPost = await postForm({ name: 'Bad Phone', phone: '12345' });
    ok('a wrong phone number on the fallback page gives a plain sentence and sends nothing', /e=phone/.test(badPost.loc) && /10-digit mobile/.test(badPost.text) && !(await prisma.campaignLead.findFirst({ where: { vendorId: clinic.id, name: 'Bad Phone' } })), J(badPost).slice(0, 300));
    const bot = await postForm({ name: 'Robot Name', phone: '9345678999', website: 'http://spam.example' });
    ok('a form filled in by a program (the hidden field) looks like it worked but creates no lead', /sent=1/.test(bot.loc) && !(await prisma.campaignLead.findFirst({ where: { vendorId: clinic.id, name: 'Robot Name' } })));
  }
  const hdrLinks = strip((await get(clinic.url)).t);
  ok('the main action is a real link to its own address even in the page source (nothing important hides behind a popup)', /<a[^>]*data-g4d-open="primary"[^>]*href="\/site\/[^"]+\/book/.test(hdrLinks) || /href="\/site\/[^"]+\/book[^"]*"[^>]*data-g4d-open/.test(hdrLinks));

  // ───────────────────────────── footer + social
  section('[feat:industry-designs.footer-social] Social icons come from the vendor\'s own links; an empty link hides its icon');
  const full = strip((await get(clinic.url)).t);
  const footerOf = (t) => /<footer[^>]*data-g4d-footer[\s\S]*?<\/footer>/.exec(t)?.[0] ?? '';
  const ff = footerOf(full);
  const hrefOf = (f, k) => new RegExp(`<a[^>]*href="([^"]+)"[^>]*data-g4d-social="${k}"|<a[^>]*data-g4d-social="${k}"[^>]*href="([^"]+)"`).exec(f);
  const want = { facebook: 'https://facebook.com/realpage', instagram: 'https://instagram.com/realpage', youtube: 'https://youtube.com/@realpage', linkedin: 'https://linkedin.com/company/realpage', whatsapp: 'https://wa.me/9876543210', maps: 'https://maps.google.com/?q=Chennai' };
  // the page streams in parts, so the finished footer is read from the browser's own page when there is one
  let got;
  if (page) { await open(clinic.url, 1280); got = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-g4d-footer] a[data-g4d-social]')].map((a) => [a.getAttribute('data-g4d-social'), a.getAttribute('href')]))); got.maps = got.maps ?? null; }
  else got = Object.fromEntries(Object.keys(want).map((k) => { const m = hrefOf(ff, k); return [k, m ? (m[1] ?? m[2]) : null]; }));

  ok('the footer shows an icon for every link the vendor filled in, pointing at the vendor\'s own address', Object.entries(want).every(([k, v]) => got[k] === v), J(got));
  const bare = await h.createVendor({ key: 'rtnosocial', industry: 'clinic', plan: 'WORKSPACE' });
  await flag(bare);
  await call('POST', '/site-doc/me/generate', { packKey: 'clinic', businessName: 'Rt No Social', city: 'Chennai' }, bare.token);
  await call('POST', '/site-doc/me/design', { designKey: 't:clinic-calm' }, bare.token); await call('POST', '/site-doc/me/publish', {}, bare.token);
  const nf = footerOf(strip((await get(sub(bare))).t));
  ok('a vendor with no social links gets no social icons for them (an empty link hides its icon)', ['facebook', 'instagram', 'youtube', 'linkedin', 'x', 'custom', 'maps'].every((k) => !new RegExp(`data-g4d-social="${k}"`).test(nf)) && nf.length > 0, nf.match(/data-g4d-social="[a-z]+"/g)?.join(','));
  await call('POST', '/site-doc/me/design', { designKey: 'classic' }, clinic.token); await call('POST', '/site-doc/me/publish', {}, clinic.token);
  const builtFooter = footerOf(strip((await get(clinic.url)).t));
  ok('a built-in design shows the same icons from the same links', hrefOf(builtFooter, 'instagram') !== null && hrefOf(builtFooter, 'facebook') !== null && /data-g4d-footer/.test(builtFooter));
  await call('POST', '/site-doc/me/design', { designKey: 't:clinic-calm' }, clinic.token);
  await call('PUT', '/site-doc/me/draft', { extras: { social: { x: 'https://x.com/realx', customLabel: 'Blog', customUrl: 'https://example.org/blog' } } }, clinic.token);
  await call('POST', '/site-doc/me/publish', {}, clinic.token);
  const withX = footerOf(strip((await get(clinic.url)).t));
  ok('X and one custom link can be added, and show with the vendor\'s own label', /data-g4d-social="x"/.test(withX) && /data-g4d-social="custom"/.test(withX) && /aria-label="Blog"/.test(withX));
  ok('the legal links and the quick links in the footer are real links', /href="\/site\/[^"]+\/legal\/privacy"/.test(withX) && /href="\/site\/[^"]+\/legal\/terms"/.test(withX) && count(withX, /<a /g) >= 10);
  const lg = await get(`${clinic.url}/legal/privacy`);
  ok('the privacy page exists, names the business and is kept out of search results', lg.status === 200 && /Rt Calm Clinic/.test(lg.t) && /noindex/.test(lg.t));

  // ───────────────────────────── editable
  section('[feat:industry-designs.editable] Every field a theme slot or the shell can show is reachable in the editor and reaches the page');
  const ev = await realSite('rtedit', 'clinic', 'BOS', 'clinic', 'Zed Edit Clinic', 't:clinic-calm');
  const M = (k) => `Zed${k}Mark`;
  const draft = {
    businessName: M('Name'), tagline: M('Tagline'), about: M('About'), phone: '9000000001', whatsapp: '9000000002', email: 'zed@example.org', address: M('Address'), businessHours: 'Mon-Fri 8 am to 4 pm',
    facebook: 'https://facebook.com/zed', instagram: 'https://instagram.com/zed', youtube: 'https://youtube.com/@zed', linkedin: 'https://linkedin.com/company/zed', googleMaps: 'https://maps.google.com/?q=Zed',
    seoTitle: M('SeoTitle'), seoDesc: M('SeoDesc'),
    extras: {
      announcement: M('Announce'), headline: M('Headline'), subline: M('Subline'), ctaLabel: M('Cta'), trust: [M('Trust')], faq: [{ q: M('FaqQ'), a: M('FaqA') }], steps: [{ title: M('StepT'), desc: M('StepD') }], stats: [{ value: '77', label: M('StatL') }],
      team: [{ name: M('TeamName'), role: M('TeamRole'), note: M('TeamNote') }],
      navigation: { primaryLabel: M('Primary'), header: [{ label: M('HeadLink'), target: 'about' }], bottom: [{ key: 'action', label: 'ZedBar' }] },
      popup: { confirm: M('Confirm'), email: 'required', message: 'hidden' }, social: { x: 'https://x.com/zed', customLabel: M('Custom'), customUrl: 'https://example.org/zed' },
    },
    testimonials: [{ quote: M('Quote'), author: M('QuoteBy') }], pages: [{ slug: 'zed', title: M('PageTitle'), body: M('PageBody') }],
  };
  const dr = await call('PUT', '/site-doc/me/draft', draft, ev.token); await call('POST', '/site-doc/me/publish', {}, ev.token);
  const all = {};
  for (const p of ['', '/about', '/contact', '/services', '/doctors', '/p/zed']) all[p || '/'] = (await get(`${ev.url}${p}`)).t;
  const blob = Object.values(all).join('\n');
  const where = { Announce: 1, Name: 1, Tagline: 1, About: 1, Address: 1, Headline: 1, Subline: 1, Trust: 1, FaqQ: 1, StepT: 1, TeamName: 1, TeamRole: 1, HeadLink: 1, Primary: 1, Quote: 1, QuoteBy: 1, PageTitle: 1, PageBody: 1, Custom: 1, Confirm: 1 };
  const missing = Object.keys(where).filter((k) => !blob.includes(M(k)));
  ok(`every text field the editor has shows on the theme\'s pages (${Object.keys(where).length} fields: name, tagline, about, address, headline, sub-line, trust, question, step, number, team, quote, vendor page, header link, main button, social label, thank-you message)`, dr.status < 300 && missing.length === 0, `${dr.status} missing: ${missing.join(',')}`);
  const hasAll = ['9000000001', 'zed@example.org', 'Mon-Fri 8 am to 4 pm', 'https://facebook.com/zed', 'https://instagram.com/zed', 'https://x.com/zed', 'https://maps.google.com/?q=Zed', 'ZedBar'].filter((x) => !blob.includes(x));
  ok('the phone, e-mail, hours, social links, map link and the phone-bar label show too', hasAll.length === 0, hasAll.join(' | '));
  ok('the SEO title and description reach the head of the home page', all['/'].includes(M('SeoTitle')) && all['/'].includes(M('SeoDesc')));
  ok('the popup settings reach the page: the vendor\'s thank-you message, e-mail required, message box hidden', new RegExp(`"confirm":"${M('Confirm')}"`).test(all['/'].replace(/\\"/g, '"')) && /"email":"required"/.test(all['/'].replace(/\\"/g, '"')) && /"message":"hidden"/.test(all['/'].replace(/\\"/g, '"')));
  const sourceTabs = ['SiteEditorV2.tsx', 'SiteContentTabs.tsx', 'SiteShellTabs.tsx'].map((f) => require('fs').readFileSync(path.join(FE, 'src', 'app', 'dashboard', 'my-website', f), 'utf8')).join('\n');
  ok('the editor has a tab for Navigation, Popup form and Preview, and the About tab has the extra social links', ['navigation', 'popup', 'preview'].every((k) => new RegExp(`key: '${k}'`).test(sourceTabs)) && /SocialExtraFields/.test(sourceTabs));
  const keys = ['businessName', 'tagline', 'about', 'phone', 'whatsapp', 'email', 'address', 'businessHours', 'facebook', 'instagram', 'linkedin', 'youtube', 'googleMaps', 'seoTitle', 'seoDesc'];
  const noInput = keys.filter((k) => !sourceTabs.includes(`'${k}'`) && !sourceTabs.includes(`"${k}"`));
  ok('every plain field has an input in the editor', noInput.length === 0, noInput.join(','));

  // ───────────────────────────── seo
  section('[feat:industry-designs.seo] Titles, descriptions, canonical, one H1, alt text, social cards, structured data, per-host sitemap and robots, noindex while not public — through imported themes');
  const hp = (await get(clinic.url)).raw;
  const meta = (name, attr = 'name') => (new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`).exec(hp) ?? [])[1] ?? '';
  ok('the home page has a title, a description, a canonical address on the vendor\'s host, and the social card tags', /<title>[^<]+<\/title>/.test(hp) && meta('description').length > 10 && new RegExp(`<link rel="canonical" href="https://${clinic.subdomain}\\.get4domain\\.com/?"`).test(hp) && meta('og:title', 'property') && meta('og:description', 'property') && /og:url/.test(hp));
  const ld = [...hp.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => { try { return JSON.parse(m[1]); } catch { return null; } }).filter(Boolean);
  ok('structured data names the business with the category\'s type (MedicalClinic for a clinic), its address and phone', ld.some((x) => x['@type'] === 'MedicalClinic' && x.name === 'Rt Calm Clinic' && x.telephone), J(ld).slice(0, 200));
  ok('every picture has alt text and there is exactly one H1', !/<img(?![^>]*\balt=)[^>]*>/.test(strip(hp)) && count(strip(hp), /<h1[\s>]/g) === 1);
  const robots = await getWithHost('/robots.txt', `${clinic.subdomain}.get4domain.com`);
  ok('robots.txt of the vendor\'s host allows the site and names its own sitemap', /Allow: \//.test(robots.text) && new RegExp(`Sitemap: https://${clinic.subdomain}\\.get4domain\\.com/sitemap\\.xml`).test(robots.text), robots.text.slice(0, 200));
  const st = await h.createVendor({ key: 'rtstarter2', industry: 'clinic', plan: 'WORKSPACE' });
  await flag(st); await call('POST', '/site-doc/me/generate', { packKey: 'clinic', businessName: 'Rt Starter Two', city: 'Chennai' }, st.token);
  await call('POST', '/site-doc/me/design', { designKey: 't:clinic-calm' }, st.token); await call('POST', '/site-doc/me/publish', {}, st.token);
  const sg = await get(sub(st));
  ok('a themed site that shows only starter content asks search engines not to index it', /<meta name="robots" content="noindex/.test(sg.raw), (sg.raw.match(/<meta name="robots"[^>]*>/) ?? [''])[0]);
  ok('a themed site with the vendor\'s own content is open to search engines', !/<meta name="robots" content="noindex/.test(hp));
  const smSt = await getWithHost('/sitemap.xml', `${st.subdomain}.get4domain.com`);
  ok('the sitemap of a starter-only site is empty', !/<loc>/.test(smSt.text));
  const adm = await call('POST', '/admin/category-packs/sites', { categoryKey: 'clinic', businessName: 'Rt Admin Draft', subdomain: 'rt-admin-draft', city: 'Chennai' }, A);
  const dp = await get(`${FRONT}/site/rt-admin-draft`);
  ok('an admin-created draft site is hidden from the public even when a theme is chosen', !dp.t.includes('Rt Admin Draft') && (dp.status === 404 || /noindex/.test(dp.raw)), `${dp.status}`);
  const pv = await get(`${FRONT}${adm.data.previewUrl}&design=t:clinic-calm`);
  ok('the private preview link of that draft shows the theme and is not indexable', pv.status === 200 && /noindex/.test(pv.raw) && strip(pv.t).includes('g4d-theme-clinic-calm'));
  ok('the bottom bar, the footer and the form addresses are real links in the page source', /<nav aria-label="Main" class="fixed/.test(hp) && (phoneBarOf(hp)?.items ?? []).length === 5 && /href="\/site\/[^"]+\/book/.test(hp) && /href="\/site\/[^"]+\/legal\/privacy"/.test(hp));
  const tp = await get(`${FRONT}/theme-pack/${ctx.ids['clinic-calm']}?category=clinic`);
  ok('the admin theme preview page is never indexed and says it is sample content', tp.status === 200 && /noindex/.test(tp.raw) && /sample content/i.test(tp.t));

  // ───────────────────────────── contrast (admin shows it at import)
  section('[feat:industry-designs.contrast] Contrast is checked on every theme at import and shown to the admin');
  for (const [k, id] of Object.entries(ctx.ids)) {
    const d = (await call('GET', `/admin/themes/${id}`, undefined, A)).data;
    ok(`${k}: the import recorded a contrast check of ${d.lint?.contrast?.length ?? 0} colour pairs, all at least 4.5 to 1`, (d.lint?.contrast?.length ?? 0) >= 4 && d.lint.contrast.every((c) => c.ok && c.ratio >= 4.5), J(d.lint?.contrast));
  }
  const low = await (async () => {
    const core = h.dist('themes/core'); const dir = path.join(__dirname, '..', '..', '..', 'themes', 'reference', 'clinic-calm'); const fs = require('fs');
    const files = []; const walk = (r) => { for (const e of fs.readdirSync(path.join(dir, r))) { const p = r ? `${r}/${e}` : e; if (fs.statSync(path.join(dir, p)).isDirectory()) walk(p); else files.push({ path: p, data: new Uint8Array(fs.readFileSync(path.join(dir, p))) }); } }; walk('');
    const m = JSON.parse(Buffer.from(files.find((f) => f.path === 'theme.json').data).toString()); m.id = 'clinic-low'; m.colors = { ...m.colors, accent: '#bbbbbb' };
    const f2 = files.map((f) => (f.path === 'theme.json' ? { path: 'theme.json', data: new Uint8Array(Buffer.from(JSON.stringify(m))) } : f));
    const form = new FormData(); form.append('file', new Blob([Buffer.from(core.makeZip(f2))], { type: 'application/zip' }), 't.zip');
    const r = await fetch(`${h.base}/admin/themes/import?dryRun=1`, { method: 'POST', headers: { Authorization: `Bearer ${A}` }, body: form });
    return (await r.json()).data;
  })();
  ok('a theme whose colours fail contrast is imported with a clear warning and a failing line in the admin\'s contrast table', low.contrast.some((c) => !c.ok) && low.lines.some((l) => l.level === 'warn' && /Contrast/.test(l.text)), J(low.contrast));

  // ───────────────────────────── speed
  section('[feat:industry-designs.speed] Page budget on a throttled phone on the production build: LCP under 2.5 s, CLS under 0.1');
  if (!page) console.log('  SKIP  no Chrome or Edge found: throttled run not done');
  else {
    const cdp = await page.createCDPSession();
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.evaluateOnNewDocument(() => {
      window.__lcp = 0; window.__cls = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    });
    const probes = [['clinic theme', clinic.url], ['restaurant theme', resto.url], ['clinic theme, a service page', `${clinic.url}/services`], ['restaurant theme, the menu', `${resto.url}/menu`]];
    await call('POST', '/site-doc/me/design', { designKey: 'classic' }, bare.token); await call('POST', '/site-doc/me/publish', {}, bare.token);
    probes.push(['a built-in design with the shell', sub(bare)]);
    const lines = [];
    for (const [name, url] of probes) {
      await page.setViewport({ width: 390, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      await page.goto('about:blank');
      await page.goto(url, { waitUntil: 'load', timeout: 90000 });
      await wait(2500);
      const m = await page.evaluate(() => ({ lcp: window.__lcp, cls: window.__cls }));
      lines.push({ name, lcp: Math.round(m.lcp), cls: Math.round(m.cls * 1000) / 1000 });
    }
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    console.log(`        measured (Slow 4G, 4x slower CPU, phone): ${lines.map((l) => `${l.name}: LCP ${l.lcp} ms, CLS ${l.cls}`).join(' | ')}`);
    ok('the largest content paints in under 2.5 s on every page tried', lines.every((l) => l.lcp > 0 && l.lcp < 2500), J(lines));
    ok('layout shift is under 0.1 on every page tried', lines.every((l) => l.cls < 0.1), J(lines));
  }
  const homeHtml = await get(clinic.url);
  const scripts = [...new Set([...homeHtml.t.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]))];
  let jsBytes = 0; for (const sx of scripts) { const r = await fetch(sx.startsWith('http') ? sx : `${FRONT}${sx}`); jsBytes += (await r.arrayBuffer()).byteLength; }
  ok(`a theme page weighs ${(Buffer.byteLength(homeHtml.raw) / 1024).toFixed(0)} KB of HTML (budget 250 KB) and ${(jsBytes / 1024).toFixed(0)} KB of scripts (budget 900 KB); only the popup, tabs, bottom bar and cart are interactive`, Buffer.byteLength(homeHtml.raw) < 250 * 1024 && jsBytes < 900 * 1024, `${Buffer.byteLength(homeHtml.raw)} ${jsBytes}`);
  ok('pictures below the first screen are lazy-loaded and the first one is eager', /loading="eager"/.test(homeHtml.t) && count(homeHtml.t, /loading="lazy"/g) >= 2);
  ok('fonts are loaded with display=swap, and each theme page loads a fixed number of font families', /display=swap/.test(homeHtml.t) || !/fonts\.googleapis/.test(homeHtml.t));

  // ───────────────────────────── no hard-coded text
  section('[feat:industry-designs.no-hardcode] A themed site with nothing in it shows no business text, no stock picture and no other business\'s words');
  const emptyV = await h.createVendor({ key: 'rtempty', industry: 'clinic', plan: 'WORKSPACE' });
  await flag(emptyV);
  await call('PUT', '/site-doc/me/draft', { designKey: 't:clinic-calm', businessName: 'Rt Empty Co' }, emptyV.token);
  await call('POST', '/site-doc/me/publish', {}, emptyV.token);
  const eh = strip((await get(sub(emptyV))).t);
  const sd = clinicPack.config.seed;
  const probes = [sd.headline.replace('{business}', ''), ...sd.items.map((i) => i.title), ...sd.faq.map((f) => f.q), sd.about.slice(0, 40), ...sd.trust, ...sd.quotes.map((q) => q.quote)].filter((x) => x && x.trim().length > 6);
  ok('an empty themed clinic site contains none of the clinic starter headline, items, questions, About or trust text (no render-time fallback)', probes.every((x) => !eh.includes(x)), probes.filter((x) => eh.includes(x)).join(' | '));
  ok('and no stock picture address and no other business\'s name', !/unsplash|pexels|pixabay|shutterstock/i.test(eh) && !/Sample (Clinic|Salon|Restaurant)/.test(eh));
  ok('sections that have nothing to show are hidden, not drawn empty (no empty list headings)', !/Meet the people who will look after you|Kind words from people we have treated|Questions before you visit/.test(eh), eh.match(/Meet the people[^<]*|Kind words[^<]*|Questions before[^<]*/g)?.join(' | '));
  const fsx = require('fs');
  const tplDir = (n) => path.join(__dirname, '..', '..', '..', 'themes', 'reference', n);
  const hard = [];
  for (const n of ['clinic-calm', 'restaurant-hearth']) for (const f of fsx.readdirSync(tplDir(n)).filter((x) => x.endsWith('.html'))) { const html = fsx.readFileSync(path.join(tplDir(n), f), 'utf8').replace(/\{\{[^}]*\}\}/g, ''); if (/₹|\bRs\.?\s?\d|\b\d{10}\b|@[a-z0-9-]+\.(com|in|org)|lorem ipsum|unsplash|\b(Dr|Mr|Mrs)\.? [A-Z]/i.test(html)) hard.push(`${n}/${f}`); }
  ok('the reference theme templates contain no price, phone number, e-mail address, person or placeholder text of their own', hard.length === 0, hard.join(' | '));

  // ───────────────────────────── dynamic
  section('[feat:industry-designs.dynamic] A category made only in Admin gets its own words, phone bar, popup steps and the family\'s requirements with no code');
  const base = JSON.parse(JSON.stringify(clinicPack.config));
  const shell = { terms: { team: 'Therapists', teamOne: 'Therapist', items: 'Sessions', itemOne: 'Session', groups: 'Programmes' },
    bottomNav: [{ key: 'home', label: 'Today', icon: 'home', target: 'home' }, { key: 'items', label: 'Sessions', icon: 'services', target: 'items' }, { key: 'action', label: 'Reserve', icon: 'book', target: 'action' }, { key: 'team', label: 'Therapists', icon: 'users', target: 'team' }, { key: 'more', label: 'More', icon: 'more', target: 'more' }],
    popup: { title: 'Reserve a session', steps: [{ key: 'which', kind: 'choose', label: 'Which therapy?', source: 'items', required: true }, { key: 'when', kind: 'when', label: 'Pick a day', options: ['Morning', 'Evening'], required: true }, { key: 'details', kind: 'details', label: 'Your details', required: true }, { key: 'confirm', kind: 'confirm', label: 'Confirm' }], confirm: 'Reserved. We will confirm by phone.' } };
  const cfg = { ...base, shell, family: 'booking', ctaLabel: 'Reserve now' };
  const bad4 = await call('POST', '/admin/category-packs', { key: 'physio-studio', name: 'Physio studio', config: { ...cfg, shell: { ...shell, bottomNav: shell.bottomNav.slice(0, 4) } } }, A);
  ok('a pack with four phone-bar slots is refused in a plain sentence', bad4.status === 400 && /5 slots/.test(bad4.body.message), J(bad4.body).slice(0, 200));
  const noDetails = await call('POST', '/admin/category-packs', { key: 'physio-studio', name: 'Physio studio', config: { ...cfg, shell: { ...shell, popup: { ...shell.popup, steps: shell.popup.steps.filter((s) => s.kind !== 'details') } } } }, A);
  ok('a popup without a name-and-phone step is refused (the business must be able to call back)', noDetails.status === 400 && /details step/.test(noDetails.body.message), J(noDetails.body).slice(0, 200));
  const made = await call('POST', '/admin/category-packs', { key: 'physio-studio', name: 'Physio studio', config: cfg }, A);
  ok('the same pack with a valid shell is created in Admin, no code', made.status < 300, J(made.body).slice(0, 300));
  const cat = (await call('PUT', `/admin/themes/${ctx.ids['clinic-calm']}`, { categories: ['clinic', 'diagnostics', 'physio-studio'] }, A));
  ok('a theme of the same family can be assigned to the new category in Admin', cat.status < 300, J(cat.body).slice(0, 200));
  const site = await call('POST', '/admin/category-packs/sites', { categoryKey: 'physio-studio', businessName: 'Rt Physio Studio', subdomain: 'rt-physio', city: 'Chennai', phone: '9876543210' }, A);
  const pvx = await get(`${FRONT}${site.data.previewUrl}&design=t:clinic-calm`);
  const barx = phoneBarOf(pvx.t);
  ok('its theme page has the new category\'s own phone bar words (Today, Sessions, Reserve, Therapists, More)', !!barx && ['Today', 'Sessions', 'Reserve', 'Therapists', 'More'].every((w) => barx.items.some((i) => i.includes(w))), J(barx));
  ok('its popup carries the new category\'s own steps (Which therapy?, Pick a day) and thank-you message', /Which therapy\?/.test(pvx.t) && /Pick a day/.test(pvx.t) && /Reserved\. We will confirm by phone\./.test(pvx.t));
  const builtx = await get(`${FRONT}${site.data.previewUrl}`);
  ok('a built-in design of the new category shows the same words, and the family\'s signature items (a booking action, services in the list)', /Reserve/.test(builtx.t) && /data-g4d-footer/.test(builtx.t) && /Which therapy\?/.test(builtx.t) && /data-layout="/.test(builtx.t));
  if (page) {
    await open(`${FRONT}${site.data.previewUrl}&design=t:clinic-calm`, 390);
    await page.evaluate(() => document.querySelector('nav[aria-label="Main"].fixed a[data-g4d-open]').click());
    const dlg = await page.waitForSelector('[role="dialog"]', { timeout: 5000 }).catch(() => null);
    ok('in Chrome the new category\'s popup opens with its own first question', !!dlg && /Which therapy\?/.test(await page.evaluate(() => document.querySelector('[role="dialog"]').innerText)));
  }
  ok('no page script error and no console error during the whole shell, popup and speed run', pageErrors.length === 0 && consoleErrors.length === 0, [...new Set([...pageErrors, ...consoleErrors])].slice(0, 4).join(' | '));
};
