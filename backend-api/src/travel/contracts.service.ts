import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Contract, GenericInvoice } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DomainAppInvoicesService } from '../domainapp/invoices.service';
import { CreateContractDto, UpdateContractDto, ContractAssignmentDto } from './dto/contract.dto';

const toDate = (v?: string): Date | undefined => (v ? new Date(v) : undefined);
const period = (d = new Date()): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoices: DomainAppInvoicesService,
  ) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────
  listContracts(vendorId: string) {
    return this.prisma.contract.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
      include: {
        contact: { select: { id: true, name: true } },
        assignments: { include: { vehicle: { select: { id: true, name: true } }, driver: { select: { id: true, name: true } } } },
      },
    });
  }

  async createContract(vendorId: string, dto: CreateContractDto): Promise<Contract> {
    await this.assertContactOwned(vendorId, dto.contactId);
    await this.assertAssignmentsOwned(vendorId, dto.assignments);
    const { startDate, endDate, assignments, ...rest } = dto;
    return this.prisma.contract.create({
      data: {
        vendorId,
        ...rest,
        startDate: toDate(startDate)!,
        endDate: toDate(endDate),
        assignments: assignments?.length
          ? { create: assignments.map((a) => ({ vehicleId: a.vehicleId || null, driverId: a.driverId || null, routeLabel: a.routeLabel })) }
          : undefined,
      },
      include: { assignments: true },
    });
  }

  async updateContract(vendorId: string, id: string, dto: UpdateContractDto): Promise<Contract> {
    await this.ownContract(vendorId, id);
    if (dto.contactId) await this.assertContactOwned(vendorId, dto.contactId);
    await this.assertAssignmentsOwned(vendorId, dto.assignments);
    const { startDate, endDate, assignments, ...rest } = dto;
    return this.prisma.$transaction(async (tx) => {
      // Assignments (if provided) are replaced wholesale.
      if (assignments !== undefined) {
        await tx.contractAssignment.deleteMany({ where: { contractId: id } });
        if (assignments.length) {
          await tx.contractAssignment.createMany({
            data: assignments.map((a) => ({ contractId: id, vehicleId: a.vehicleId || null, driverId: a.driverId || null, routeLabel: a.routeLabel })),
          });
        }
      }
      return tx.contract.update({
        where: { id },
        data: {
          ...rest,
          ...(startDate !== undefined ? { startDate: toDate(startDate) } : {}),
          ...(endDate !== undefined ? { endDate: toDate(endDate) } : {}),
        },
        include: { assignments: true },
      });
    });
  }

  async deleteContract(vendorId: string, id: string): Promise<Contract> {
    await this.ownContract(vendorId, id);
    return this.prisma.contract.delete({ where: { id } }); // cascade removes assignments
  }

  // ── Billing ───────────────────────────────────────────────────────────────
  /** Rows not yet billed for `p` — includes never-billed (null) rows. */
  private notBilled(p: string) {
    return { OR: [{ lastBilledPeriod: null }, { lastBilledPeriod: { not: p } }] };
  }

  /** Bill one contract for a period, idempotently. Claims the period atomically
   *  before creating the invoice; returns null if it was already billed. */
  private async billContract(c: Contract, p: string): Promise<GenericInvoice | null> {
    const claim = await this.prisma.contract.updateMany({
      where: { id: c.id, ...this.notBilled(p) },
      data: { lastBilledPeriod: p },
    });
    if (claim.count === 0) return null; // already billed this period (idempotent)
    try {
      return await this.invoices.create(c.vendorId, {
        contactId: c.contactId,
        items: [{ description: `${c.title} — ${p}`, quantity: 1, rate: c.monthlyRate }],
        gstRate: c.gstRate,
      });
    } catch (err) {
      // Release the claim so a later run can retry this period.
      await this.prisma.contract.updateMany({ where: { id: c.id, lastBilledPeriod: p }, data: { lastBilledPeriod: c.lastBilledPeriod } });
      this.logger.error(`Contract ${c.id} billing failed for ${p}: ${err instanceof Error ? err.message : 'error'}`);
      throw err;
    }
  }

  /**
   * Manual "Generate this month's invoices" (per vendor) — catch-up path: bills
   * every active, in-window contract not yet billed this month, ignoring the
   * billing day. Same idempotency guard, so clicking twice never double-bills.
   */
  async generateThisMonth(vendorId: string): Promise<{ generated: number; alreadyBilled: number }> {
    const p = period();
    const now = new Date();
    const candidates = await this.prisma.contract.findMany({
      where: {
        vendorId, status: 'active',
        startDate: { lte: now },
        AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }, this.notBilled(p)],
      },
    });
    let generated = 0;
    for (const c of candidates) {
      try { if (await this.billContract(c, p)) generated += 1; } catch { /* logged; continue */ }
    }
    return { generated, alreadyBilled: candidates.length - generated };
  }

  /**
   * Daily cron: bill active contracts whose billing day is today and that haven't
   * been billed this month yet. Idempotent, so a missed day is caught up by the
   * manual button. Runs across all vendors.
   */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async runDailyBilling(): Promise<void> {
    const now = new Date();
    const p = period(now);
    const due = await this.prisma.contract.findMany({
      where: {
        status: 'active',
        billingDayOfMonth: now.getDate(),
        startDate: { lte: now },
        AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }, this.notBilled(p)],
      },
    });
    if (due.length === 0) return;
    this.logger.log(`Contract billing: ${due.length} contract(s) due on ${p}`);
    for (const c of due) {
      try { await this.billContract(c, p); } catch { /* logged in billContract */ }
    }
  }

  // ── Ownership guards ──────────────────────────────────────────────────────
  private async ownContract(vendorId: string, id: string): Promise<void> {
    const row = await this.prisma.contract.findFirst({ where: { id, vendorId }, select: { id: true } });
    if (!row) throw new NotFoundException('Contract not found');
  }
  private async assertContactOwned(vendorId: string, contactId: string): Promise<void> {
    const row = await this.prisma.contact.findFirst({ where: { id: contactId, vendorId }, select: { id: true } });
    if (!row) throw new BadRequestException('Client contact not found');
  }
  private async assertAssignmentsOwned(vendorId: string, assignments?: ContractAssignmentDto[]): Promise<void> {
    for (const a of assignments ?? []) {
      if (a.vehicleId) {
        const v = await this.prisma.vehicle.findFirst({ where: { id: a.vehicleId, vendorId }, select: { id: true } });
        if (!v) throw new BadRequestException('Assigned vehicle not found');
      }
      if (a.driverId) {
        const d = await this.prisma.driver.findFirst({ where: { id: a.driverId, vendorId }, select: { id: true } });
        if (!d) throw new BadRequestException('Assigned driver not found');
      }
    }
  }
}
