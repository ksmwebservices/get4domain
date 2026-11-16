import { Controller, Get, Header } from '@nestjs/common';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { buildCorsOptions, CORS_EXPOSED_HEADERS } from '../src/common/cors';

/** Job K3: Content-Disposition is exposed to browser scripts, so a download fetched by script keeps the file name the server chose. */
jest.setTimeout(120_000);

@Controller('probe')
class DownloadController {
  @Get('file') @Header('Content-Disposition', 'attachment; filename="invoice-INV-2026-0001.html"') @Header('Content-Type', 'text/html; charset=utf-8')
  file(): string { return '<p>invoice</p>'; }
}
async function appWith(env: Record<string, string | undefined>): Promise<INestApplication> {
  const mod = await Test.createTestingModule({ controllers: [DownloadController] }).compile();
  const app = mod.createNestApplication(); app.enableCors(buildCorsOptions(env)); await app.init(); return app;
}
const expose = (r: { headers: Record<string, string> }): string[] => String(r.headers['access-control-expose-headers'] ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

describe('the options', () => {
  it('both modes expose Content-Disposition and nothing else, and nothing else about them changed', () => {
    expect([...CORS_EXPOSED_HEADERS]).toEqual(['Content-Disposition']);
    expect(buildCorsOptions({})).toEqual({ origin: true, credentials: true, exposedHeaders: ['Content-Disposition'] });
    const strict = buildCorsOptions({ CORS_MODE: 'strict' }); expect(strict.exposedHeaders).toEqual(['Content-Disposition']); expect(strict.credentials).toBe(true); expect(typeof strict.origin).toBe('function');
  });
  it('the exposed list is a copy: changing the options of one app cannot change the constant', () => {
    const o = buildCorsOptions({}); (o.exposedHeaders as string[]).push('X-Secret'); expect([...CORS_EXPOSED_HEADERS]).toEqual(['Content-Disposition']); expect(buildCorsOptions({}).exposedHeaders).toEqual(['Content-Disposition']);
  });
});

describe('on a real app', () => {
  it('open mode: a cross-origin download answers Access-Control-Expose-Headers with Content-Disposition, and the header itself is there', async () => {
    const app = await appWith({});
    try {
      const r = await request(app.getHttpServer()).get('/probe/file').set('Origin', 'https://vendor.example.com');
      expect(r.status).toBe(200); expect(r.headers['access-control-allow-origin']).toBe('https://vendor.example.com'); expect(expose(r)).toEqual(['content-disposition']);
      expect(r.headers['content-disposition']).toBe('attachment; filename="invoice-INV-2026-0001.html"');
    } finally { await app.close(); }
  });
  it('strict mode: an allowed origin gets the exposure; a stranger gets no CORS answer at all (nothing was loosened)', async () => {
    const app = await appWith({ CORS_MODE: 'strict', CORS_EXTRA_ORIGINS: 'shop.example.com' });
    try {
      const ok = await request(app.getHttpServer()).get('/probe/file').set('Origin', 'https://shop.example.com'); expect(ok.headers['access-control-allow-origin']).toBe('https://shop.example.com'); expect(expose(ok)).toEqual(['content-disposition']);
      const platform = await request(app.getHttpServer()).get('/probe/file').set('Origin', 'https://app.get4domain.com'); expect(expose(platform)).toEqual(['content-disposition']);
      const bad = await request(app.getHttpServer()).get('/probe/file').set('Origin', 'https://evil.example.org'); expect(bad.headers['access-control-allow-origin']).toBeUndefined(); expect(expose(bad)).toEqual([]);
    } finally { await app.close(); }
  });
  it('a request with no Origin (a server call, curl) is unchanged: same body and file name, and no origin is granted', async () => {
    const app = await appWith({}); try { const r = await request(app.getHttpServer()).get('/probe/file'); expect(r.status).toBe(200); expect(r.text).toBe('<p>invoice</p>'); expect(r.headers['content-disposition']).toContain('invoice-INV-2026-0001.html'); expect(r.headers['access-control-allow-origin']).toBeUndefined(); } finally { await app.close(); }
  });
  it('a preflight still answers as before (the exposed list is for the real response, not the preflight)', async () => {
    const app = await appWith({});
    try { const r = await request(app.getHttpServer()).options('/probe/file').set('Origin', 'https://vendor.example.com').set('Access-Control-Request-Method', 'GET'); expect(r.status).toBe(204); expect(r.headers['access-control-allow-origin']).toBe('https://vendor.example.com'); expect(r.headers['access-control-allow-credentials']).toBe('true'); } finally { await app.close(); }
  });
});
