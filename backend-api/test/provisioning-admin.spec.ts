import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { buildValidationPipe } from '../src/common/pipes/edit-validation.pipe';
import { EmailService } from '../src/email/email.service';
import { ClaimStore } from '../src/provisioning/claims/claim-store';
import { ClaimsService } from '../src/provisioning/claims/claims.service';
import { generateToken, hashToken } from '../src/provisioning/claims/token';
import { InviteStore } from '../src/provisioning/invites/invite-store';
import { ProvisioningAdminController } from '../src/provisioning/admin/provisioning-admin.controller';
import { ProvisioningAdminService } from '../src/provisioning/admin/provisioning-admin.service';
import { maskEmail } from '../src/provisioning/admin/provisioning-admin.shape';
import { ProvisioningRepository } from '../src/provisioning/provisioning.repository';
import { JobRunnerService, PROVISIONING_STEPS, ProvisioningAudit, ProvisioningStep, StepResult } from '../src/provisioning/runner/job-runner.service';
import { DEFAULT_PROVISIONING_SETTINGS, ProvisioningSettings } from '../src/provisioning/settings/provisioning-settings';
import { ProvisioningSettingsService } from '../src/provisioning/settings/provisioning-settings.service';
import { INVITE_ENV } from '../src/provisioning/steps/send-invite.step';
import { STEP_ORDER } from '../src/provisioning/core/state-machine';
import { MemoryProvisioningRepo } from './support/memory-provisioning-repo';
import { MemoryClaimStore, MemoryInviteStore } from './support/memory-claims';

/** S53.7: the staff API over HTTP with the REAL AdminGuard, validation pipe and error filter. Stores are in memory; the role comes from a test header. */
const BODY = { businessName: 'Sri Ganesh Plumbing', track: 'handyman', category: 'plumber', ownerName: 'Ganesh Kumar', phone: '98765 43210', email: 'Ganesh@Example.com', city: 'Chennai', language: 'en' };
const KEY = 'idem-key-0001';
const ROUTES: Array<[string, string]> = [
  ['post', '/v3/admin/provisioning/jobs'], ['get', '/v3/admin/provisioning/jobs'], ['get', '/v3/admin/provisioning/jobs/x'],
  ['post', '/v3/admin/provisioning/jobs/x/retry'], ['post', '/v3/admin/provisioning/jobs/x/cancel'], ['post', '/v3/admin/provisioning/jobs/x/run'],
  ['post', '/v3/admin/vendors/v1/claim-link/reissue'], ['post', '/v3/admin/vendors/v1/claim-link/revoke'], ['get', '/v3/admin/invites'],
];

describe('provisioning admin API', () => {
  let app: INestApplication; let repo: MemoryProvisioningRepo; let claims: MemoryClaimStore; let invites: MemoryInviteStore;
  let audit: Array<{ action: string; entityId: string | null; after: unknown }>; let settings: ProvisioningSettings; let stepCalls: string[];

  beforeEach(async () => {
    repo = new MemoryProvisioningRepo(); claims = new MemoryClaimStore(); invites = new MemoryInviteStore(); claims.invites = invites;
    claims.vendors.set('v1', 'Sri Ganesh Plumbing'); claims.vendorContacts.set('v1', { email: 'ganesh@example.com', businessName: 'Sri Ganesh Plumbing' });
    audit = []; settings = { ...DEFAULT_PROVISIONING_SETTINGS }; stepCalls = [];
    const steps: ProvisioningStep[] = STEP_ORDER.map((key) => ({ key, run: async (): Promise<StepResult> => { stepCalls.push(key); if (key === 'CREATE_CLAIM_LINK') return { rawToken: 'in-memory-test-token', outputRef: { claimTokenId: 'ct1' } }; return key === 'CREATE_VENDOR' ? { vendorId: 'v1', outputRef: { vendorId: 'v1' } } : { outputRef: { ok: key } }; } }));
    const mod = await Test.createTestingModule({
      controllers: [ProvisioningAdminController],
      providers: [
        ProvisioningAdminService, ClaimsService, JobRunnerService,
        { provide: ProvisioningRepository, useValue: repo }, { provide: ClaimStore, useValue: claims }, { provide: InviteStore, useValue: invites },
        { provide: ProvisioningAudit, useValue: { record: async (_a: unknown, action: string, _t: string, entityId: string | null, after: unknown) => { audit.push({ action, entityId, after }); } } },
        { provide: ProvisioningSettingsService, useValue: { get: async () => settings } },
        { provide: EmailService, useValue: { sendPlainText: jest.fn() } }, { provide: INVITE_ENV, useValue: {} }, { provide: PROVISIONING_STEPS, useValue: steps },
      ],
    }).compile();
    app = mod.createNestApplication();
    app.use((req: { headers: Record<string, string>; user?: unknown }, _res: unknown, next: () => void) => {
      const role = req.headers['x-test-role'];
      if (role === 'VENDOR') req.user = { sub: 'v', email: 'v@x.invalid', role: 'VENDOR' };
      else if (role) req.user = { sub: 'staff-1', email: 's@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: role };
      next();
    });
    app.useGlobalPipes(buildValidationPipe()); app.useGlobalInterceptors(new TransformInterceptor()); app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });
  afterEach(async () => { await app.close(); });

  const call = (method: string, url: string, role = 'OPERATIONS') => (request(app.getHttpServer()) as unknown as Record<string, (u: string) => request.Test>)[method](url).set('x-test-role', role);
  const create = (body: object = BODY, key: string | null = KEY, role = 'OPERATIONS') => { const r = call('post', '/v3/admin/provisioning/jobs', role).send(body); return key ? r.set('Idempotency-Key', key) : r; };

  describe('who may call', () => {
    it.each(ROUTES)('%s %s: MARKETING, a vendor and an anonymous caller are refused (403)', async (method, url) => {
      for (const role of ['MARKETING', 'VENDOR']) expect((await call(method, url, role).set('Idempotency-Key', KEY).send(BODY)).status).toBe(403);
      expect((await (request(app.getHttpServer()) as unknown as Record<string, (u: string) => request.Test>)[method](url).set('Idempotency-Key', KEY).send(BODY)).status).toBe(403);
    });
    it.each(ROUTES)('%s %s: OPERATIONS and SUPER_ADMIN get past the guard (not 401 or 403)', async (method, url) => {
      for (const role of ['OPERATIONS', 'SUPER_ADMIN']) expect([401, 403]).not.toContain((await call(method, url, role).set('Idempotency-Key', KEY).send(BODY)).status);
    });
    it('a vendor cannot read another vendor\'s invites or reissue its link: every staff route refuses a vendor token', async () => {
      expect((await call('get', '/v3/admin/invites', 'VENDOR')).status).toBe(403);
      expect((await call('post', '/v3/admin/vendors/v1/claim-link/reissue', 'VENDOR')).status).toBe(403);
      expect(claims.rows).toHaveLength(0);
    });
  });

  describe('create', () => {
    it('needs an Idempotency-Key header of 8 to 100 safe characters', async () => {
      expect((await create(BODY, null)).status).toBe(400);
      expect((await create(BODY, 'short')).status).toBe(400);
      expect((await create(BODY, 'has spaces in it!')).status).toBe(400);
      expect(repo.jobs.size).toBe(0);
    });
    it('creates a QUEUED job (201) with the cleaned input and five PENDING steps; the same key again returns the same job (200) and creates nothing', async () => {
      const a = await create();
      expect(a.status).toBe(201);
      expect(a.body.data).toMatchObject({ kind: 'BUSINESS_FREE_SITE', status: 'QUEUED', vendorId: null, attempt: 0, maxAttempts: 5 });
      expect(a.body.data.lockedBy).toBeUndefined();
      expect([...repo.jobs.values()][0].input).toMatchObject({ email: 'ganesh@example.com', phone: '+919876543210', track: 'handyman' });
      expect(audit.map((x) => x.action)).toContain('provisioning.job.created');
      const b = await create();
      expect(b.status).toBe(200); expect(b.body.data.id).toBe(a.body.data.id); expect(repo.jobs.size).toBe(1);
    });
    it('uses provisioningMaxAttempts from the settings', async () => {
      settings = { ...settings, provisioningMaxAttempts: 3 };
      expect((await create()).body.data.maxAttempts).toBe(3);
    });
    it('refuses bad input with 400 and field names; nothing is created', async () => {
      for (const bad of [{ ...BODY, track: 'nope' }, { ...BODY, email: 'x' }, { ...BODY, phone: '12' }, { ...BODY, businessName: '' }, { ...BODY, language: 'English please' }, { ...BODY, role: 'ADMIN' }, { ...BODY, businessName: undefined }]) {
        const r = await create(bad as object);
        expect(r.status).toBe(400);
      }
      expect(repo.jobs.size).toBe(0);
    });
    it('the stored input holds no token and no secret: only the business details', async () => {
      await create();
      expect(Object.keys([...repo.jobs.values()][0].input).sort()).toEqual(['businessName', 'category', 'city', 'email', 'language', 'ownerName', 'phone', 'track']);
    });
  });

  describe('read', () => {
    it('detail shows the job and its five steps and error, never a lock holder or a token', async () => {
      const id = (await create()).body.data.id;
      await call('post', `/v3/admin/provisioning/jobs/${id}/run`);
      const r = await call('get', `/v3/admin/provisioning/jobs/${id}`);
      expect(r.status).toBe(200);
      expect(r.body.data.steps.map((s: { stepKey: string }) => s.stepKey)).toEqual([...STEP_ORDER]);
      expect(r.body.data.steps.every((s: { status: string }) => s.status === 'DONE')).toBe(true);
      expect(JSON.stringify(r.body)).not.toMatch(/lockedBy|tokenHash|rawToken|claim\/[A-Za-z0-9_-]{43}/);
    });
    it('unknown job: 404 JOB_NOT_FOUND', async () => {
      const r = await call('get', '/v3/admin/provisioning/jobs/nope');
      expect(r.status).toBe(404); expect(r.body.code).toBe('JOB_NOT_FOUND');
    });
    it('the list is paginated, filters by status, and caps the page size at 100', async () => {
      for (let i = 0; i < 3; i++) await create(BODY, `idem-key-000${i + 1}`);
      const all = await call('get', '/v3/admin/provisioning/jobs?pageSize=2');
      expect(all.body.data).toMatchObject({ page: 1, pageSize: 2, total: 3 }); expect(all.body.data.items).toHaveLength(2);
      expect(all.body.data.items[0].input).toBeUndefined();
      expect((await call('get', '/v3/admin/provisioning/jobs?status=FAILED')).body.data.total).toBe(0);
      expect((await call('get', '/v3/admin/provisioning/jobs?status=QUEUED')).body.data.total).toBe(3);
      expect((await call('get', '/v3/admin/provisioning/jobs?pageSize=500')).status).toBe(400);
      expect((await call('get', '/v3/admin/provisioning/jobs?status=BOGUS')).status).toBe(400);
    });
  });

  describe('retry, cancel, run', () => {
    it('retry: only a FAILED job goes back to QUEUED; anything else is 409 JOB_NOT_RETRYABLE; unknown is 404', async () => {
      const id = (await create()).body.data.id;
      const no = await call('post', `/v3/admin/provisioning/jobs/${id}/retry`);
      expect(no.status).toBe(409); expect(no.body.code).toBe('JOB_NOT_RETRYABLE');
      Object.assign(repo.jobs.get(id)!, { status: 'FAILED', attempt: 5, lastErrorCode: 'ADAPTER_TIMEOUT' }); repo.steps.get(`${id}:SEND_INVITE`)!.status = 'FAILED';
      const ok = await call('post', `/v3/admin/provisioning/jobs/${id}/retry`);
      expect(ok.status).toBe(200); expect(ok.body.data).toMatchObject({ status: 'QUEUED', attempt: 0, lastErrorCode: null });
      expect(repo.steps.get(`${id}:SEND_INVITE`)!.status).toBe('PENDING');
      expect(audit.map((x) => x.action)).toContain('provisioning.job.retry');
      expect((await call('post', '/v3/admin/provisioning/jobs/nope/retry')).body.code).toBe('JOB_NOT_FOUND');
    });
    it('cancel: marks the remaining steps SKIPPED and keeps the done ones; a finished job cannot be cancelled', async () => {
      const id = (await create()).body.data.id;
      repo.steps.get(`${id}:CREATE_VENDOR`)!.status = 'DONE';
      const r = await call('post', `/v3/admin/provisioning/jobs/${id}/cancel`);
      expect(r.status).toBe(200); expect(r.body.data.status).toBe('CANCELLED');
      expect(r.body.data.steps.map((s: { status: string }) => s.status)).toEqual(['DONE', 'SKIPPED', 'SKIPPED', 'SKIPPED', 'SKIPPED']);
      expect(audit.map((x) => x.action)).toContain('provisioning.job.cancel');
      const again = await call('post', `/v3/admin/provisioning/jobs/${id}/cancel`);
      expect(again.status).toBe(409); expect(again.body.code).toBe('JOB_NOT_RETRYABLE');
    });
    it('cancel refuses a job another runner is working on (RUNNING with a live lease)', async () => {
      const id = (await create()).body.data.id;
      Object.assign(repo.jobs.get(id)!, { status: 'RUNNING', lockedBy: 'runner-x', lockedUntil: new Date(Date.now() + 60_000) });
      expect((await call('post', `/v3/admin/provisioning/jobs/${id}/cancel`)).status).toBe(409);
    });
    it('run: executes the job now, synchronously, and returns the finished job; a job waiting for its backoff is run at once too', async () => {
      const id = (await create()).body.data.id;
      const r = await call('post', `/v3/admin/provisioning/jobs/${id}/run`);
      expect(r.status).toBe(200); expect(r.body.data.status).toBe('SUCCEEDED'); expect(stepCalls).toEqual([...STEP_ORDER]);
      const id2 = (await create(BODY, 'idem-key-0002')).body.data.id;
      Object.assign(repo.jobs.get(id2)!, { status: 'WAITING', nextRunAt: new Date(Date.now() + 3_600_000) });
      expect((await call('post', `/v3/admin/provisioning/jobs/${id2}/run`)).body.data.status).toBe('SUCCEEDED');
    });
    it('run: a finished job is 409, and in production it is refused unless the runner is switched on', async () => {
      const id = (await create()).body.data.id;
      await call('post', `/v3/admin/provisioning/jobs/${id}/run`);
      expect((await call('post', `/v3/admin/provisioning/jobs/${id}/run`)).status).toBe(409);
      const id2 = (await create(BODY, 'idem-key-0002')).body.data.id;
      const prev = process.env.NODE_ENV; process.env.NODE_ENV = 'production';
      try {
        expect((await call('post', `/v3/admin/provisioning/jobs/${id2}/run`)).status).toBe(403);
        settings = { ...settings, provisioningRunnerEnabled: true };
        expect((await call('post', `/v3/admin/provisioning/jobs/${id2}/run`)).status).toBe(200);
      } finally { process.env.NODE_ENV = prev; }
    });
  });

  describe('claim link actions', () => {
    it('reissue: a new link and invite for the business; the response has ids and the expiry, never a token', async () => {
      const r = await call('post', '/v3/admin/vendors/v1/claim-link/reissue');
      expect(r.status).toBe(200);
      expect(Object.keys(r.body.data).sort()).toEqual(['claimTokenId', 'expiresAt', 'inviteId']);
      expect(claims.rows).toHaveLength(1); expect(invites.rows).toHaveLength(1);
      expect(JSON.stringify(r.body)).not.toMatch(/[A-Za-z0-9_-]{43}/);
    });
    it('reissue for an unknown business is 404 UNKNOWN_VENDOR; revoke works and is idempotent', async () => {
      expect((await call('post', '/v3/admin/vendors/zzz/claim-link/reissue')).body.code).toBe('UNKNOWN_VENDOR');
      await claims.issue({ vendorId: 'v1', tokenHash: hashToken(generateToken()), expiresAt: new Date(Date.now() + 1e9), actor: { type: 'STAFF', id: 's', ip: null } });
      expect((await call('post', '/v3/admin/vendors/v1/claim-link/revoke')).body.data).toEqual({ revoked: 1 });
      expect((await call('post', '/v3/admin/vendors/v1/claim-link/revoke')).body.data).toEqual({ revoked: 0 });
    });
  });

  describe('invites list', () => {
    const seed = async (mode: 'SANDBOX' | 'LIVE') => {
      const { id } = await claims.issue({ vendorId: 'v1', tokenHash: hashToken(generateToken()), expiresAt: new Date(Date.now() + 1e9), actor: { type: 'STAFF', id: 's', ip: null } });
      await invites.create({ vendorId: 'v1', channel: 'EMAIL', toAddress: 'ganesh@example.com', claimTokenId: id, adapterMode: mode, subject: 'Subject', bodyPreview: 'preview ab12…', sandboxBody: mode === 'SANDBOX' ? 'full body' : null });
    };
    it('addresses are masked in every list; the sandbox body is shown to staff outside production', async () => {
      await seed('SANDBOX');
      const r = await call('get', '/v3/admin/invites');
      expect(r.status).toBe(200);
      expect(r.body.data.items[0]).toMatchObject({ toAddress: 'g***@e***.com', adapterMode: 'SANDBOX', sandboxBody: 'full body' });
      expect(JSON.stringify(r.body)).not.toContain('ganesh@example.com');
    });
    it('in production the sandbox body is never returned, and a live invite never has one', async () => {
      await seed('SANDBOX'); await seed('LIVE');
      const prev = process.env.NODE_ENV; process.env.NODE_ENV = 'production';
      try {
        const r = await call('get', '/v3/admin/invites');
        for (const i of r.body.data.items) expect(i.sandboxBody).toBeUndefined();
      } finally { process.env.NODE_ENV = prev; }
      const live = (await call('get', '/v3/admin/invites')).body.data.items.find((i: { adapterMode: string }) => i.adapterMode === 'LIVE');
      expect(live.sandboxBody).toBeUndefined();
    });
  });
});

describe('maskEmail', () => {
  it('keeps the first letter of the name and of the domain and the ending', () => {
    expect(maskEmail('ganesh@example.com')).toBe('g***@e***.com');
    expect(maskEmail('a@b.co.in')).toBe('a***@b***.co.in');
    expect(maskEmail('weird')).toBe('***');
  });
});
