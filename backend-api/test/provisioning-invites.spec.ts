import { Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { generateToken, hashToken, hashesEqual, isWellFormedToken } from '../src/provisioning/claims/token';
import { LiveEmailAdapter, SandboxEmailAdapter, selectEmailAdapter } from '../src/provisioning/invites/email-adapter';
import { maskToken, renderInvite } from '../src/provisioning/invites/invite-renderer';
import { CreateClaimLinkStep } from '../src/provisioning/steps/create-claim-link.step';
import { SendInviteStep } from '../src/provisioning/steps/send-invite.step';
import { DEFAULT_PROVISIONING_SETTINGS, ProvisioningSettings, provisioningSettingProblem, renderTemplate, resolveProvisioningSettings, validateProvisioningSetting } from '../src/provisioning/settings/provisioning-settings';
import { JobRunnerService, ProvisioningAudit, ProvisioningStep, StepContext, StepResult } from '../src/provisioning/runner/job-runner.service';
import { StepError } from '../src/provisioning/provisioning.errors';
import { JobRow } from '../src/provisioning/provisioning.repository';
import { STEP_ORDER } from '../src/provisioning/core/state-machine';
import { MemoryProvisioningRepo } from './support/memory-provisioning-repo';
import { MemoryClaimStore, MemoryInviteStore } from './support/memory-claims';

/** S53.5: claim tokens, invites, the email adapter (sandbox default, live guarded OFF) and the proof that the raw token never reaches storage, audit or logs. */
const NOW = new Date('2026-11-04T10:00:00Z');
const INPUT = { businessName: 'Sri Ganesh Plumbing', track: 'handyman', category: 'plumber', ownerName: 'Ganesh Kumar', phone: '+91 98765 43210', email: 'Ganesh@Example.com', city: 'Chennai', language: 'en' };
const job: JobRow = {
  id: 'job1', kind: 'BUSINESS_FREE_SITE', status: 'RUNNING', idempotencyKey: 'k', vendorId: 'v1', input: INPUT, currentStep: null, attempt: 0, maxAttempts: 5, nextRunAt: NOW, lockedBy: 'r', lockedUntil: null,
  lastErrorCode: null, lastErrorMessage: null, createdByType: 'STAFF', createdById: 'staff-1', finishedAt: null, createdAt: NOW, updatedAt: NOW,
};
const ctx = (over: Partial<StepContext> = {}, settings: Partial<ProvisioningSettings> = {}): StepContext => ({
  job, input: INPUT, vendorId: 'v1', actor: { type: 'STAFF', id: 'staff-1', ip: null }, settings: { ...DEFAULT_PROVISIONING_SETTINGS, ...settings }, now: NOW, ...over,
});

describe('claim token', () => {
  it('is 32 random bytes as base64url (43 characters), different every time', () => {
    const a = generateToken(); const b = generateToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/); expect(a).not.toBe(b); expect(isWellFormedToken(a)).toBe(true);
  });
  it('rejects anything that is not that shape before it reaches the database', () => {
    for (const bad of ['', 'short', 'x'.repeat(44), `${'a'.repeat(42)}!`, '../../etc/passwd', ' '.repeat(43)]) expect(isWellFormedToken(bad)).toBe(false);
  });
  it('is stored as its SHA-256 (hex); the comparison is constant time', () => {
    const t = generateToken();
    expect(hashToken(t)).toBe(createHash('sha256').update(t).digest('hex'));
    expect(hashesEqual(hashToken(t), hashToken(t))).toBe(true);
    expect(hashesEqual(hashToken(t), hashToken(generateToken()))).toBe(false);
    expect(hashesEqual('abc', 'abcd')).toBe(false);
  });
});

describe('invite rendering', () => {
  const t = generateToken();
  const r = renderInvite({ ...DEFAULT_PROVISIONING_SETTINGS }, { businessName: 'Sri Ganesh Plumbing', rawToken: t });
  it('builds the claim URL from publicAppUrl and puts the business name, the link and the expiry in the message', () => {
    expect(r.text).toContain(`https://staging.get4domain.invalid/claim/${t}`);
    expect(r.text).toContain('Sri Ganesh Plumbing'); expect(r.text).toMatch(/expires in 14 days/);
    expect(r.subject).toContain('Sri Ganesh Plumbing');
  });
  it('the preview has the token masked, everything else intact', () => {
    expect(r.preview).not.toContain(t); expect(r.preview).toContain(`/claim/${maskToken(t)}`); expect(maskToken(t)).toBe(`${t.slice(0, 4)}…`);
  });
  it('a business name cannot inject headers or extra variables', () => {
    const x = renderInvite({ ...DEFAULT_PROVISIONING_SETTINGS }, { businessName: 'Evil\r\nBcc: a@b.com {{claimUrl}}', rawToken: t });
    expect(x.subject).not.toMatch(/[\r\n]/); expect(x.subject).not.toContain('{{');
  });
  it('uses the owner-edited templates and expiry days', () => {
    const y = renderInvite({ ...DEFAULT_PROVISIONING_SETTINGS, claimLinkExpiryDays: 7, publicAppUrl: 'https://app.example.test', inviteSubjectTemplate: 'Hi {{businessName}}', inviteBodyTemplate: 'Go: {{claimUrl}} ({{expiryDays}}d)' }, { businessName: 'Acme', rawToken: t });
    expect(y.subject).toBe('Hi Acme'); expect(y.text).toBe(`Go: https://app.example.test/claim/${t} (7d)`);
  });
});

describe('provisioning settings', () => {
  it('defaults match the spec', () => {
    expect(DEFAULT_PROVISIONING_SETTINGS).toMatchObject({ provisioningRunnerEnabled: false, provisioningMaxAttempts: 5, provisioningBackoffSeconds: [30, 120, 600, 1800], claimLinkExpiryDays: 14, inviteAdapterMode: 'sandbox' });
  });
  it('accepts valid values and refuses bad ones', () => {
    expect(provisioningSettingProblem('claimLinkExpiryDays', 30)).toBeNull();
    for (const [k, v] of [['claimLinkExpiryDays', 0], ['claimLinkExpiryDays', 1.5], ['provisioningMaxAttempts', 99], ['provisioningRunnerEnabled', 'yes'], ['inviteAdapterMode', 'both'], ['provisioningBackoffSeconds', []], ['publicAppUrl', 'ftp://x'], ['publicAppUrl', 'http://evil.example'], ['inviteBodyTemplate', 'no link here'], ['inviteBodyTemplate', 'Go {{claimUrl}} {{secret}}']] as const) {
      expect(provisioningSettingProblem(k, v)).not.toBeNull();
    }
    expect(provisioningSettingProblem('publicAppUrl', 'http://localhost:3000')).toBeNull();
  });
  it('validateProvisioningSetting throws a 400 for an unknown key or a bad value', () => {
    expect(() => validateProvisioningSetting('nope', 1)).toThrow(/not a known plan setting/);
    expect(() => validateProvisioningSetting('claimLinkExpiryDays', -1)).toThrow(/claimLinkExpiryDays/);
    expect(() => validateProvisioningSetting('claimLinkExpiryDays', 14)).not.toThrow();
  });
  it('stored values override defaults only when valid; the app URL loses its trailing slash', () => {
    const s = resolveProvisioningSettings(new Map<string, unknown>([['claimLinkExpiryDays', 30], ['provisioningMaxAttempts', 'bad'], ['publicAppUrl', 'https://app.example.test/']]));
    expect(s.claimLinkExpiryDays).toBe(30); expect(s.provisioningMaxAttempts).toBe(5); expect(s.publicAppUrl).toBe('https://app.example.test');
  });
  it('renderTemplate only substitutes {{name}} and leaves nothing else', () => {
    expect(renderTemplate('a {{x}} b {{ y }} c {{z}}', { x: '1', y: '2' })).toBe('a 1 b 2 c ');
  });
});

describe('email adapters', () => {
  it('sandbox sends nothing anywhere and returns a sandbox id', async () => {
    const r = await new SandboxEmailAdapter().send({ to: 'a@b.com', subject: 's', text: 't' });
    expect(r.providerMessageId).toMatch(/^sandbox-/);
  });
  it('live is OFF unless the explicit env flag is set: it refuses permanently and never calls the mail service', async () => {
    const mail = { sendPlainText: jest.fn() };
    for (const env of [{}, { V3_INVITE_LIVE_ENABLED: 'false' }, { V3_INVITE_LIVE_ENABLED: '1' }, { V3_INVITE_LIVE_ENABLED: 'TRUE' }]) {
      await expect(new LiveEmailAdapter(mail as never, env as never).send({ to: 'a@b.com', subject: 's', text: 't' })).rejects.toMatchObject({ code: 'LIVE_DISABLED', retryable: false });
    }
    expect(mail.sendPlainText).not.toHaveBeenCalled();
  });
  it('live sends through the existing mail service only when the flag is exactly "true"', async () => {
    const mail = { sendPlainText: jest.fn(async () => undefined) };
    await new LiveEmailAdapter(mail as never, { V3_INVITE_LIVE_ENABLED: 'true' } as never).send({ to: 'a@b.com', subject: 's', text: 't' });
    expect(mail.sendPlainText).toHaveBeenCalledWith('a@b.com', 's', 't');
  });
  it('selectEmailAdapter: "sandbox" and anything unknown give the sandbox adapter, "live" gives the guarded live one', () => {
    const mail = { sendPlainText: jest.fn() } as never;
    expect(selectEmailAdapter('sandbox', mail)).toBeInstanceOf(SandboxEmailAdapter);
    expect(selectEmailAdapter('weird' as never, mail)).toBeInstanceOf(SandboxEmailAdapter);
    expect(selectEmailAdapter('live', mail)).toBeInstanceOf(LiveEmailAdapter);
  });
});

function world() {
  const claims = new MemoryClaimStore(); const invites = new MemoryInviteStore(); claims.invites = invites; claims.vendors.set('v1', 'Sri Ganesh Plumbing');
  const mail = { sendPlainText: jest.fn(async () => undefined) };
  const claimStep = new CreateClaimLinkStep(claims);
  const sendStep = new SendInviteStep(claims, invites, mail as never, {} as never);
  return { claims, invites, mail, claimStep, sendStep };
}

describe('CREATE_CLAIM_LINK', () => {
  it('returns the raw token in memory only and stores only its hash, expiring after claimLinkExpiryDays', async () => {
    const w = world();
    const r = await w.claimStep.run(ctx({}, { claimLinkExpiryDays: 10 }));
    expect(r.rawToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(r.outputRef).toEqual({ claimTokenId: 'ct1' });
    expect(w.claims.rows[0]).toMatchObject({ vendorId: 'v1', tokenHash: hashToken(r.rawToken!), status: 'ACTIVE', createdByType: 'STAFF', createdById: 'staff-1' });
    expect(w.claims.rows[0].expiresAt.getTime()).toBe(NOW.getTime() + 10 * 86_400_000);
    expect(JSON.stringify(w.claims.rows)).not.toContain(r.rawToken!);
  });
  it('a new link revokes the previous ACTIVE one: at most one ACTIVE token per vendor', async () => {
    const w = world();
    const a = await w.claimStep.run(ctx()); const b = await w.claimStep.run(ctx());
    expect(a.rawToken).not.toBe(b.rawToken);
    expect(w.claims.rows.map((r) => r.status)).toEqual(['REVOKED', 'ACTIVE']);
    expect(w.claims.rows.filter((r) => r.status === 'ACTIVE')).toHaveLength(1);
  });
  it('needs the vendor from an earlier step', async () => {
    await expect(world().claimStep.run(ctx({ vendorId: null }))).rejects.toMatchObject({ code: 'UNKNOWN_VENDOR', retryable: false });
  });
});

describe('SEND_INVITE', () => {
  it('sandbox: records the full message for staff, sends nothing, marks SENT; the preview has the token masked', async () => {
    const w = world();
    const { rawToken } = await w.claimStep.run(ctx());
    const r = await w.sendStep.run(ctx({ rawToken }));
    expect(w.mail.sendPlainText).not.toHaveBeenCalled();
    expect(w.invites.rows).toHaveLength(1);
    const inv = w.invites.rows[0];
    expect(inv).toMatchObject({ vendorId: 'v1', channel: 'EMAIL', toAddress: 'ganesh@example.com', claimTokenId: 'ct1', adapterMode: 'SANDBOX', status: 'SENT' });
    expect(inv.providerMessageId).toMatch(/^sandbox-/); expect(inv.sentAt).toEqual(NOW);
    expect(inv.sandboxBody).toContain(rawToken!);
    expect(inv.bodyPreview).not.toContain(rawToken!); expect(inv.subject).not.toContain(rawToken!);
    expect(r.outputRef).toEqual({ inviteId: inv.id });
  });
  it('is idempotent: a SENT invite is never sent again', async () => {
    const w = world();
    const { rawToken } = await w.claimStep.run(ctx());
    await w.sendStep.run(ctx({ rawToken })); await w.sendStep.run(ctx({ rawToken }));
    expect(w.invites.rows).toHaveLength(1);
  });
  it('a failed send marks the invite FAILED and a retry with the same link reuses that row (one invite per link, no duplicates)', async () => {
    const w = world();
    const { rawToken } = await w.claimStep.run(ctx());
    const flaky = new SendInviteStep(w.claims, w.invites, w.mail as never, {} as never);
    jest.spyOn(SandboxEmailAdapter.prototype, 'send').mockRejectedValueOnce(new StepError('ADAPTER_TIMEOUT', true));
    await expect(flaky.run(ctx({ rawToken }))).rejects.toMatchObject({ code: 'ADAPTER_TIMEOUT', retryable: true });
    expect(w.invites.rows.map((r) => r.status)).toEqual(['FAILED']);
    await flaky.run(ctx({ rawToken }));
    expect(w.invites.rows.map((r) => r.status)).toEqual(['SENT']);
    jest.restoreAllMocks();
  });
  it('live mode with the flag off fails permanently, stores no message body, and never sends', async () => {
    const w = world();
    const { rawToken } = await w.claimStep.run(ctx());
    await expect(w.sendStep.run(ctx({ rawToken }, { inviteAdapterMode: 'live' }))).rejects.toMatchObject({ code: 'LIVE_DISABLED', retryable: false });
    expect(w.mail.sendPlainText).not.toHaveBeenCalled();
    expect(w.invites.rows[0]).toMatchObject({ adapterMode: 'LIVE', status: 'FAILED', sandboxBody: null });
    expect(JSON.stringify(w.invites.rows)).not.toContain(rawToken!);
  });
  it('live mode with the flag on (test double) sends the message and still never stores the body', async () => {
    const w = world();
    const live = new SendInviteStep(w.claims, w.invites, w.mail as never, { V3_INVITE_LIVE_ENABLED: 'true' } as never);
    const { rawToken } = await w.claimStep.run(ctx());
    await live.run(ctx({ rawToken }, { inviteAdapterMode: 'live' }));
    expect(w.mail.sendPlainText).toHaveBeenCalledTimes(1);
    expect(w.invites.rows[0]).toMatchObject({ adapterMode: 'LIVE', status: 'SENT', sandboxBody: null });
    expect(JSON.stringify(w.invites.rows)).not.toContain(rawToken!);
  });
  it('without the in-memory token it fails retryably (the runner then issues a new link)', async () => {
    const w = world();
    await w.claimStep.run(ctx());
    await expect(w.sendStep.run(ctx({ rawToken: undefined }))).rejects.toMatchObject({ retryable: true });
  });
  it('revoking the link clears the sandbox body (the token is useless and must not linger)', async () => {
    const w = world();
    const { rawToken } = await w.claimStep.run(ctx());
    await w.sendStep.run(ctx({ rawToken }));
    await w.claims.revokeActive('v1');
    expect(w.invites.rows[0].sandboxBody).toBeNull();
  });
});

describe('the raw token never reaches job rows, step rows, audit rows, claim rows, invite columns (except the sandbox body) or logs', () => {
  it('a whole job through the real runner and the real steps', async () => {
    const w = world();
    const repo = new MemoryProvisioningRepo(); repo.clock = () => NOW;
    const audit: unknown[] = [];
    const sink: ProvisioningAudit = { record: async (...a) => { audit.push(a); } };
    const vendorStep: ProvisioningStep = { key: 'CREATE_VENDOR', run: async (): Promise<StepResult> => ({ vendorId: 'v1', outputRef: { vendorId: 'v1' } }) };
    const plain = (key: ProvisioningStep['key']): ProvisioningStep => ({ key, run: async () => ({ outputRef: { ok: key } }) });
    const steps: ProvisioningStep[] = [vendorStep, plain('ASSIGN_FREE_PLAN'), plain('CREATE_FREE_SITE_DRAFT'), w.claimStep, w.sendStep];
    const logged: string[] = [];
    const spies = (['log', 'warn', 'error', 'debug', 'verbose'] as const).map((m) => jest.spyOn(Logger.prototype, m).mockImplementation((...a: unknown[]) => { logged.push(JSON.stringify(a)); }));
    const consoleSpies = (['log', 'warn', 'error', 'info', 'debug'] as const).map((m) => jest.spyOn(console, m).mockImplementation((...a: unknown[]) => { logged.push(JSON.stringify(a)); }));
    try {
      await repo.createJob({ idempotencyKey: 'leak', input: INPUT, maxAttempts: 5, createdByType: 'STAFF', createdById: 'staff-1' });
      const runner = new JobRunnerService(repo, steps, { get: async () => ({ ...DEFAULT_PROVISIONING_SETTINGS }) } as never, sink, 'r1');
      runner.clock = () => NOW;
      const report = await runner.runOne();
      expect(report).toMatchObject({ status: 'SUCCEEDED' });
    } finally { [...spies, ...consoleSpies].forEach((s) => s.mockRestore()); }

    const inv = w.invites.rows[0];
    const token = /\/claim\/([A-Za-z0-9_-]{43})/.exec(inv.sandboxBody!)![1];
    expect(w.claims.rows[0].tokenHash).toBe(hashToken(token));
    const everywhere = JSON.stringify([...repo.jobs.values(), ...repo.steps.values(), audit, w.claims.rows, { ...inv, sandboxBody: undefined }, logged]);
    expect(everywhere).not.toContain(token);
    expect(JSON.stringify(logged)).not.toContain(token);
  });
});

describe('SQL-injection and shape guards on the stored address', () => {
  it('a plain address is stored lower-cased and an obviously bad one never reaches the adapter', async () => {
    const w = world();
    const { rawToken } = await w.claimStep.run(ctx());
    await expect(w.sendStep.run(ctx({ rawToken, input: { ...INPUT, email: 'x' } }))).rejects.toMatchObject({ code: 'INVALID_INPUT', retryable: false });
    expect(w.invites.rows).toHaveLength(0);
  });
});
void STEP_ORDER;
