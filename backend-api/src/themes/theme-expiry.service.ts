import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SiteRefreshService } from '../site-doc/site-refresh.service';

const DAY = 86_400_000;
export const REMINDER_DAYS = [30, 7, 1] as const;

/**
 * Yearly licences end. 30, 7 and 1 days before, the vendor gets a reminder through the platform's own notifications (each one once). When the year ends the licence is
 * marked EXPIRED and the site's cached pages are refreshed; from that next render the site shows the category's default free design (see ThemeCatalogService.resolve).
 * Nothing the vendor wrote is touched, and a renewal restores the theme. Runs daily at 06:30 IST; a second API instance, or a manual run, is a harmless no-op.
 */
@Injectable()
export class ThemeExpiryService {
  private readonly log = new Logger(ThemeExpiryService.name);
  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationsService, private readonly refresh: SiteRefreshService) {}

  @Cron('30 6 * * *', { timeZone: 'Asia/Kolkata' })
  async scheduled(): Promise<void> {
    try { const s = await this.runOnce(new Date()); this.log.log(`Theme licence run: ${JSON.stringify(s)}`); }
    catch (e) { this.log.error(`Theme licence run failed: ${e instanceof Error ? e.message : 'error'}`); }
  }

  async runOnce(now: Date): Promise<{ ran: boolean; expired: number; reminders: number }> {
    const out = { ran: false, expired: 0, reminders: 0 };
    const touched = new Set<string>();
    // messages are sent after the lock is released (the notice is a separate write); what was already marked as sent is never sent again
    const outbox: { vendorId: string; type: string; title: string; message: string; opts?: Parameters<NotificationsService['notifyVendor']>[4] }[] = [];
    // the lock lives for this transaction (the same pattern as the renewal engine), so a second instance or a manual run is a no-op
    await this.prisma.$transaction(async (tx) => {
      const got = await tx.$queryRawUnsafe<{ ok: boolean }[]>('SELECT pg_try_advisory_xact_lock(hashtext($1)) AS ok', 'theme-licence-run');
      if (!got?.[0]?.ok) return;
      out.ran = true;
      const nameOf = async (key: string): Promise<string> => (await tx.themePackage.findFirst({ where: { key }, orderBy: { version: 'desc' }, select: { name: true } }))?.name ?? key;
      // 1. the year ended
      const ended = await tx.themeEntitlement.findMany({ where: { status: 'ACTIVE', endsAt: { lte: now } } });
      for (const e of ended) {
        await tx.themeEntitlement.update({ where: { id: e.id }, data: { status: 'EXPIRED' } });
        out.expired += 1;
        const still = await tx.themeEntitlement.count({ where: { vendorId: e.vendorId, themeKey: e.themeKey, status: 'ACTIVE', endsAt: { gt: now } } });
        if (still > 0) continue;
        const name = await nameOf(e.themeKey);
        outbox.push({ vendorId: e.vendorId, type: 'theme_expired', title: 'Your website theme has ended', message: `Your yearly licence for "${name}" has ended. Your site now shows the standard design for your category. Nothing you wrote was changed. Renew the theme in Website Manager, Template, to bring it back.`, opts: { priority: 'WARNING', actionRequired: true, actionType: 'RENEW_THEME', actionData: { themeKey: e.themeKey } } });
        touched.add(e.vendorId);
      }
      // 2. reminders at 30, 7 and 1 days: the smallest threshold reached is sent once; larger ones already passed are marked as skipped, so nobody gets three messages at once
      const live = await tx.themeEntitlement.findMany({ where: { status: 'ACTIVE', endsAt: { gt: now } } });
      for (const e of live) {
        const daysLeft = Math.ceil((e.endsAt.getTime() - now.getTime()) / DAY);
        const sent = { ...((e.remindersSent as Record<string, string> | null) ?? {}) };
        const due = REMINDER_DAYS.filter((d) => daysLeft <= d && !sent[String(d)]);
        if (!due.length) continue;
        const send = Math.min(...due);
        for (const d of due) sent[String(d)] = now.toISOString();
        await tx.themeEntitlement.update({ where: { id: e.id }, data: { remindersSent: sent } });
        const name = await nameOf(e.themeKey);
        outbox.push({ vendorId: e.vendorId, type: 'theme_expiring', title: `Your theme ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`, message: `Your yearly licence for "${name}" ends on ${e.endsAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}. Renew it in Website Manager, Template, to keep the design. If it ends, your site shows the standard design for your category and nothing you wrote is lost.`, opts: { priority: send === 1 ? 'WARNING' : 'INFO', actionRequired: true, actionType: 'RENEW_THEME', actionData: { themeKey: e.themeKey, daysLeft } } });
        out.reminders += 1;
      }
    }, { timeout: 120_000, maxWait: 10_000 });
    for (const m of outbox) { try { await this.notifications.notifyVendor(m.vendorId, m.type, m.title, m.message, m.opts); } catch (e) { this.log.warn(`Theme notice to ${m.vendorId} failed: ${e instanceof Error ? e.message : 'error'}`); } }
    for (const vid of touched) { const v = await this.prisma.vendor.findUnique({ where: { id: vid }, select: { subdomain: true } }); await this.refresh.refresh(v?.subdomain ?? null); }
    return out;
  }
}
