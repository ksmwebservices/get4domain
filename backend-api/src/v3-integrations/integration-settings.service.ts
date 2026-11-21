import { BadRequestException, HttpException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret, encryptSecret } from '../platform-settings/crypto.util';
import { ActivityService } from '../v3-activity/activity.service';
import { checkSet, fieldsOf, INTEGRATION_CATEGORY, isProviderKey, lastFour, ProviderKey, PROVIDER_KEYS, PROVIDERS, ProviderStatus, settingKey, TestResult, TEST_MESSAGES, TestState, Values } from './integrations-core';
import { IntegrationProbe } from './integration-probe';

export interface IntegrationActor { id: string | null; ip?: string | null }
const TTL_MS = 30_000;
const err = (status: number, code: string, message: string, extra: Record<string, unknown> = {}): HttpException => new HttpException({ message, code, ...extra }, status);

/**
 * The platform integration settings (R1.1), SUPER_ADMIN only. Stored the same way the payment gateway keys are (GatewayCredentialsService): each field is a row in the platform settings table, AES-GCM
 * encrypted at rest with the PLATFORM_SETTINGS_KEY master key, under its own category. WRITE-ONLY: no route returns a secret. A secret field reads `set` or `not set`; the status adds who set the provider and
 * when. A plain field (the mode, the sender, the cap, the reseller id) may be shown. Setting, clearing and testing are audited with field NAMES only. Errors never contain a value, a failure to decrypt reads
 * as "not set", and nothing here logs a value. The set of one provider is replaced as a whole.
 */
@Injectable()
export class IntegrationSettingsService {
  private cache = new Map<string, { at: number; value: Values | null }>();
  private versionNo = 0;
  now: () => number = () => Date.now();
  clock: () => Date = () => new Date();
  constructor(private readonly prisma: PrismaService, private readonly probe: IntegrationProbe, @Optional() private readonly activity?: ActivityService) {}

  version(): number { return this.versionNo; }

  private provider(p: unknown): ProviderKey {
    if (!isProviderKey(p)) throw new NotFoundException(err(404, 'INTEGRATION_UNKNOWN', 'That provider does not exist.').getResponse());
    return p;
  }

  private async rows(p: ProviderKey) {
    const prefix = `${p}.`;
    return (await this.prisma.platformSetting.findMany({ where: { category: INTEGRATION_CATEGORY, key: { startsWith: prefix } } })).filter((r) => r.key.startsWith(prefix));
  }

  /** Write-only: replaces the whole set of one provider, encrypted. Answers with the status, never a value. */
  async set(providerIn: unknown, input: unknown, actor: IntegrationActor): Promise<ProviderStatus> {
    const provider = this.provider(providerIn);
    if (!PROVIDERS[provider].available) throw err(409, 'INTEGRATION_NOT_AVAILABLE', TEST_MESSAGES.NOT_AVAILABLE);
    const c = checkSet(provider, input);
    if (!c.ok) throw new BadRequestException({ message: 'Some details need fixing.', code: 'INTEGRATION_INVALID', details: { fields: c.fields } });
    let encrypted: Record<string, string>;
    try { encrypted = Object.fromEntries(Object.entries(c.values).map(([f, v]) => [f, encryptSecret(v)])); }
    catch { throw err(503, 'INTEGRATION_UNAVAILABLE', 'Details cannot be stored on this server yet: its encryption key is not set up.'); }
    const names = fieldsOf(provider).map((f) => f.field);
    await this.prisma.$transaction(async (tx) => {
      for (const f of names) {
        const key = settingKey(provider, f);
        await tx.platformSetting.upsert({
          where: { category_key: { category: INTEGRATION_CATEGORY, key } },
          update: { value: encrypted[f], encrypted: true, status: 'CONFIGURED', updatedBy: actor.id },
          create: { category: INTEGRATION_CATEGORY, key, value: encrypted[f], encrypted: true, status: 'CONFIGURED', updatedBy: actor.id },
        });
      }
    });
    this.bump();
    await this.audit('integration.set', provider, actor, { fields: names });
    return this.statusOf(provider);
  }

  /** Removes the whole set of one provider. Clearing what is not there changes nothing and is not audited. */
  async clear(providerIn: unknown, actor: IntegrationActor): Promise<ProviderStatus> {
    const provider = this.provider(providerIn);
    const names = fieldsOf(provider).map((f) => f.field);
    if (names.length && (await this.rows(provider)).length > 0) {
      await this.prisma.platformSetting.deleteMany({ where: { category: INTEGRATION_CATEGORY, key: { in: names.map((f) => settingKey(provider, f)) } } });
      this.bump();
      await this.audit('integration.cleared', provider, actor, { fields: names });
    }
    return this.statusOf(provider);
  }

  async status(): Promise<ProviderStatus[]> { const out: ProviderStatus[] = []; for (const p of PROVIDER_KEYS) out.push(await this.statusOf(p)); return out; }

  async statusOf(providerIn: unknown): Promise<ProviderStatus> {
    const provider = this.provider(providerIn);
    const spec = PROVIDERS[provider];
    const base = { provider, name: spec.name, available: spec.available, note: spec.note };
    if (!spec.available) return { ...base, state: 'NOT_AVAILABLE', setBy: null, setAt: null, fields: [] };
    const rows = await this.rows(provider);
    const fields: ProviderStatus['fields'] = [];
    for (const f of spec.fields) {
      const row = rows.find((r) => r.key === settingKey(provider, f.field));
      let plain: string | null = null;
      if (row && !f.secret) { try { plain = decryptSecret(row.value); } catch { plain = null; } }
      const set = !!row && (f.secret || plain !== null);
      fields.push({
        field: f.field, label: f.label, secret: f.secret, state: set ? 'set' : 'not set',
        ...(set && !f.secret && plain !== null ? { value: plain } : {}),
        ...(set && f.hint && plain ? { hint: lastFour(plain) ?? undefined } : {}),
      });
    }
    const complete = fields.length > 0 && fields.every((f) => f.state === 'set');
    const newest = rows.slice().sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
    return { ...base, state: complete ? 'SET' : 'NOT_SET', setBy: complete ? newest?.updatedBy ?? null : null, setAt: complete ? newest?.updatedAt ?? null : null, fields };
  }

  /** For adapters only: the decrypted set of one provider, or null when none is stored, it is incomplete, or it cannot be decrypted. Kept in memory 30 seconds and dropped on every set and clear. Never logged or sent anywhere but into an adapter. */
  async resolve(providerIn: ProviderKey): Promise<Values | null> {
    const provider = this.provider(providerIn);
    const hit = this.cache.get(provider); const t = this.now();
    if (hit && t - hit.at < TTL_MS) return hit.value;
    let value: Values | null = null;
    try {
      const rows = await this.rows(provider); const out: Values = {};
      for (const f of fieldsOf(provider)) { const r = rows.find((x) => x.key === settingKey(provider, f.field)); if (r) out[f.field] = decryptSecret(r.value); }
      value = fieldsOf(provider).length > 0 && fieldsOf(provider).every((f) => !!out[f.field]) ? out : null;
    } catch { value = null; }
    this.cache.set(provider, { at: t, value });
    return value;
  }

  /**
   * The TEST route: asks the provider whether it accepts the SAVED details, with one harmless read (no e-mail is sent, nothing is bought, no model is run). The result is a state and a plain sentence; the
   * provider's own words are never copied. Audited with the state only.
   */
  async test(providerIn: unknown, actor: IntegrationActor): Promise<TestResult> {
    const provider = this.provider(providerIn);
    let state: TestState;
    if (!PROVIDERS[provider].available) state = 'NOT_AVAILABLE';
    else {
      const values = await this.resolve(provider);
      if (!values) state = 'NOT_CONFIGURED';
      else { try { state = await this.probe.probe(provider, values); } catch { state = 'UNKNOWN'; } }
    }
    await this.audit('integration.tested', provider, actor, { state });
    return { provider, state, message: TEST_MESSAGES[state], testedAt: this.clock() };
  }

  private bump(): void { this.versionNo++; this.cache.clear(); }

  private async audit(actionKey: string, provider: ProviderKey, actor: IntegrationActor, summary: Record<string, unknown>): Promise<void> {
    try { await this.activity?.record({ vendorId: null, actor: { type: 'STAFF', id: actor.id, ip: actor.ip ?? null }, actionKey, entityType: 'Integration', entityId: provider, summary }); } catch { /* an audit failure never undoes the change or shows a value */ }
  }
}
