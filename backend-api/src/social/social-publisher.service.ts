import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma, SocialAccount, SocialPost } from '@prisma/client';
import { LeadspaceSettingsService } from '../leadspace/settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { SocialAccountsService } from './social-accounts.service';
import {
  FacebookPageProvider, GoogleBusinessProvider, InstagramProvider, PublishError, SandboxSocialProvider, SocialChannel, SocialProvider, TelegramProvider,
} from './social-provider';

/** Minutes to wait before the next try, by attempt number. After the last one the post is marked FAILED and shown in the log with the reason. */
export const RETRY_MINUTES = [5, 15, 60, 240];
const MAX_ATTEMPTS = RETRY_MINUTES.length + 1;
const IST_MS = 5.5 * 3_600_000;

/** Start of the Indian day containing `t`, as an instant. */
export const istDayStart = (t: Date): Date => new Date(Math.floor((t.getTime() + IST_MS) / 86_400_000) * 86_400_000 - IST_MS);

export interface ScheduleInput { accountId: string; kind?: 'TEXT' | 'IMAGE' | 'LINK'; content: string; imageUrl?: string | null; linkUrl?: string | null; scheduledFor?: Date; idempotencyKey: string; createdBy?: string }
export interface RunSummary { picked: number; posted: number; failed: number; retried: number; deferred: number; skipped: number }

/**
 * The shared social publisher (Dispatch A section 6, built here because it did not exist): one place that schedules a post for one account, posts it
 * through that channel's provider, retries what can be retried, keeps a log, enforces daily caps per account, and stops everything when the global
 * kill switch is on. A SANDBOX account (the default) posts to an in-memory provider, so nothing leaves the machine until KSM connects the real account.
 */
@Injectable()
export class SocialPublisherService {
  private readonly logger = new Logger(SocialPublisherService.name);
  private readonly overrides = new Map<string, SocialProvider>();
  private readonly sandboxes = new Map<string, SandboxSocialProvider>();

  constructor(private readonly prisma: PrismaService, private readonly accounts: SocialAccountsService, private readonly settings: LeadspaceSettingsService) {}

  /** A test (or a future vendor-specific client) replaces the live provider for a channel. */
  setProvider(channel: SocialChannel, p: SocialProvider): void { this.overrides.set(channel, p); }

  sandboxFor(channel: SocialChannel): SandboxSocialProvider {
    let s = this.sandboxes.get(channel);
    if (!s) { s = new SandboxSocialProvider(channel); this.sandboxes.set(channel, s); }
    return s;
  }

  providerFor(account: SocialAccount): SocialProvider {
    if (account.status === 'SANDBOX') return this.sandboxFor(account.channel as SocialChannel);
    const o = this.overrides.get(account.channel);
    if (o) return o;
    switch (account.channel as SocialChannel) {
      case 'FACEBOOK_PAGE': return new FacebookPageProvider();
      case 'INSTAGRAM': return new InstagramProvider();
      case 'TELEGRAM': return new TelegramProvider();
      case 'GOOGLE_BUSINESS': return new GoogleBusinessProvider();
    }
  }

  async testConnection(accountId: string): Promise<{ ok: boolean; message: string }> {
    const a = await this.accounts.get(accountId);
    const r = await this.providerFor(a).test({ externalId: a.externalId, token: this.accounts.token(a), name: a.name });
    if (a.status !== 'SANDBOX') await this.accounts.setStatus(a.id, r.ok ? 'CONNECTED' : 'AWAITING_APPROVAL', r.ok ? null : r.message);
    return r;
  }

  async schedule(i: ScheduleInput): Promise<SocialPost> {
    const seen = await this.prisma.socialPost.findUnique({ where: { idempotencyKey: i.idempotencyKey } });
    if (seen) return seen;
    const a = await this.accounts.get(i.accountId);
    if (a.status === 'DISCONNECTED') throw new BadRequestException('This account is disconnected. Connect it again before scheduling posts.');
    const kind = i.kind ?? (i.imageUrl ? 'IMAGE' : i.linkUrl ? 'LINK' : 'TEXT');
    if (a.channel === 'INSTAGRAM' && !i.imageUrl) throw new BadRequestException('Instagram posts need a picture.');
    if (!i.content.trim()) throw new BadRequestException('The post has no text.');
    return this.prisma.socialPost.create({ data: { accountId: a.id, kind, content: i.content.slice(0, 4900), imageUrl: i.imageUrl ?? null, linkUrl: i.linkUrl ?? null, scheduledFor: i.scheduledFor ?? new Date(), idempotencyKey: i.idempotencyKey, createdBy: i.createdBy ?? null } });
  }

  async cancel(postId: string): Promise<SocialPost> {
    const r = await this.prisma.socialPost.updateMany({ where: { id: postId, status: 'SCHEDULED' }, data: { status: 'CANCELLED' } });
    if (r.count !== 1) throw new BadRequestException('Only a post that has not been sent yet can be cancelled.');
    return this.prisma.socialPost.findUniqueOrThrow({ where: { id: postId } });
  }

  /** Cancel every post still waiting for an account's vendor (used by the per-vendor kill switch). */
  async cancelWhere(where: Prisma.SocialPostWhereInput): Promise<number> {
    const r = await this.prisma.socialPost.updateMany({ where: { ...where, status: 'SCHEDULED' }, data: { status: 'CANCELLED', error: 'Stopped by a kill switch' } });
    return r.count;
  }

  private async postedToday(accountId: string, now: Date): Promise<number> {
    const startMs = istDayStart(now).getTime();
    return this.prisma.socialPost.count({ where: { accountId, status: 'POSTED', results: { path: ['postedAtMs'], gte: startMs } } });
  }

  /** Post what is due. Safe to call at any time and from more than one place: each post is claimed with one conditional update. */
  async runDue(now = new Date(), limit = 20): Promise<RunSummary> {
    const sum: RunSummary = { picked: 0, posted: 0, failed: 0, retried: 0, deferred: 0, skipped: 0 };
    const s = await this.settings.get();
    if (s.globalKillSwitch) return sum;
    // A post claimed by a run that died before it finished (a restart) goes back in the queue after ten minutes.
    await this.prisma.socialPost.updateMany({ where: { status: 'POSTING', updatedAt: { lte: new Date(now.getTime() - 10 * 60_000) } }, data: { status: 'SCHEDULED', error: 'Retrying after an interrupted run' } });
    const due = await this.prisma.socialPost.findMany({
      where: { status: 'SCHEDULED', scheduledFor: { lte: now }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
      orderBy: { scheduledFor: 'asc' }, take: limit,
    });
    for (const post of due) {
      const claim = await this.prisma.socialPost.updateMany({ where: { id: post.id, status: 'SCHEDULED' }, data: { status: 'POSTING', attempts: { increment: 1 } } });
      if (claim.count !== 1) { sum.skipped++; continue; }
      sum.picked++;
      const attempt = post.attempts + 1;
      const account = await this.prisma.socialAccount.findUnique({ where: { id: post.accountId } });
      if (!account || account.status === 'DISCONNECTED') {
        await this.prisma.socialPost.update({ where: { id: post.id }, data: { status: 'FAILED', error: 'The account is not connected.' } });
        sum.failed++; continue;
      }
      const cap = Math.min(account.dailyCap, s.channelDailyCaps[account.channel] ?? account.dailyCap);
      if ((await this.postedToday(account.id, now)) >= cap) {
        const next = new Date(istDayStart(now).getTime() + 86_400_000 + 3.5 * 3_600_000); // 9:00 IST tomorrow
        await this.prisma.socialPost.update({ where: { id: post.id }, data: { status: 'SCHEDULED', attempts: post.attempts, nextAttemptAt: next, error: `Daily limit of ${cap} reached for this account. Will post tomorrow.` } });
        sum.deferred++; continue;
      }
      try {
        const out = await this.providerFor(account).publish({ externalId: account.externalId, token: this.accounts.token(account), name: account.name }, { kind: post.kind as 'TEXT' | 'IMAGE' | 'LINK', content: post.content, imageUrl: post.imageUrl, linkUrl: post.linkUrl });
        await this.prisma.socialPost.update({ where: { id: post.id }, data: { status: 'POSTED', providerPostId: out.providerPostId, postUrl: out.postUrl, error: null, nextAttemptAt: null, results: { postedAtMs: now.getTime() } } });
        await this.prisma.socialAccount.update({ where: { id: account.id }, data: { lastSyncAt: now, lastError: null } });
        sum.posted++;
      } catch (e) {
        const err = e instanceof PublishError ? e : new PublishError(e instanceof Error ? e.message : 'The post could not be sent.', true);
        const retry = err.retryable && attempt < MAX_ATTEMPTS;
        await this.prisma.socialPost.update({
          where: { id: post.id },
          data: retry
            ? { status: 'SCHEDULED', error: err.message, nextAttemptAt: new Date(now.getTime() + RETRY_MINUTES[attempt - 1] * 60_000) }
            : { status: 'FAILED', error: err.message, nextAttemptAt: null },
        });
        await this.prisma.socialAccount.update({ where: { id: account.id }, data: { lastError: err.message } }).catch(() => undefined);
        if (retry) sum.retried++; else sum.failed++;
        this.logger.warn(`Post ${post.id} ${retry ? 'will be retried' : 'failed'}: ${err.message}`);
      }
    }
    return sum;
  }

  /** Results (impressions, clicks) for posts from the last week, where the network lets us read them. */
  async pullResults(now = new Date()): Promise<number> {
    const since = new Date(now.getTime() - 7 * 86_400_000);
    const posts = await this.prisma.socialPost.findMany({ where: { status: 'POSTED', providerPostId: { not: null }, updatedAt: { gte: since } }, take: 100 });
    let n = 0;
    for (const p of posts) {
      const a = await this.prisma.socialAccount.findUnique({ where: { id: p.accountId } });
      if (!a || a.status === 'DISCONNECTED') continue;
      try {
        const r = await this.providerFor(a).results({ externalId: a.externalId, token: this.accounts.token(a), name: a.name }, p.providerPostId as string);
        if (r) {
          const prev = (p.results && typeof p.results === 'object' ? p.results : {}) as Record<string, unknown>;
          await this.prisma.socialPost.update({ where: { id: p.id }, data: { results: { ...prev, ...r, pulledAtMs: now.getTime() } as Prisma.InputJsonValue } });
          n++;
        }
      } catch { /* results are best effort */ }
    }
    return n;
  }

  log(filter: { accountId?: string; status?: string; take?: number } = {}): Promise<SocialPost[]> {
    return this.prisma.socialPost.findMany({ where: { ...(filter.accountId ? { accountId: filter.accountId } : {}), ...(filter.status ? { status: filter.status } : {}) }, orderBy: { scheduledFor: 'desc' }, take: Math.min(filter.take ?? 100, 300) });
  }

  @Cron('*/2 * * * *')
  async tick(): Promise<void> {
    if (process.env.LEADSPACE_SCHEDULER === 'off' || process.env.NODE_ENV === 'test') return;
    try { await this.runDue(); } catch (e) { this.logger.warn(`Publisher run failed: ${e instanceof Error ? e.message : 'unknown'}`); }
  }

  @Cron('17 * * * *')
  async hourly(): Promise<void> {
    if (process.env.LEADSPACE_SCHEDULER === 'off' || process.env.NODE_ENV === 'test') return;
    try { await this.pullResults(); } catch (e) { this.logger.warn(`Results pull failed: ${e instanceof Error ? e.message : 'unknown'}`); }
  }
}
