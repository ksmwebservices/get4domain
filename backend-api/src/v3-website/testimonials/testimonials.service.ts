import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TESTIMONIAL_LABEL, TESTIMONIAL_NAME_MAX, TESTIMONIAL_TEXT_MAX, Testimonial } from '../core/testimonial-core';
import { LiveProjector, ProjectionCtx } from '../projection/live-projector';
import { WebsiteSettingsService } from '../settings/website-settings.service';
import { WebsiteService } from '../website.service';

export interface TestimonialRow { vendorId: string; position: number; name: string; text: string; date: string | null; version: number }
export type NewTestimonialRow = Omit<TestimonialRow, 'vendorId' | 'version'>;

/** The staff projection of the testimonials of a vendor's live site (slice B4). Prisma below; a memory twin lives in test/support. */
export abstract class TestimonialStore {
  /** Replaces every row of one vendor, in one transaction. */
  abstract replaceForVendor(vendorId: string, version: number, rows: readonly NewTestimonialRow[]): Promise<void>;
  abstract listForVendor(vendorId: string): Promise<TestimonialRow[]>;
}

@Injectable()
export class PrismaTestimonialStore extends TestimonialStore {
  constructor(private readonly prisma: PrismaService) { super(); }
  async replaceForVendor(vendorId: string, version: number, rows: readonly NewTestimonialRow[]): Promise<void> {
    await this.prisma.$transaction([this.prisma.v3Testimonial.deleteMany({ where: { vendorId } }), this.prisma.v3Testimonial.createMany({ data: rows.map((r) => ({ vendorId, version, ...r })) })]);
  }
  async listForVendor(vendorId: string) { return (await this.prisma.v3Testimonial.findMany({ where: { vendorId }, orderBy: { position: 'asc' } })) as TestimonialRow[]; }
}

/** Writes the staff projection of the testimonials when a version goes live. */
@Injectable()
export class TestimonialProjector extends LiveProjector {
  constructor(private readonly store: TestimonialStore) { super(); }
  async project(c: ProjectionCtx): Promise<void> {
    await this.store.replaceForVendor(c.vendorId, c.version, (c.doc.testimonials ?? []).map((t, position) => ({ position, name: t.name, text: t.text, date: t.date ?? null })));
  }
}

export interface TestimonialsView { items: Testimonial[]; label: string; maxCount: number | null; limits: { name: number; text: number }; pro: boolean }

/** The vendor's testimonials editor (from the draft) and the staff read of what is live. */
@Injectable()
export class TestimonialsService {
  constructor(private readonly web: WebsiteService, private readonly store: TestimonialStore, private readonly settings: WebsiteSettingsService) {}
  async view(vendorId: string): Promise<TestimonialsView> {
    const [c, pro, s] = await Promise.all([this.web.seoContext(vendorId), this.web.isProVendor(vendorId), this.settings.get()]);
    return { items: c.doc.testimonials ?? [], label: TESTIMONIAL_LABEL, maxCount: s.testimonialMaxCount, limits: { name: TESTIMONIAL_NAME_MAX, text: TESTIMONIAL_TEXT_MAX }, pro };
  }
  staffList(vendorId: string): Promise<TestimonialRow[]> { return this.store.listForVendor(vendorId); }
}
