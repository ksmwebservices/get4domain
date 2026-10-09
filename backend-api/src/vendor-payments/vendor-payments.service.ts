import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { encryptSecret, decryptSecret } from '../platform-settings/crypto.util';
import { UpdateVendorPaymentDto } from './dto/vendor-payment.dto';

export interface VendorPaymentPublic {
  razorpayKeyId: string | null;
  enabled: boolean;
  /** True when a secret is stored — the secret itself is never returned. */
  hasSecret: boolean;
  /** 'ONLINE' | 'ORDER_REQUEST' | null (legacy: online if the keys are saved and enabled). */
  checkoutMode: string | null;
  /** 'test' | 'live' | null, read from the Key ID. */
  mode: 'test' | 'live' | null;
  /** True when the saved Key ID is not a Razorpay key (an old save that picked up the wrong text); the screen asks the vendor to re-enter it. */
  keyIdInvalid: boolean;
}

export const RAZORPAY_KEY_ID = /^rzp_(test|live)_[A-Za-z0-9]{6,40}$/;

export interface ConnectionTest { ok: boolean; mode: 'test' | 'live' | null; message: string }

/**
 * Per-vendor payment credentials. Vendors collect public-site payments DIRECTLY into
 * their own Razorpay account, so these keys drive the public checkout (see the engine
 * checkout dispatch). The secret is encrypted at rest and never leaves the server;
 * `getKeys` is the ONLY path that decrypts it, for server-side order creation.
 */
@Injectable()
export class VendorPaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublic(vendorId: string): Promise<VendorPaymentPublic> {
    const row = await this.prisma.vendorPaymentConfig.findUnique({ where: { vendorId } });
    const keyId = row?.razorpayKeyId ?? null;
    const valid = keyId ? RAZORPAY_KEY_ID.test(keyId) : false;
    return {
      // A value that is not a Razorpay key is never shown back (it is what B2 found: an e-mail address saved in this field).
      razorpayKeyId: valid ? keyId : null,
      enabled: row?.enabled ?? false,
      hasSecret: Boolean(row?.razorpayKeySecret),
      checkoutMode: row?.checkoutMode ?? null,
      mode: valid ? (keyId as string).startsWith('rzp_live_') ? 'live' : 'test' : null,
      keyIdInvalid: Boolean(keyId) && !valid,
    };
  }

  async upsert(vendorId: string, dto: UpdateVendorPaymentDto): Promise<VendorPaymentPublic> {
    const data: { razorpayKeyId?: string | null; razorpayKeySecret?: string; enabled?: boolean; checkoutMode?: string } = {};
    if (dto.checkoutMode !== undefined) data.checkoutMode = dto.checkoutMode;
    if (dto.razorpayKeyId !== undefined) data.razorpayKeyId = dto.razorpayKeyId.trim() || null;
    // Only (re)encrypt when a new secret is actually supplied — an empty/omitted secret
    // keeps whatever is already stored.
    if (dto.razorpayKeySecret && dto.razorpayKeySecret.trim()) data.razorpayKeySecret = encryptSecret(dto.razorpayKeySecret.trim());
    if (dto.enabled !== undefined) data.enabled = dto.enabled;

    await this.prisma.vendorPaymentConfig.upsert({
      where: { vendorId },
      create: { vendorId, ...data },
      update: data,
    });
    return this.getPublic(vendorId);
  }

  /**
   * "Test connection": asks Razorpay (read only) whether the keys work. Uses the keys typed on the screen when given, else the saved ones.
   * Never changes anything and never returns the secret.
   */
  async testConnection(vendorId: string, typed: { razorpayKeyId?: string; razorpayKeySecret?: string }, fetcher: typeof fetch = fetch): Promise<ConnectionTest> {
    const row = await this.prisma.vendorPaymentConfig.findUnique({ where: { vendorId } });
    const keyId = (typed.razorpayKeyId?.trim() || row?.razorpayKeyId || '').trim();
    let secret = typed.razorpayKeySecret?.trim() || '';
    if (!secret && row?.razorpayKeySecret) { try { secret = decryptSecret(row.razorpayKeySecret); } catch { secret = ''; } }
    if (!keyId || !secret) throw new BadRequestException('Enter your Razorpay Key ID and Key Secret first, then test.');
    if (!RAZORPAY_KEY_ID.test(keyId)) throw new BadRequestException('That does not look like a Razorpay Key ID. It starts with rzp_test_ or rzp_live_.');
    const mode = keyId.startsWith('rzp_live_') ? 'live' : 'test';
    try {
      const res = await fetcher('https://api.razorpay.com/v1/orders?count=1', { headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString('base64')}` }, signal: AbortSignal.timeout(10_000) });
      if (res.ok) return { ok: true, mode, message: `Connected. Razorpay accepted these ${mode} keys.` };
      if (res.status === 401) return { ok: false, mode, message: 'Razorpay did not accept these keys. Check that the Key ID and the Key Secret belong together and that you copied both completely.' };
      return { ok: false, mode, message: 'Razorpay answered, but could not confirm the keys right now. Try again in a minute.' };
    } catch {
      return { ok: false, mode, message: 'We could not reach Razorpay just now. Check your internet connection and try again.' };
    }
  }

  /**
   * Server-only: the vendor's live Razorpay keys for creating/verifying an order.
   * Returns null unless payments are enabled AND both keys are present + decryptable —
   * so a public checkout simply stays unavailable until the vendor finishes setup.
   */
  async getKeys(vendorId: string): Promise<{ keyId: string; keySecret: string } | null> {
    const row = await this.prisma.vendorPaymentConfig.findUnique({ where: { vendorId } });
    if (!row?.enabled || !row.razorpayKeyId || !row.razorpayKeySecret) return null;
    if (!RAZORPAY_KEY_ID.test(row.razorpayKeyId)) return null; // a value that is not a Razorpay key can never take payment
    try {
      return { keyId: row.razorpayKeyId, keySecret: decryptSecret(row.razorpayKeySecret) };
    } catch {
      return null;
    }
  }
}
