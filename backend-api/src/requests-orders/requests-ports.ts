import { Injectable } from '@nestjs/common';
import { ContentSource } from '../site-publish/content/content-source';
import { MethodKind } from './core/commerce-core';

/** The vendor's own payment gateway or UPI account. In this batch ONLY the fake exists: the real adapter is built only for an ACTIVE method AND an env flag the owner sets later, and none is wired. */
export interface CheckoutRequest { orderId: string; orderNo: number; amountPaise: number; currency: string; kind: MethodKind; last4: string | null }
export interface CheckoutData { providerOrderRef: string; amountPaise: number; currency: string; kind: MethodKind; /** what the Next.js layer needs to open the vendor's own checkout; never a secret */ publicHint: string | null; mode: 'FAKE' }
export abstract class OwnGatewayPort {
  abstract test(m: { kind: MethodKind; hasSecret: boolean; hasUpiId?: boolean }): Promise<{ ok: boolean; mode: 'FAKE'; message: string }>;
  abstract createCheckout(c: CheckoutRequest): Promise<CheckoutData>;
}

@Injectable()
export class FakeOwnGateway extends OwnGatewayPort {
  async test(m: { kind: MethodKind; hasSecret: boolean; hasUpiId?: boolean }) {
    if (m.kind === 'UPI') return m.hasUpiId ? { ok: true, mode: 'FAKE' as const, message: 'The UPI id looks right. No payment was made.' } : { ok: false, mode: 'FAKE' as const, message: 'Add your UPI id first.' };
    return m.kind === 'OWN_GATEWAY' ? { ok: m.hasSecret, mode: 'FAKE' as const, message: m.hasSecret ? 'Sandbox check passed. No real gateway was called.' : 'Add the gateway details first.' } : { ok: true, mode: 'FAKE' as const, message: 'Nothing to test for this way of being paid.' };
  }
  async createCheckout(c: CheckoutRequest): Promise<CheckoutData> { return { providerOrderRef: c.orderId, amountPaise: c.amountPaise, currency: c.currency, kind: c.kind, publicHint: c.last4 ? `ends ${c.last4}` : null, mode: 'FAKE' }; }
}

/**
 * The only door to a gateway. Live is refused: it needs an ACTIVE vendor method AND VENDOR_GATEWAY_LIVE_ENABLED=true (set later by the owner), and this build has no real adapter, so
 * asking for live fails plainly instead of pretending (Rule 6). Everything else uses the fake.
 */
@Injectable()
export class OwnGatewayGate {
  env: Record<string, string | undefined> = process.env;
  private readonly fake = new FakeOwnGateway();
  get(): OwnGatewayPort {
    if (this.env.VENDOR_GATEWAY_LIVE_ENABLED === 'true') throw new Error('ADAPTER_NOT_CONFIGURED');
    return this.fake;
  }
}

/** The catalogue a visitor orders from: the vendor's published items with a real price. */
export interface CatalogueItem { productRef: string; name: string; unitPaise: number; taxPercent: number }
export abstract class Catalogue { abstract find(vendorId: string, productRef: string): Promise<CatalogueItem | null>; }

/** "300", "1,250", "₹ 99.50" are prices; "on request" or an empty price is not. A price with a fraction of a paisa is refused. */
export function parsePricePaise(raw: unknown): number | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const t = String(raw).replace(/[₹,\s]|rs\.?/gi, '');
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(t)) return null;
  const [r, p = ''] = t.split('.');
  return Number(r) * 100 + Number(p.padEnd(2, '0'));
}

@Injectable()
export class ContentCatalogue extends Catalogue {
  constructor(private readonly content: ContentSource) { super(); }
  async find(vendorId: string, productRef: string): Promise<CatalogueItem | null> {
    const doc = await this.content.load(vendorId);
    const it = doc?.items.find((i) => i.id === productRef && i.active && !i.sample && !i.samplePrice);
    const unit = it ? parsePricePaise(it.price) : null;
    // The catalogue holds no tax rate per item, so no tax is added here (OPEN QUESTION in the log); the vendor's invoice snapshot carries the tax lines from the vendor profile.
    return it && unit !== null && unit > 0 ? { productRef: it.id, name: it.name, unitPaise: unit, taxPercent: 0 } : null;
  }
}

/** Checks that the vendor has accepted the current published terms. Declared in the terms module (slice 5.15), which binds the real one. Absent = no check. */
export { AcceptanceGuard } from '../terms/terms-ports';
