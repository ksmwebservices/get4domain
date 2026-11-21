import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AdminGuard } from '../src/auth/guards/admin.guard';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { buildValidationPipe } from '../src/common/pipes/edit-validation.pipe';
import { throttlerGuardProvider, throttlerImport } from '../src/common/throttling';
import { FeatureGuard } from '../src/plans/entitlements/feature.guard';
import { gstinCheckChar } from '../src/v3-payments/core/doc-core';
import { MeDocumentsController } from '../src/v3-payments/api/documents.controllers';
import { DocumentsService } from '../src/v3-payments/documents.service';
import { AdminFirmController } from '../src/v3-firm/api/firm.controllers';
import { FIRM_DEFAULTS, FirmProfile } from '../src/v3-firm/core/firm-core';
import { FirmService } from '../src/v3-firm/firm.service';
import { FirmStore } from '../src/v3-firm/firm.store';
import { MemoryDocumentsStore } from './support/memory-documents-store';

/** Invalid tax input is a registered 400 with a plain message that never repeats the entered value, on the vendor tax profile and on the firm profile. */
jest.setTimeout(120_000);

class MemoryFirmStore extends FirmStore {
  row: FirmProfile = { ...FIRM_DEFAULTS };
  async get() { return { ...this.row }; }
  async update(patch: Partial<FirmProfile>) { this.row = { ...this.row, ...patch }; return { ...this.row }; }
}
const G = '33ABCDE1234F1Z' + gstinCheckChar('33ABCDE1234F1Z');
const BAD_STATE = '00ABCDE1234F1Z' + gstinCheckChar('00ABCDE1234F1Z');
const SECRET = 'ZZ-SECRET-VALUE-9';

let app: INestApplication;
beforeEach(async () => {
  const docsStore = new MemoryDocumentsStore();
  const mod = await Test.createTestingModule({
    imports: [throttlerImport],
    controllers: [MeDocumentsController, AdminFirmController],
    providers: [
      throttlerGuardProvider, AdminGuard,
      { provide: DocumentsService, useFactory: () => new DocumentsService(docsStore, null as never, null as never, null as never, null as never, null as never, null as never, null as never, 'https://x.test/doc') },
      { provide: FirmService, useFactory: () => new FirmService(new MemoryFirmStore()) },
    ],
  }).overrideGuard(FeatureGuard).useValue({ canActivate: () => true }).compile();
  app = mod.createNestApplication();
  app.use((req: { headers: Record<string, string>; user?: unknown }, _res: unknown, next: () => void) => {
    if (req.headers['x-vendor']) req.user = { sub: 'u1', email: 'o@x.invalid', role: 'VENDOR', kind: 'vendor', vendorId: 'v1' };
    else if (req.headers['x-test-role']) req.user = { sub: 'staff-1', email: 's@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: req.headers['x-test-role'] };
    next();
  });
  app.useGlobalPipes(buildValidationPipe()); app.useGlobalInterceptors(new TransformInterceptor()); app.useGlobalFilters(new HttpExceptionFilter()); await app.init();
});
afterEach(async () => { await app.close(); });

const vendorPut = (body: object) => request(app.getHttpServer()).put('/v3/me/tax-profile').set({ 'x-vendor': '1' }).send(body);
const firmPut = (body: object) => request(app.getHttpServer()).put('/v3/admin/firm-profile').set({ 'x-test-role': 'SUPER_ADMIN' }).send(body);
const ok = { gstRegistered: true, gstin: G, legalName: 'Priya Stores', address: '12 Main Road, Chennai' };

/** A refusal: 400, a string code (registered), a plain message, and none of the entered text in the body. */
const refused = (r: request.Response, entered: string | null) => {
  expect([r.status, r.body.code]).toEqual([400, expect.any(String)]);
  expect(typeof r.body.message === 'string' || Array.isArray(r.body.message)).toBe(true);
  if (entered) expect(JSON.stringify(r.body)).not.toContain(entered);
};

describe('vendor tax profile, PUT /v3/me/tax-profile', () => {
  it('a good profile saves', async () => { expect((await vendorPut(ok)).status).toBe(200); });
  it('an invalid GSTIN is a registered 400 that does not repeat it', async () => {
    refused(await vendorPut({ ...ok, gstin: 'nope' }), 'nope');
    refused(await vendorPut({ ...ok, gstin: SECRET }), SECRET);
    refused(await vendorPut({ ...ok, gstin: 12345 }), '12345');
  });
  it('a wrong state code (in the GSTIN, or sent alone) is a registered 400', async () => {
    refused(await vendorPut({ ...ok, gstin: BAD_STATE }), BAD_STATE);
    refused(await vendorPut({ ...ok, gstin: G, stateCode: '00' }), null);
  });
  it('a GST-registered profile with no GSTIN, an empty legal name or an empty address is a registered 400', async () => {
    refused(await vendorPut({ ...ok, gstin: undefined }), null);
    refused(await vendorPut({ ...ok, legalName: '' }), null);
    refused(await vendorPut({ ...ok, legalName: '   ' }), null);
    refused(await vendorPut({ ...ok, address: '' }), null);
  });
  it('oversize and wrong-type input is a registered 400, never a 500', async () => {
    refused(await vendorPut({ ...ok, gstin: 'A'.repeat(500) }), 'AAAAAAAAAA');
    refused(await vendorPut({ ...ok, legalName: 'L'.repeat(5000) }), 'LLLLLLLLLL');
    refused(await vendorPut({ ...ok, address: 'D'.repeat(5000) }), 'DDDDDDDDDD');
    refused(await vendorPut({ ...ok, invoicePrefix: 'P'.repeat(500) }), 'PPPPPPPPPP');
    refused(await vendorPut({ ...ok, gstRegistered: 'yes' }), 'yes');
    refused(await vendorPut({ ...ok, legalName: { a: 1 } }), null);
  });
});

describe('firm profile, PUT /v3/admin/firm-profile (GSTIN and PAN)', () => {
  it('a good edit saves', async () => { expect((await firmPut({ gstin: G, pan: G.slice(2, 12), legalName: 'KSM QUANTUM TECHNOLOGIES' })).status).toBe(200); });
  it('invalid GSTIN, invalid PAN and a wrong state code are FIRM_PROFILE_INVALID and do not repeat the value', async () => {
    const cases: Array<[object, string | null]> = [[{ gstin: 'nope' }, 'nope'], [{ gstin: SECRET }, SECRET], [{ pan: 'nope' }, 'nope'], [{ pan: SECRET }, SECRET], [{ gstin: BAD_STATE }, BAD_STATE], [{ gstin: G, pan: 'ZZZZZ9999Z' }, 'ZZZZZ9999Z']];
    for (const [body, entered] of cases) { const r = await firmPut(body); refused(r, entered); expect(r.body.code).toBe('FIRM_PROFILE_INVALID'); }
  });
  it('an empty legal name is FIRM_PROFILE_INVALID', async () => { const r = await firmPut({ legalName: '  ' }); refused(r, null); expect(r.body.code).toBe('FIRM_PROFILE_INVALID'); });
  it('oversize and wrong-type input is a registered 400', async () => {
    for (const body of [{ gstin: 'A'.repeat(500) }, { pan: 'P'.repeat(500) }, { legalName: 'L'.repeat(5000) }, { registeredAddress: 'D'.repeat(5000) }, { gstin: 5 }, { legalName: 7 }]) {
      const r = await firmPut(body); refused(r, null); expect(r.body.code).toBe('FIRM_PROFILE_INVALID');
    }
  });
});
