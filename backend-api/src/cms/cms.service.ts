import { BadRequestException, ConflictException, Optional, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Category, Prisma, VendorCMS, VendorProduct } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePlatformCmsDto } from './dto/update-platform-cms.dto';
import { UpdateVendorCmsDto } from './dto/update-vendor-cms.dto';
import { CreateProductDto, UpdateProductDto } from './dto/create-product.dto';
import { BillingGateService } from '../commercial/billing-gate.service';
import { countSeoKeywords, entitlementsFor, PlanKey } from '../commercial/entitlements';
import { addMonths } from '../commercial/pricing-math';
import { StockService } from '../stock/stock.service';
import { PUBLIC_PRODUCT_SELECT, PublicProduct, activeFor, normaliseStatus, toPublicProduct, ProductStatus } from '../stock/stock-rules';

/** Theme-change allowance is PER YEAR: the next reset is one year after the previous one (not the end of a shorter billing cycle). */
export function nextYearlyReset(previous: Date, now: Date): Date {
  let next = addMonths(previous, 12);
  while (next.getTime() <= now.getTime()) next = addMonths(next, 12);
  return next;
}

@Injectable()
export class CmsService {
  constructor(
    private readonly prisma: PrismaService,
    // Commercial Engine v1 (both optional so existing manual constructions keep working).
    @Optional() private readonly gate?: BillingGateService,
    // Handover 2026-10-08: stock + movements (optional so manual constructions in tests keep working).
    @Optional() private readonly stock?: StockService,
  ) {}

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

  /** Free SEO keywords per plan. Only vendors on a commercial billing term are capped; everyone else is untouched. */
  private async assertSeoKeywordAllowance(vendorId: string, raw: string | undefined | null): Promise<void> {
    const term = await this.prisma.billingTerm.findFirst({ where: { vendorId, isCurrent: true }, select: { planKey: true, status: true } });
    if (!term || term.status === 'CANCELLED') return;
    const limit = entitlementsFor(term.planKey as PlanKey).seoKeywords;
    if (countSeoKeywords(raw) > limit) {
      throw new BadRequestException(`Your plan includes ${limit} SEO keywords. Remove some, or ask us about adding more.`);
    }
  }

  async updateVendorCMS(vendorId: string, dto: UpdateVendorCmsDto): Promise<VendorCMS> {
    // A lapsed vendor keeps read access but cannot publish site changes until they pay.
    await this.gate?.assertNotLapsed(vendorId, 'publish');
    // Free SEO keywords come from the plan (planKey) — only enforced for vendors on a commercial billing term.
    if (dto.seoKeywords !== undefined) await this.assertSeoKeywordAllowance(vendorId, dto.seoKeywords);
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

    // Theme-change entitlement (dispatch 01-Oct-2026): only a GENUINE theme
    // switch counts (dto.themeId set AND different from the currently-applied
    // theme) — re-saving the same theme's CMS content never consumes the
    // allowance. Only enforced for vendors with a tracked limit (Workspace/BOS
    // subscriptions created after the theme-change migration); vendors with no
    // limit set (themeChangesLimit null — legacy tiers, or pre-migration data)
    // are left unrestricted.
    if (dto.themeId) {
      const existing = await this.prisma.vendorCMS.findUnique({ where: { vendorId }, select: { themeId: true } });
      const isGenuineChange = existing?.themeId !== dto.themeId;
      if (isGenuineChange) {
        const sub = await this.prisma.subscription.findFirst({
          where: { vendorId, product: 'DOMAIN_APP', status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
        });
        if (sub && sub.themeChangesLimit != null) {
          const now = new Date();
          const pastReset = sub.themeChangesResetAt != null && now >= sub.themeChangesResetAt;
          const used = pastReset ? 0 : sub.themeChangesUsed;
          if (used >= sub.themeChangesLimit) {
            const resetLabel = (sub.themeChangesResetAt ?? sub.endDate) ? (sub.themeChangesResetAt ?? sub.endDate)!.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'your next renewal';
            throw new ForbiddenException(
              `You've used all ${sub.themeChangesLimit} theme changes included in your plan this year. More become available on ${resetLabel}.`,
            );
          }
          await this.prisma.subscription.update({
            where: { id: sub.id },
            data: pastReset
              ? { themeChangesUsed: 1, themeChangesResetAt: nextYearlyReset(sub.themeChangesResetAt as Date, now) }
              : { themeChangesUsed: { increment: 1 } },
          });
        }
      }
    }

    // dto.portfolio is a class-validator-typed array (PortfolioImageDto[]); Prisma's
    // Json input type wants a plain InputJsonValue - structurally identical at
    // runtime, just not assignable without this cast.
    const data = { ...dto, portfolio: dto.portfolio as unknown as Prisma.InputJsonValue | undefined };
    return this.prisma.vendorCMS.upsert({
      where: { vendorId },
      create: { vendorId, ...data },
      update: data,
    });
  }

  /** FULL rows, including inactive products and stock fields — for the vendor's own dashboard only (authenticated route). */
  getVendorProducts(vendorId: string): Promise<VendorProduct[]> {
    return this.prisma.vendorProduct.findMany({ where: { vendorId }, orderBy: { createdAt: 'desc' } });
  }

  /** Public list: active products only, through an explicit field whitelist (availability, never internal stock fields). */
  async getPublicProducts(vendorId: string): Promise<PublicProduct[]> {
    const rows = await this.prisma.vendorProduct.findMany({ where: { vendorId, active: true }, select: PUBLIC_PRODUCT_SELECT, orderBy: { createdAt: 'desc' } });
    return rows.map((r) => toPublicProduct(r)).filter((p): p is PublicProduct => p !== null);
  }

  /** A vendor's own category list (e.g. for a future picker/autocomplete in the
   *  product form — today's `my-products` still free-types a name, which is exactly
   *  what this resolves against so a repeat name reuses the same row). */
  getVendorCategories(vendorId: string): Promise<Category[]> {
    return this.prisma.category.findMany({ where: { vendorId, hidden: false }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  }

  /** The vendor's own view: every category (hidden too) with how many products use it. */
  async getCategoriesForManage(vendorId: string): Promise<Array<Category & { productCount: number }>> {
    const [cats, used] = await Promise.all([
      this.prisma.category.findMany({ where: { vendorId }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
      this.prisma.vendorProduct.findMany({ where: { vendorId, categoryId: { not: null } }, select: { categoryId: true } }),
    ]);
    const byId = new Map<string, number>();
    for (const u of used) if (u.categoryId) byId.set(u.categoryId, (byId.get(u.categoryId) ?? 0) + 1);
    return cats.map((c) => ({ ...c, productCount: byId.get(c.id) ?? 0 }));
  }

  async createCategory(vendorId: string, name: string): Promise<Category> {
    const cat = await this.findOrCreateCategory(vendorId, name);
    if (!cat) throw new BadRequestException('Enter a category name');
    return cat;
  }

  /** Rename keeps the denormalised `VendorProduct.category` text in step; renaming onto an existing name is refused. */
  async updateCategory(vendorId: string, id: string, patch: { name?: string; sortOrder?: number; hidden?: boolean }): Promise<Category> {
    const cat = await this.prisma.category.findFirst({ where: { id, vendorId } });
    if (!cat) throw new NotFoundException('Category not found');
    const data: Prisma.CategoryUpdateInput = {};
    if (patch.sortOrder !== undefined) data.sortOrder = patch.sortOrder;
    if (patch.hidden !== undefined) data.hidden = patch.hidden;
    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (!name) throw new BadRequestException('Enter a category name');
      const normalized = name.toLowerCase();
      const clash = await this.prisma.category.findUnique({ where: { vendorId_nameNormalized: { vendorId, nameNormalized: normalized } } });
      if (clash && clash.id !== id) throw new ConflictException(`You already have a category called "${clash.name}".`);
      data.name = name;
      data.nameNormalized = normalized;
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.category.update({ where: { id }, data });
      if (data.name) await tx.vendorProduct.updateMany({ where: { vendorId, categoryId: id }, data: { category: updated.name } });
      return updated;
    });
  }

  async reorderCategories(vendorId: string, ids: string[]): Promise<void> {
    const owned = await this.prisma.category.findMany({ where: { vendorId, id: { in: ids } }, select: { id: true } });
    if (owned.length !== new Set(ids).size) throw new BadRequestException('Unknown category in the list');
    await this.prisma.$transaction(ids.map((id, i) => this.prisma.category.update({ where: { id }, data: { sortOrder: i } })));
  }

  /** Delete a category. If products use it, they must be moved to another category first (clear message otherwise). */
  async deleteCategory(vendorId: string, id: string, moveToId?: string): Promise<{ deleted: true; moved: number }> {
    const cat = await this.prisma.category.findFirst({ where: { id, vendorId } });
    if (!cat) throw new NotFoundException('Category not found');
    const inUse = await this.prisma.vendorProduct.count({ where: { vendorId, categoryId: id } });
    if (inUse > 0 && !moveToId) {
      throw new ConflictException(`${inUse} product${inUse === 1 ? ' uses' : 's use'} "${cat.name}". Choose a category to move ${inUse === 1 ? 'it' : 'them'} to, then delete.`);
    }
    return this.prisma.$transaction(async (tx) => {
      let moved = 0;
      if (inUse > 0 && moveToId) {
        if (moveToId === id) throw new BadRequestException('Choose a different category to move the products to');
        const target = await tx.category.findFirst({ where: { id: moveToId, vendorId } });
        if (!target) throw new BadRequestException('The category to move products to was not found');
        moved = (await tx.vendorProduct.updateMany({ where: { vendorId, categoryId: id }, data: { categoryId: target.id, category: target.name } })).count;
      }
      await tx.category.delete({ where: { id } });
      return { deleted: true as const, moved };
    });
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

  async addProduct(vendorId: string, dto: CreateProductDto, actor?: string): Promise<VendorProduct> {
    const { customFields, category, trackStock, stockQty, reorderLevel, status, ...rest } = dto;
    const categoryRow = await this.findOrCreateCategory(vendorId, category);
    const productStatus: ProductStatus = status ?? 'AVAILABLE';
    const tracked = Boolean(trackStock);
    if (!tracked && stockQty !== undefined && stockQty > 0) throw new BadRequestException('Turn on "track stock" to set a quantity.');
    const create = (tx: Prisma.TransactionClient) => tx.vendorProduct.create({
      data: {
        vendorId,
        ...rest,
        // Store the CANONICAL name (categoryRow's, not necessarily what was typed —
        // e.g. reusing "Sneakers" for a second "sneakers" entry) so the free-text
        // column and the real relation never drift apart.
        category: categoryRow?.name ?? category,
        categoryId: categoryRow?.id,
        status: productStatus,
        active: activeFor(productStatus),
        trackStock: false, // switched on below, together with the OPENING movement
        ...(reorderLevel !== undefined ? { reorderLevel } : {}),
        ...(customFields !== undefined ? { customFields: customFields as Prisma.InputJsonValue } : {}),
      },
    });
    if (!tracked || !this.stock) return create(this.prisma as unknown as Prisma.TransactionClient);
    return this.prisma.$transaction(async (tx) => {
      const product = await create(tx);
      await this.stock!.setOpening(tx, vendorId, product.id, stockQty ?? 0, actor);
      return tx.vendorProduct.findUniqueOrThrow({ where: { id: product.id } });
    });
  }

  async updateProduct(productId: string, dto: UpdateProductDto, actor?: string): Promise<VendorProduct> {
    const product = await this.prisma.vendorProduct.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    const { customFields, category, trackStock, stockQty, reorderLevel, status, active, ...rest } = dto;
    // Only re-resolve the category when the caller actually sent one — `category` is
    // optional on UpdateProductDto (e.g. a `{ active: false }` hide-toggle call must
    // not silently null out or re-touch the product's existing category).
    const categoryPatch = category !== undefined
      ? await this.findOrCreateCategory(product.vendorId, category).then((row) => ({ category: row?.name ?? category, categoryId: row?.id ?? null }))
      : {};

    // Availability: `status` (AVAILABLE / OUT_OF_STOCK / HIDDEN) is the source of truth; the legacy `active` toggle maps onto it.
    let nextStatus: ProductStatus | undefined = status;
    if (nextStatus === undefined && active !== undefined) {
      const cur = normaliseStatus(product.status, product.active);
      nextStatus = active ? (cur === 'HIDDEN' ? 'AVAILABLE' : cur) : 'HIDDEN';
    }
    const statusPatch = nextStatus ? { status: nextStatus, active: activeFor(nextStatus) } : {};

    // Stock: the quantity of an already-tracked product changes ONLY through Adjust stock (so a movement is always written).
    const turningOn = trackStock === true && !product.trackStock;
    if (stockQty !== undefined && !turningOn) throw new BadRequestException('Use "Adjust stock" to change the quantity of a tracked product.');
    if (turningOn && !this.stock) throw new BadRequestException('Stock tracking is not available');
    const trackPatch = trackStock === false ? { trackStock: false } : {};

    const data: Prisma.VendorProductUncheckedUpdateInput = {
      ...rest, ...categoryPatch, ...statusPatch, ...trackPatch,
      ...(reorderLevel !== undefined ? { reorderLevel } : {}),
      ...(customFields !== undefined ? { customFields: customFields as Prisma.InputJsonValue } : {}),
    };
    return this.prisma.$transaction(async (tx) => {
      if (turningOn) await this.stock!.setOpening(tx, product.vendorId, productId, stockQty ?? product.stockQty ?? 0, actor);
      return tx.vendorProduct.update({ where: { id: productId }, data });
    });
  }

  /** Public: resolve a live (non-sandbox) vendor's public site by subdomain. */
  async getSiteBySubdomain(subdomain: string): Promise<{
    vendor: { id: string; businessName: string; industry: string; subdomain: string | null };
    cms: VendorCMS | null;
    products: PublicProduct[];
    theme: { id: string; name: string; industry: string | null; cssVars: unknown; layout: unknown; pages: unknown; css: string | null; js: string | null; fonts: unknown } | null;
    paymentsEnabled: boolean;
    checkoutMode: 'ONLINE' | 'ORDER_REQUEST' | 'NONE';
  }> {
    const vendor = await this.prisma.vendor.findUnique({ where: { subdomain } });
    if (!vendor || vendor.isSandbox) {
      throw new NotFoundException('Site not found');
    }
    const [cms, products] = await Promise.all([
      this.prisma.vendorCMS.findUnique({ where: { vendorId: vendor.id } }),
      this.prisma.vendorProduct.findMany({
        where: { vendorId: vendor.id, active: true },
        select: PUBLIC_PRODUCT_SELECT, // explicit whitelist: no internal field can reach the public payload
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
    // How a shopper can order: online (vendor's own Razorpay), as an order request the vendor confirms, or not at all.
    const checkoutMode: 'ONLINE' | 'ORDER_REQUEST' | 'NONE' = pay?.checkoutMode === 'ORDER_REQUEST' ? 'ORDER_REQUEST' : paymentsEnabled ? 'ONLINE' : 'NONE';
    return {
      vendor: {
        id: vendor.id,
        businessName: vendor.businessName,
        industry: vendor.industry ?? 'general',
        subdomain: vendor.subdomain,
      },
      cms,
      products: products.map((r) => toPublicProduct(r)).filter((p): p is PublicProduct => p !== null),
      theme: themeRow
        ? { id: themeRow.id, name: themeRow.name, industry: themeRow.industry, cssVars: themeRow.cssVars, layout: themeRow.layout, pages: themeRow.pages, css: themeRow.css, js: themeRow.js, fonts: themeRow.fonts }
        : null,
      paymentsEnabled,
      checkoutMode,
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
