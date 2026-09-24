import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Category, Prisma, VendorCMS, VendorProduct } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePlatformCmsDto } from './dto/update-platform-cms.dto';
import { UpdateVendorCmsDto } from './dto/update-vendor-cms.dto';
import { CreateProductDto, UpdateProductDto } from './dto/create-product.dto';

@Injectable()
export class CmsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlatformCms(): Promise<Record<string, string>> {
    const rows = await this.prisma.platformCMS.findMany();
    return rows.reduce<Record<string, string>>((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
  }

  async getLogo(): Promise<string | null> {
    const row = await this.prisma.platformCMS.findUnique({ where: { key: 'logo' } });
    return row?.value ?? null;
  }

  async getFavicon(): Promise<string | null> {
    const row = await this.prisma.platformCMS.findUnique({ where: { key: 'favicon' } });
    return row?.value ?? null;
  }

  async getSEO(): Promise<{ title: string | null; description: string | null; keywords: string | null }> {
    const [title, description, keywords] = await Promise.all([
      this.prisma.platformCMS.findUnique({ where: { key: 'seoTitle' } }),
      this.prisma.platformCMS.findUnique({ where: { key: 'seoDescription' } }),
      this.prisma.platformCMS.findUnique({ where: { key: 'seoKeywords' } }),
    ]);
    return {
      title: title?.value ?? null,
      description: description?.value ?? null,
      keywords: keywords?.value ?? null,
    };
  }

  async getContactDetails(): Promise<{ phone: string | null; email: string | null; address: string | null }> {
    const [phone, email, address] = await Promise.all([
      this.prisma.platformCMS.findUnique({ where: { key: 'phone' } }),
      this.prisma.platformCMS.findUnique({ where: { key: 'email' } }),
      this.prisma.platformCMS.findUnique({ where: { key: 'address' } }),
    ]);
    return {
      phone: phone?.value ?? null,
      email: email?.value ?? null,
      address: address?.value ?? null,
    };
  }

  async updatePlatformCms(dto: UpdatePlatformCmsDto): Promise<Record<string, string>> {
    const entries = Object.entries(dto).filter(([, value]) => value !== undefined) as [string, string][];

    await Promise.all(
      entries.map(([key, value]) =>
        this.prisma.platformCMS.upsert({
          where: { key },
          create: { key, value },
          update: { value },
        }),
      ),
    );

    return this.getPlatformCms();
  }

  async getVendorCMS(vendorId: string): Promise<VendorCMS | null> {
    return this.prisma.vendorCMS.findUnique({ where: { vendorId } });
  }

  async updateVendorCMS(vendorId: string, dto: UpdateVendorCmsDto): Promise<VendorCMS> {
    // A premium (priced) template can only be applied once the vendor has purchased it.
    if (dto.themeId) {
      const theme = await this.prisma.websiteTheme.findUnique({ where: { id: dto.themeId } });
      if (theme && theme.price && theme.price > 0) {
        const unlock = await this.prisma.vendorTemplateUnlock.findUnique({
          where: { vendorId_themeId: { vendorId, themeId: dto.themeId } },
        });
        if (!unlock) throw new ForbiddenException('Unlock this premium template before applying it.');
      }
    }
    return this.prisma.vendorCMS.upsert({
      where: { vendorId },
      create: { vendorId, ...dto },
      update: dto,
    });
  }

  getVendorProducts(vendorId: string): Promise<VendorProduct[]> {
    return this.prisma.vendorProduct.findMany({ where: { vendorId }, orderBy: { createdAt: 'desc' } });
  }

  /** A vendor's own category list (e.g. for a future picker/autocomplete in the
   *  product form — today's `my-products` still free-types a name, which is exactly
   *  what this resolves against so a repeat name reuses the same row). */
  getVendorCategories(vendorId: string): Promise<Category[]> {
    return this.prisma.category.findMany({ where: { vendorId }, orderBy: { name: 'asc' } });
  }

  /**
   * The ONE place a Category row is ever created (dispatch 24-Sep-2026). Case-
   * insensitive find-or-create, scoped per vendor: typing "Sneakers" and later
   * "sneakers" resolves to the SAME row — the second attempt reuses the FIRST one's
   * canonical casing rather than creating a silently-disconnected duplicate. The
   * category's industry is always the vendor's own (read server-side, never trusted
   * from the client). Returns null for an empty/whitespace name (no category set).
   */
  private async findOrCreateCategory(vendorId: string, name: string | undefined | null): Promise<Category | null> {
    const trimmed = name?.trim();
    if (!trimmed) return null;
    const nameNormalized = trimmed.toLowerCase();
    const existing = await this.prisma.category.findUnique({
      where: { vendorId_nameNormalized: { vendorId, nameNormalized } },
    });
    if (existing) return existing;
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { industry: true } });
    return this.prisma.category.create({
      data: { vendorId, industry: vendor?.industry ?? 'general', name: trimmed, nameNormalized },
    });
  }

  async addProduct(vendorId: string, dto: CreateProductDto): Promise<VendorProduct> {
    const { customFields, category, ...rest } = dto;
    const categoryRow = await this.findOrCreateCategory(vendorId, category);
    return this.prisma.vendorProduct.create({
      data: {
        vendorId,
        ...rest,
        // Store the CANONICAL name (categoryRow's, not necessarily what was typed —
        // e.g. reusing "Sneakers" for a second "sneakers" entry) so the free-text
        // column and the real relation never drift apart.
        category: categoryRow?.name ?? category,
        categoryId: categoryRow?.id,
        ...(customFields !== undefined ? { customFields: customFields as Prisma.InputJsonValue } : {}),
      },
    });
  }

  async updateProduct(productId: string, dto: UpdateProductDto): Promise<VendorProduct> {
    const product = await this.prisma.vendorProduct.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    const { customFields, category, ...rest } = dto;
    // Only re-resolve the category when the caller actually sent one — `category` is
    // optional on UpdateProductDto (e.g. a `{ active: false }` hide-toggle call must
    // not silently null out or re-touch the product's existing category).
    const categoryPatch = category !== undefined
      ? await this.findOrCreateCategory(product.vendorId, category).then((row) => ({ category: row?.name ?? category, categoryId: row?.id ?? null }))
      : {};
    return this.prisma.vendorProduct.update({
      where: { id: productId },
      data: { ...rest, ...categoryPatch, ...(customFields !== undefined ? { customFields: customFields as Prisma.InputJsonValue } : {}) },
    });
  }

  /** Public: resolve a live (non-sandbox) vendor's public site by subdomain. */
  async getSiteBySubdomain(subdomain: string): Promise<{
    vendor: { id: string; businessName: string; industry: string; subdomain: string | null };
    cms: VendorCMS | null;
    products: VendorProduct[];
    theme: { id: string; name: string; industry: string | null; cssVars: unknown; layout: unknown; pages: unknown; css: string | null; js: string | null; fonts: unknown } | null;
    paymentsEnabled: boolean;
  }> {
    const vendor = await this.prisma.vendor.findUnique({ where: { subdomain } });
    if (!vendor || vendor.isSandbox) {
      throw new NotFoundException('Site not found');
    }
    const [cms, products] = await Promise.all([
      this.prisma.vendorCMS.findUnique({ where: { vendorId: vendor.id } }),
      this.prisma.vendorProduct.findMany({
        where: { vendorId: vendor.id, active: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    // The vendor's selected template (with its data-driven layout), if any — so the
    // public site can render a chosen design with no redeploy.
    const themeRow = cms?.themeId
      ? await this.prisma.websiteTheme.findUnique({ where: { id: cms.themeId } })
      : null;
    // Whether the vendor has switched on their own Razorpay — gates the public shop/checkout.
    const pay = await this.prisma.vendorPaymentConfig.findUnique({ where: { vendorId: vendor.id } });
    const paymentsEnabled = Boolean(pay?.enabled && pay.razorpayKeyId && pay.razorpayKeySecret);
    return {
      vendor: {
        id: vendor.id,
        businessName: vendor.businessName,
        industry: vendor.industry ?? 'general',
        subdomain: vendor.subdomain,
      },
      cms,
      products,
      theme: themeRow
        ? { id: themeRow.id, name: themeRow.name, industry: themeRow.industry, cssVars: themeRow.cssVars, layout: themeRow.layout, pages: themeRow.pages, css: themeRow.css, js: themeRow.js, fonts: themeRow.fonts }
        : null,
      paymentsEnabled,
    };
  }

  async deleteProduct(productId: string): Promise<VendorProduct> {
    const product = await this.prisma.vendorProduct.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return this.prisma.vendorProduct.delete({ where: { id: productId } });
  }

  async getProductOwner(productId: string): Promise<string> {
    const product = await this.prisma.vendorProduct.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product.vendorId;
  }
}
