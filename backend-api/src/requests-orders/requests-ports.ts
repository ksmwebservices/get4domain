import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
export interface CatalogueItem { productRef: string; name: string; unitPaise: number; taxPercent: number; /** the HSN or SAC code of the item, carried onto the order line (slice 5.24c); absent for content items */ hsnSac?: string | null }
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

/** The store catalogue of slice 5.24c (products and variants of an Ecommerce business). Read only; `find` answers for ONE business. */
export abstract class StoreProducts { abstract find(vendorId: string, productRef: string): Promise<CatalogueItem | null> }

/**
 * Reads the store catalogue: a variant (its own price, else the product price) or a product with no variants, live (not archived), with a real price. The tax rate is the one on the product (from the rate
 * table); the cart prices whole percents only, so a product with a fractional rate is not offered here (OPEN QUESTION in docs/v3/V3_BUSINESS_MODULES.md) and a product with no rate carries 0.
 */
@Injectable()
export class PrismaStoreProducts extends StoreProducts {
  constructor(private readonly prisma: PrismaService) { super(); }
  async find(vendorId: string, ref: string): Promise<CatalogueItem | null> {
    const v = await this.prisma.v3StoreVariant.findFirst({ where: { id: ref, vendorId, archivedAt: null }, include: { product: true } });
    const p = v ? v.product : await this.prisma.v3StoreProduct.findFirst({ where: { id: ref, vendorId, archivedAt: null }, include: { variants: { where: { archivedAt: null }, select: { id: true } } } });
    if (!p || p.archivedAt) return null;
    if (!v && 'variants' in p && (p as { variants: unknown[] }).variants.length > 0) return null;   // a product with variants is ordered through a variant
    const rate = p.taxRatePercent === null ? 0 : Number(p.taxRatePercent);
    const unit = v ? v.pricePaise ?? p.pricePaise : p.pricePaise;
    if (!Number.isInteger(rate) || unit < 1) return null;
    return { productRef: v ? v.id : p.id, name: v ? `${p.name} ${v.label}` : p.name, unitPaise: unit, taxPercent: rate, hsnSac: p.hsnSac };
  }
}

/** The shop catalogue first (an Ecommerce business), then the published content items (every other site). A reference that is in neither is not available. */
@Injectable()
export class StoreFirstCatalogue extends Catalogue {
  constructor(private readonly products: StoreProducts, private readonly content: ContentCatalogue) { super(); }
  async find(vendorId: string, productRef: string): Promise<CatalogueItem | null> { return (await this.products.find(vendorId, productRef)) ?? this.content.find(vendorId, productRef); }
}
