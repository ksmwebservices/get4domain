import { STAFF, siteWorld } from './support/site-world';

/** S1 shell, platform side, through the real build: a Pro site gets the request sheet, the install script and the manifest; a Free site gets none of it. */
jest.setTimeout(120_000);

describe('the app shell in a built site', () => {
  it('Pro: five-item bar, request sheet with the plumber questions and the item picker, install button, script, manifest and css', async () => {
    const w = siteWorld({ level: 'PRO', claimed: true });
    const { publication: p } = await w.build.build('v-plumber', { actor: STAFF });
    const pages = await w.repo.pagesOf(p.id);
    const paths = pages.map((x) => x.path).sort();
    expect(paths).toEqual(expect.arrayContaining(['/assets/shell.js', '/assets/manifest.webmanifest', '/assets/site.css']));
    const home = pages.find((x) => x.path === '/')!.html;
    expect(home).toContain('data-g4d-slot="request-sheet"');
    expect(home).toContain('name="f_address"');
    expect(home).toContain('name="f_when"');
    expect(home).toMatch(/<select id="[^"]+" name="item"><option value="">Not sure yet<\/option><option value="i1">/);
    expect(home).toContain('data-g4d-slot="install-button"');
    expect(home).toContain('<link rel="manifest" href="/assets/manifest.webmanifest">');
    expect(home).toContain('<script src="/assets/shell.js" defer></script>\n</body>');   // at the end of the body: the head carries only the platform's own data blocks
    expect(home.slice(0, home.indexOf('</head>'))).not.toContain('shell.js');
    const nav = /<nav[^>]*data-g4d-slot="bottom-nav"[\s\S]*?<\/nav>/.exec(home)?.[0] ?? '';
    expect([...nav.matchAll(/data-track="([a-z]+)"/g)].map((m) => m[1])).toEqual(['home', 'services', 'request', 'call', 'whatsapp']);
    const css = pages.find((x) => x.path === '/assets/site.css')!.html;
    expect(css).toContain('.g4d-sheet:target');
    const manifest = JSON.parse(pages.find((x) => x.path === '/assets/manifest.webmanifest')!.html) as Record<string, unknown>;
    expect(manifest).toMatchObject({ name: 'Sri Ganesh Plumbing', start_url: '/', display: 'standalone' });
    const js = pages.find((x) => x.path === '/assets/shell.js')!.html;
    expect(js).toContain('beforeinstallprompt'); expect(js).not.toMatch(/fetch\(|XMLHttpRequest|localStorage|document\.cookie/);
  });

  it('an item page has its own item already selected in the sheet', async () => {
    const w = siteWorld({ level: 'PRO', claimed: true });
    const { publication: p } = await w.build.build('v-plumber', { actor: STAFF });
    const item = (await w.repo.pagesOf(p.id)).find((x) => x.path === '/services/tap-repair-i1')!.html;
    expect(item).toMatch(/<option value="i1" selected>/);
  });

  it('Free: none of the shell in the page, and no shell script or manifest file', async () => {
    const w = siteWorld({ level: 'FREE', claimed: true });
    const { publication: p } = await w.build.build('v-plumber', { actor: STAFF });
    const pages = await w.repo.pagesOf(p.id);
    expect(pages.map((x) => x.path)).not.toEqual(expect.arrayContaining(['/assets/shell.js']));
    expect(pages.some((x) => x.path === '/assets/manifest.webmanifest')).toBe(false);
    const home = pages.find((x) => x.path === '/')!.html;
    for (const bad of ['g4d-request', 'request-sheet', 'install-button', 'chat-drawer', 'shell.js', 'manifest', 'action="/enquire"']) expect(home).not.toContain(bad);
  });
});
