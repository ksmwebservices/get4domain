import { BadRequestException, HttpException, Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { decryptSecret, encryptSecret } from '../../platform-settings/crypto.util';
import { ActivityService } from '../../v3-activity/activity.service';
import { billingError } from '../plan-billing.errors';
import { CREDENTIAL_CATEGORY, CREDENTIAL_FIELDS, CredentialMode, CredentialValues, checkCredentials, credentialKey, fieldNames, identifierField, isCredentialMode, lastFour } from './gateway-credentials-core';
import { GATEWAY_NAMES, GatewayName, isGatewayName } from './gateway-core';

export interface CredentialActor { id: string | null; ip?: string | null }
/** What the admin may learn about a stored set: whether it is complete, who set it and when, and at most the last 4 characters of the key id. Never a secret, never the webhook secret, never a length. */
export interface CredentialStatus { gateway: GatewayName; mode: CredentialMode; present: boolean; setBy: string | null; setAt: Date | null; keyIdLast4: string | null }

const TTL_MS = 30_000;

/**
 * The gateway keys and webhook secrets the SUPER_ADMIN types into the admin app (Wave 4 W6, owner decision 17 Nov 2026). They are stored encrypted at rest in the platform settings table with the same AES-GCM the
 * platform settings already use (the master key comes from the PLATFORM_SETTINGS_KEY environment variable), under their own category that the older settings screen cannot list or write. WRITE-ONLY: no route
 * returns a value; the status route says present or not, who and when, and at most the last 4 characters of the key id. Nothing is logged: errors here never contain a value, and a failure to decrypt reads as
 * "not set" so the environment fallback applies. Setting and clearing are audited (field NAMES only). Business verification (KYC) is done on the gateways' own sites, not here.
 */
@Injectable()
export class GatewayCredentialsService {
  /** bumped on every set and clear, so a gate that cached an adapter rebuilds it */
  private versionNo = 0;
  private cache = new Map<string, { at: number; value: CredentialValues | null }>();
  now: () => number = () => Date.now();
  constructor(private readonly prisma: PrismaService, @Optional() private readonly activity?: ActivityService) {}

  version(): number { return this.versionNo; }

  private params(gateway: unknown, mode: unknown): { gateway: GatewayName; mode: CredentialMode } {
    if (!isGatewayName(gateway)) throw new BadRequestException(billingError('GATEWAY_CREDENTIALS_INVALID', 'The gateway must be razorpay or cashfree.'));
    if (!isCredentialMode(mode)) throw new BadRequestException(billingError('GATEWAY_CREDENTIALS_INVALID', 'The mode must be test or live.'));
    return { gateway, mode };
  }

  private async rows(gateway: GatewayName, mode: CredentialMode) {
    const prefix = `${gateway}.${mode}.`;
    return (await this.prisma.platformSetting.findMany({ where: { category: CREDENTIAL_CATEGORY, key: { startsWith: prefix } } })).filter((r) => r.key.startsWith(prefix));
  }

  /** Write-only: replaces the whole set of one gateway and mode, encrypted. Answers with the status, never with a value. */
  async set(gatewayIn: unknown, modeIn: unknown, input: unknown, actor: CredentialActor): Promise<CredentialStatus> {
    const { gateway, mode } = this.params(gatewayIn, modeIn);
    const c = checkCredentials(gateway, mode, input);
    if (!c.ok) throw new BadRequestException({ ...billingError('GATEWAY_CREDENTIALS_INVALID', 'Some details need fixing.'), details: { fields: c.fields } });
    let encrypted: Record<string, string>;
    try { encrypted = Object.fromEntries(Object.entries(c.values).map(([f, v]) => [f, encryptSecret(v)])); }
    catch { throw new HttpException(billingError('GATEWAY_CREDENTIALS_UNAVAILABLE', 'Credentials cannot be stored on this server yet: its encryption key is not set up.'), 503); }
    await this.prisma.$transaction(async (tx) => {
      for (const f of fieldNames(gateway)) {
        const key = credentialKey(gateway, mode, f);
        await tx.platformSetting.upsert({
          where: { category_key: { category: CREDENTIAL_CATEGORY, key } },
          update: { value: encrypted[f], encrypted: true, status: 'CONFIGURED', updatedBy: actor.id },
          create: { category: CREDENTIAL_CATEGORY, key, value: encrypted[f], encrypted: true, status: 'CONFIGURED', updatedBy: actor.id },
        });
      }
    });
    this.bump();
    await this.audit('billing.gateway.credentials.set', gateway, mode, actor, { fields: fieldNames(gateway) });
    return this.statusOf(gateway, mode);
  }

  /** Removes the whole set of one gateway and mode. Clearing what is not there changes nothing and is not audited. */
  async clear(gatewayIn: unknown, modeIn: unknown, actor: CredentialActor): Promise<CredentialStatus> {
    const { gateway, mode } = this.params(gatewayIn, modeIn);
    const had = (await this.rows(gateway, mode)).length > 0;
    if (had) {
      await this.prisma.platformSetting.deleteMany({ where: { category: CREDENTIAL_CATEGORY, key: { in: fieldNames(gateway).map((f) => credentialKey(gateway, mode, f)) } } });
      this.bump();
      await this.audit('billing.gateway.credentials.cleared', gateway, mode, actor, { fields: fieldNames(gateway) });
    }
    return this.statusOf(gateway, mode);
  }

  async status(): Promise<CredentialStatus[]> {
    const out: CredentialStatus[] = [];
    for (const g of GATEWAY_NAMES) for (const m of ['test', 'live'] as const) out.push(await this.statusOf(g, m));
    return out;
  }

  private async statusOf(gateway: GatewayName, mode: CredentialMode): Promise<CredentialStatus> {
    const rows = await this.rows(gateway, mode);
    const complete = fieldNames(gateway).every((f) => rows.some((r) => r.key === credentialKey(gateway, mode, f)));
    if (!complete) return { gateway, mode, present: false, setBy: null, setAt: null, keyIdLast4: null };
    const idRow = rows.find((r) => r.key === credentialKey(gateway, mode, identifierField(gateway)))!;
    let last: string | null = null;
    try { last = lastFour(decryptSecret(idRow.value)); } catch { /* unreadable: no hint */ }
    const newest = rows.slice().sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
    return { gateway, mode, present: true, setBy: newest.updatedBy ?? null, setAt: newest.updatedAt, keyIdLast4: last };
  }

  /**
   * For the gate only: the decrypted set of one gateway and mode, or null when none is stored, it is incomplete, or it cannot be decrypted (then the environment applies). Kept in memory for a short time and
   * dropped on every set and clear on this server. The returned object is never logged or sent anywhere but into an adapter.
   */
  async resolve(gateway: GatewayName, mode: CredentialMode): Promise<CredentialValues | null> {
    const ck = `${gateway}:${mode}`; const hit = this.cache.get(ck); const t = this.now();
    if (hit && t - hit.at < TTL_MS) return hit.value;
    let value: CredentialValues | null = null;
    try {
      const rows = await this.rows(gateway, mode);
      const out: CredentialValues = {};
      for (const f of CREDENTIAL_FIELDS[gateway]) { const r = rows.find((x) => x.key === credentialKey(gateway, mode, f.field)); if (r) out[f.field] = decryptSecret(r.value); }
      value = fieldNames(gateway).every((f) => !!out[f]) ? out : null;
    } catch { value = null; }
    this.cache.set(ck, { at: t, value });
    return value;
  }

  /** whether a complete set is stored: a yes or no for the gateway settings check */
  async has(gateway: GatewayName, mode: CredentialMode): Promise<boolean> { return (await this.resolve(gateway, mode)) !== null; }

  private bump(): void { this.versionNo++; this.cache.clear(); }

  private async audit(actionKey: string, gateway: GatewayName, mode: CredentialMode, actor: CredentialActor, summary: Record<string, unknown>): Promise<void> {
    try { await this.activity?.record({ vendorId: null, actor: { type: 'STAFF', id: actor.id, ip: actor.ip ?? null }, actionKey, entityType: 'PaymentGatewayCredentials', entityId: `${gateway}:${mode}`, summary }); } catch { /* an audit failure never undoes the change and never carries a value */ }
  }
}
