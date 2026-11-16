import { ConflictException, BadRequestException, Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityService } from '../../v3-activity/activity.service';
import { billingError } from '../plan-billing.errors';
import { BillingSettingsService } from '../settings/billing-settings.service';
import { GATEWAY_NAMES, GatewayName, isGatewayName } from './gateway-core';

export interface GatewayActor { id: string | null; ip?: string | null }
export interface GatewaySettingsView {
  gateway: GatewayName; mode: 'off' | 'test' | 'live';
  /** the environment flag that must be true before live mode can be chosen (a name is never shown, only whether it is on) */
  liveAllowedByEnvironment: boolean;
  /** which gateways have the keys of each mode in the environment; booleans only, never a value */
  configured: Record<GatewayName, { test: boolean; live: boolean }>;
}

const MODES = ['off', 'test', 'live'] as const;

/**
 * The admin choice of payment gateway and its mode (Wave 3 Part C). Two plan settings, `paymentGateway` and `paymentsMode`, edited by ADMIN or SUPER_ADMIN, audited. Both start OFF: mode off, and the gateway
 * is Razorpay until someone chooses. A mode of test or live is accepted only when that gateway's keys of that mode are present in the environment, and live also needs PLAN_PAYMENTS_LIVE_ENABLED=true:
 * the setting can never switch on a gateway the server cannot talk to. Key VALUES are never read out of here.
 */
@Injectable()
export class PaymentGatewaySettingsService {
  /** overridable in tests */
  env: Record<string, string | undefined> = process.env;
  constructor(private readonly prisma: PrismaService, private readonly settings: BillingSettingsService, @Optional() private readonly activity?: ActivityService) {}

  private has(name: GatewayName, mode: 'test' | 'live'): boolean {
    const P = mode === 'live' ? 'LIVE' : 'TEST';
    if (name === 'razorpay') return !!(this.env[`RAZORPAY_${P}_KEY_ID`] && this.env[`RAZORPAY_${P}_KEY_SECRET`] && this.env[`RAZORPAY_${P}_WEBHOOK_SECRET`]);
    return !!(this.env[`CASHFREE_${P}_APP_ID`] && this.env[`CASHFREE_${P}_SECRET_KEY`]);
  }

  async get(): Promise<GatewaySettingsView> {
    const s = await this.settings.get();
    return {
      gateway: s.paymentGateway, mode: s.paymentsMode, liveAllowedByEnvironment: this.env.PLAN_PAYMENTS_LIVE_ENABLED === 'true',
      configured: Object.fromEntries(GATEWAY_NAMES.map((g) => [g, { test: this.has(g, 'test'), live: this.has(g, 'live') }])) as GatewaySettingsView['configured'],
    };
  }

  async update(input: { gateway?: unknown; mode?: unknown }, actor: GatewayActor): Promise<GatewaySettingsView> {
    const before = await this.settings.get();
    const gateway = input.gateway === undefined ? before.paymentGateway : input.gateway;
    const mode = input.mode === undefined ? before.paymentsMode : input.mode;
    if (input.gateway === undefined && input.mode === undefined) throw new BadRequestException(billingError('GATEWAY_SETTING_INVALID', 'Send a gateway, a mode, or both.'));
    if (!isGatewayName(gateway)) throw new BadRequestException(billingError('GATEWAY_SETTING_INVALID', 'The gateway must be razorpay or cashfree.'));
    if (typeof mode !== 'string' || !(MODES as readonly string[]).includes(mode)) throw new BadRequestException(billingError('GATEWAY_SETTING_INVALID', 'The mode must be off, test or live.'));
    if (mode === 'live' && this.env.PLAN_PAYMENTS_LIVE_ENABLED !== 'true') throw new ConflictException(billingError('LIVE_NOT_ENABLED', 'Live payments are not enabled on this server.'));
    if ((mode === 'test' || mode === 'live') && !this.has(gateway, mode)) throw new ConflictException(billingError('GATEWAY_NOT_READY', `The ${gateway} ${mode} keys are not set up on this server yet.`));
    const changed: Record<string, { before: unknown; after: unknown }> = {};
    if (gateway !== before.paymentGateway) changed.paymentGateway = { before: before.paymentGateway, after: gateway };
    if (mode !== before.paymentsMode) changed.paymentsMode = { before: before.paymentsMode, after: mode };
    for (const [key, v] of Object.entries({ paymentGateway: gateway, paymentsMode: mode })) {
      if (changed[key]) await this.prisma.v3PlanSetting.upsert({ where: { key }, update: { valueJson: v }, create: { key, valueJson: v, description: 'Wave 3 payment gateway setting' } });
    }
    if (Object.keys(changed).length) {
      this.settings.invalidate();
      await this.activity?.record({ vendorId: null, actor: { type: 'STAFF', id: actor.id, ip: actor.ip ?? null }, actionKey: 'billing.gateway.changed', entityType: 'PaymentGateway', entityId: 'platform', summary: changed });
    }
    return this.get();
  }
}
