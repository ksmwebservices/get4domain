import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KnowledgeBaseEntry } from '@prisma/client';
import { CreateKbEntryDto, UpdateKbEntryDto } from './dto/kb-entry.dto';

/**
 * Vendor knowledge base — the WhatsApp bot's PRIMARY source of truth.
 * - CRUD: a simple vendor-managed Q&A list (question label + trigger keywords +
 *   exact answer).
 * - match(): keyword/word-boundary match of an inbound message against a vendor's
 *   active entries (no AI — cheap, exact, uses the vendor's real answer).
 * - buildContext(): assembles grounding text (KB + existing profile hours/location
 *   + catalog services/pricing) that the AI fallback is constrained to.
 * Every query filters by vendorId (multi-tenant hard rule).
 */
@Injectable()
export class KnowledgeBaseService {
  constructor(private readonly prisma: PrismaService) {}

  list(vendorId: string): Promise<KnowledgeBaseEntry[]> {
    return this.prisma.knowledgeBaseEntry.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'asc' },
    });
  }

  create(vendorId: string, dto: CreateKbEntryDto): Promise<KnowledgeBaseEntry> {
    return this.prisma.knowledgeBaseEntry.create({
      data: {
        vendorId,
        question: dto.question,
        keywords: dto.keywords,
        answer: dto.answer,
        active: dto.active ?? true,
      },
    });
  }

  async update(id: string, vendorId: string, dto: UpdateKbEntryDto): Promise<KnowledgeBaseEntry> {
    // updateMany with a vendorId filter guarantees a vendor can only touch its own
    // entries (a bare update-by-id would leak across tenants).
    const res = await this.prisma.knowledgeBaseEntry.updateMany({ where: { id, vendorId }, data: dto });
    if (res.count === 0) throw new NotFoundException('KB entry not found');
    return this.prisma.knowledgeBaseEntry.findUniqueOrThrow({ where: { id } });
  }

  async remove(id: string, vendorId: string): Promise<{ deleted: boolean }> {
    const res = await this.prisma.knowledgeBaseEntry.deleteMany({ where: { id, vendorId } });
    if (res.count === 0) throw new NotFoundException('KB entry not found');
    return { deleted: true };
  }

  /**
   * Match an inbound message against a vendor's active KB entries. Each entry's
   * comma/space-separated keywords are tested as case-insensitive word-boundary
   * matches; the entry with the most matched keywords wins. Returns null on no hit.
   */
  async match(vendorId: string, text: string): Promise<KnowledgeBaseEntry | null> {
    const entries = await this.prisma.knowledgeBaseEntry.findMany({ where: { vendorId, active: true } });
    const hay = ` ${text.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
    let best: { entry: KnowledgeBaseEntry; hits: number } | null = null;
    for (const entry of entries) {
      const terms = entry.keywords.split(/[,\n]+|\s{2,}/).map((t) => t.trim().toLowerCase()).filter(Boolean);
      let hits = 0;
      for (const term of terms) {
        const t = term.replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim();
        if (t && hay.includes(` ${t} `)) hits++;
      }
      if (hits > 0 && (!best || hits > best.hits)) best = { entry, hits };
    }
    return best?.entry ?? null;
  }

  /**
   * Grounding context for the AI fallback: the vendor's KB answers PLUS the basic
   * business info that already lives in the profile (hours/location) and catalog
   * (services/pricing) — so the AI answers from real vendor data, never a guess.
   */
  async buildContext(vendorId: string): Promise<string> {
    const [entries, cms, products] = await Promise.all([
      this.prisma.knowledgeBaseEntry.findMany({ where: { vendorId, active: true } }),
      this.prisma.vendorCMS.findUnique({ where: { vendorId } }),
      this.prisma.vendorProduct.findMany({ where: { vendorId, active: true }, take: 40 }),
    ]);

    const parts: string[] = [];
    if (entries.length) {
      parts.push('Q&A:\n' + entries.map((e) => `- ${e.question}: ${e.answer}`).join('\n'));
    }
    if (cms) {
      const profile: string[] = [];
      if (cms.businessHours) profile.push(`Hours: ${cms.businessHours}`);
      if (cms.address) profile.push(`Location: ${cms.address}`);
      if (cms.phone) profile.push(`Phone: ${cms.phone}`);
      if (profile.length) parts.push('Business info:\n' + profile.join('\n'));
    }
    if (products.length) {
      parts.push(
        'Services / products:\n' +
          products
            .map((p) => `- ${p.name}${p.price ? ` — ${p.price}` : ''}${p.description ? `: ${p.description}` : ''}`)
            .join('\n'),
      );
    }
    return parts.join('\n\n');
  }
}
