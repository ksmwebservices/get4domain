// scratch: boot, register themes, create a clinic site (WORKSPACE plan) on t:clinic-calm and print what each page answers
const L = require('./lib');
(async () => {
  const s = await L.boot();
  if (!s) { console.log('no pglite'); return; }
  try {
    console.log('build', s.build);
    const { h } = s;
    const admin = await h.createAdmin({ key: 'exadmin' });
    const A = admin.token;
    await h.call('POST', '/admin/category-packs/seed/starter', {}, A);
    await L.registerReference(h, A);
    const v = await h.createVendor({ key: 'exclinic', industry: 'clinic', plan: 'WORKSPACE' });
    await h.prisma.vendorAddon.upsert({ where: { vendorId_addonKey: { vendorId: v.id, addonKey: 'site_doc_v2' } }, create: { vendorId: v.id, addonKey: 'site_doc_v2', enabled: true }, update: { enabled: true } });
    await h.call('POST', '/site-doc/me/generate', { packKey: 'clinic', businessName: 'Zq Calm Clinic', city: 'Chennai' }, v.token);
    const pv = await h.call('POST', '/site-doc/me/preview-link', {}, v.token);
    const link = pv.data.url;
    console.log('link', link.slice(0, 80));
    const u = new URL(link, 'http://x');
    const q = u.search;
    for (const rest of ['', '/services', '/services/general-consultation', '/doctors', '/about', '/gallery', '/contact', '/book', '/legal/privacy', '/nope']) {
      const url = `${L.FRONT}/site/${v.subdomain}${rest}${q}&design=t:clinic-calm`;
      const g = await L.get(url);
      if (['/services','/book','/contact'].includes(rest) || rest.startsWith('/services/gen')) require('fs').writeFileSync(`${process.env.TEMP}/clinic${rest.split('/').join('_')}.html`, g.raw);
      console.log((rest || '/').padEnd(16), g.status, String(g.raw.length).padStart(7), 'h1:', (g.t.match(/<h1[\s>]/g) || []).length, 'theme:', /g4d-theme-clinic-calm/.test(g.t));
      if (!rest) require('fs').writeFileSync(`${process.env.TEMP}/clinic-home.html`, g.raw);
    }
  } catch (e) { console.log('ERR', e.stack || e); } finally { await s.stop(); process.exit(0); }
})();
