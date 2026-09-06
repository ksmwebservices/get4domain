import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { encryptSecret, decryptSecret } from '../platform-settings/crypto.util';
import { UpdateVendorPaymentDto } from './dto/vendor-payment.dto';

export interface VendorPaymentPublic {
  razorpayKeyId: string | null;
  enabled: boolean;
  /** True when a secret is stored — the secret itself is never returned. */
  hasSecret: boolean;
}

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
    return {
      razorpayKeyId: row?.razorpayKeyId ?? null,
      enabled: row?.enabled ?? false,
      hasSecret: Boolean(row?.razorpayKeySecret),
    };
  }

  async upsert(vendorId: string, dto: UpdateVendorPaymentDto): Promise<VendorPaymentPublic> {
    const data: { razorpayKeyId?: string | null; razorpayKeySecret?: string; enabled?: boolean } = {};
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
   * Server-only: the vendor's live Razorpay keys for creating/verifying an order.
   * Returns null unless payments are enabled AND both keys are present + decryptable —
   * so a public checkout simply stays unavailable until the vendor finishes setup.
   */
  async getKeys(vendorId: string): Promise<{ keyId: string; keySecret: string } | null> {
    const row = await this.prisma.vendorPaymentConfig.findUnique({ where: { vendorId } });
    if (!row?.enabled || !row.razorpayKeyId || !row.razorpayKeySecret) return null;
    try {
      return { keyId: row.razorpayKeyId, keySecret: decryptSecret(row.razorpayKeySecret) };
    } catch {
      return null;
    }
  }
}
