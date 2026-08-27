import { Injectable, NotFoundException } from '@nestjs/common';
import { FinanceCase, FinanceCaseDocument } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCaseDto, UpdateCaseDto,
  CreateCaseDocumentDto, UpdateCaseDocumentDto,
} from './dto/finance.dto';

export interface FinanceSummary {
  openCases: number;
  feeValue: number;
  deadlinesSoon: number;   // filing deadlines within 30 days on non-closed cases
  pendingDocs: number;
  byType: { type: string; count: number; value: number }[];
}

/** Real per-case-type document checklists a CA / consultant would collect. */
const DEFAULT_CHECKLISTS: Record<string, string[]> = {
  ITR: ['Form 16', 'PAN card', 'Bank statements', 'Investment proofs', 'Aadhaar'],
  GST: ['GSTIN certificate', 'Sales invoices', 'Purchase invoices', 'Bank statement'],
  Audit: ['Ledgers', 'Balance sheet', 'Profit & loss statement', 'Bank statements', 'Previous audit report'],
  Loan: ['Income proof', 'KYC documents', 'Bank statements (6m)', 'Property papers'],
  Insurance: ['Policy document', 'Claim form', 'ID proof', 'Supporting bills'],
  Other: ['Signed engagement', 'KYC documents'],
};

const OPEN = ['open', 'in_review', 'filed'];

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Cases ──
  listCases(vendorId: string): Promise<FinanceCase[]> {
    return this.prisma.financeCase.findMany({
      where: { vendorId },
      orderBy: [{ filingDeadline: 'asc' }, { createdAt: 'desc' }],
      include: { documents: { orderBy: { createdAt: 'asc' } } },
    });
  }
  getCase(vendorId: string, id: string): Promise<FinanceCase> {
    return this.ownCase(vendorId, id, true);
  }
  createCase(vendorId: string, dto: CreateCaseDto): Promise<FinanceCase> {
    const { filingDeadline, seedChecklist, ...rest } = dto;
    const type = rest.caseType ?? 'ITR';
    const checklist = seedChecklist === false ? [] : (DEFAULT_CHECKLISTS[type] ?? []);
    return this.prisma.financeCase.create({
      data: {
        vendorId, ...rest,
        filingDeadline: filingDeadline ? new Date(filingDeadline) : undefined,
        documents: { create: checklist.map((name) => ({ vendorId, name, required: true, status: 'pending' })) },
      },
      include: { documents: { orderBy: { createdAt: 'asc' } } },
    });
  }
  async updateCase(vendorId: string, id: string, dto: UpdateCaseDto): Promise<FinanceCase> {
    await this.ownCase(vendorId, id);
    const { filingDeadline, seedChecklist: _s, ...rest } = dto;
    return this.prisma.financeCase.update({
      where: { id },
      data: { ...rest, ...(filingDeadline !== undefined ? { filingDeadline: filingDeadline ? new Date(filingDeadline) : null } : {}) },
      include: { documents: { orderBy: { createdAt: 'asc' } } },
    });
  }
  async deleteCase(vendorId: string, id: string): Promise<FinanceCase> {
    await this.ownCase(vendorId, id);
    return this.prisma.financeCase.delete({ where: { id } });
  }

  // ── Documents ──
  listDocuments(vendorId: string): Promise<FinanceCaseDocument[]> {
    return this.prisma.financeCaseDocument.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
      include: { case: { select: { id: true, title: true, clientName: true, caseType: true } } },
    });
  }
  async addDocument(vendorId: string, caseId: string, dto: CreateCaseDocumentDto): Promise<FinanceCaseDocument> {
    await this.ownCase(vendorId, caseId);
    return this.prisma.financeCaseDocument.create({ data: { vendorId, caseId, ...dto } });
  }
  async updateDocument(vendorId: string, id: string, dto: UpdateCaseDocumentDto): Promise<FinanceCaseDocument> {
    await this.ownDocument(vendorId, id);
    const receivedAt = dto.status === 'received' ? new Date() : dto.status && dto.status !== 'received' ? null : undefined;
    return this.prisma.financeCaseDocument.update({
      where: { id },
      data: { ...dto, ...(receivedAt !== undefined ? { receivedAt } : {}) },
    });
  }
  async deleteDocument(vendorId: string, id: string): Promise<FinanceCaseDocument> {
    await this.ownDocument(vendorId, id);
    return this.prisma.financeCaseDocument.delete({ where: { id } });
  }

  /** Accounts depth: open cases, fees, deadlines approaching, docs outstanding, by type. */
  async summary(vendorId: string): Promise<FinanceSummary> {
    const soon = new Date(); soon.setDate(soon.getDate() + 30);
    const [cases, deadlinesSoon, pendingDocs] = await Promise.all([
      this.prisma.financeCase.findMany({ where: { vendorId }, select: { status: true, caseType: true, feeValue: true } }),
      this.prisma.financeCase.count({ where: { vendorId, status: { in: OPEN }, filingDeadline: { not: null, lte: soon } } }),
      this.prisma.financeCaseDocument.count({ where: { vendorId, status: 'pending', required: true } }),
    ]);
    const open = cases.filter((c) => OPEN.includes(c.status));
    const feeValue = open.reduce((s, c) => s + c.feeValue, 0);
    const map = new Map<string, { count: number; value: number }>();
    for (const c of open) {
      const cur = map.get(c.caseType) ?? { count: 0, value: 0 };
      cur.count += 1; cur.value += c.feeValue;
      map.set(c.caseType, cur);
    }
    const byType = [...map.entries()].map(([type, v]) => ({ type, ...v }));
    return { openCases: open.length, feeValue, deadlinesSoon, pendingDocs, byType };
  }

  // ── Guards ──
  private async ownCase(vendorId: string, id: string, withDocs = false): Promise<FinanceCase> {
    const row = await this.prisma.financeCase.findFirst({
      where: { id, vendorId },
      ...(withDocs ? { include: { documents: { orderBy: { createdAt: 'asc' } } } } : {}),
    });
    if (!row) throw new NotFoundException('Case not found');
    return row;
  }
  private async ownDocument(vendorId: string, id: string): Promise<void> {
    const row = await this.prisma.financeCaseDocument.findFirst({ where: { id, vendorId }, select: { id: true } });
    if (!row) throw new NotFoundException('Document not found');
  }
}
