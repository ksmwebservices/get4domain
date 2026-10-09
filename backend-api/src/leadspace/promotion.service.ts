import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LeadspaceProfile, PostJob, Prisma, PromotionPlan, SocialAccount } from '@prisma/client';
import { AiService } from '../ai/ai.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SocialAccountsService } from '../social/social-accounts.service';
import { istDayStart, SocialPublisherService } from '../social/social-publisher.service';
import { promotionGate } from './abuse';
import { clean } from './goals';
import { checkCopy, guardrailPrompt } from './guardrails';
import { categoryOf, slugify } from './leadspace.types';
import { pageUrl } from './page-builder';
import { cleanServices } from './profile.service';
import { LeadspaceSettingsService } from './settings.service';
import { templateFor } from './templates';

export const PROMO_CHANNELS = ['FACEBOOK_PAGE', 'INSTAGRAM', 'TELEGRAM', 'GOOGLE_BUSINESS', 'FACEBOOK_GROUPS'] as const;
export type PromoChannel = (typeof PROMO_CHANNELS)[number];

export interface JobContent { caption: string; hashtags: string[]; imagePrompt?: string; source: 'template' | 'ai'; guided?: string }
export type AiWriter = (profile: LeadspaceProfile, angle: string, base: string, guardrails: string) => Promise<string | null>;

const ANGLES = ['intro', 'service', 'offer', 'trust', 'question', 'local'] as const;
const HOURS_IST: Record<string, number> = { FACEBOOK_PAGE: 11, INSTAGRAM: 18, TELEGRAM: 9, GOOGLE_BUSINESS: 10, FACEBOOK_GROUPS: 12 };
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Pure: which connected Get4Domain account should carry a vendor's post. Same city and trade first, then the city, then the trade, then any open account for the channel. */
export function pickAccount(accounts: SocialAccount[], channel: string, city: string, category: string): SocialAccount | null {
  const live = accounts.filter((a) => a.ownerType === 'PLATFORM' && a.channel === channel && a.status !== 'DISCONNECTED');
  const eq = (x: string | null, y: string): boolean => (x ?? '').toLowerCase() === y.toLowerCase();
  return live.find((a) => eq(a.city, city) && eq(a.category, category))
    ?? live.find((a) => eq(a.city, city) && !a.category) ?? live.find((a) => eq(a.category, category) && !a.city)
    ?? live.find((a) => !a.city && !a.category) ?? null;
}

/** Pure: the post text for one angle. Prices and offers come only from the page; a real-estate post always ends with the RERA line. */
export function buildCopy(p: Pick<LeadspaceProfile, 'businessName' | 'city' | 'category' | 'tagline' | 'services' | 'offer' | 'reraNumber' | 'slug'>, angle: string, channel: string, index: number, offerText?: string | null): JobContent {
  const t = templateFor(p.category);
  const services = cleanServices(p.services);
  const svc = services.length ? services[index % services.length] : null;
  const price = svc && typeof svc.price === 'number' && svc.price > 0 ? ` from Rs ${svc.price.toLocaleString('en-IN')}` : '';
  const offer = obj(p.offer);
  const offerLine = offerText?.trim() || [offer.headline, offer.text].filter(Boolean).join(': ');
  const trust = t.trust[index % t.trust.length];
  const label = categoryOf(p.category)?.label ?? 'local business';
  const link = `${pageUrl(p.slug)}?utm_source=${channel.toLowerCase()}&utm_medium=social&utm_campaign=${slugify(p.city)}-${p.category}`;
  const lines: Record<string, string> = {
    intro: `${p.businessName} serves ${p.city}. ${p.tagline ?? t.subline.replace('{business}', p.businessName).replace('{city}', p.city)}`,
    service: svc ? `${svc.name}${price} at ${p.businessName}, ${p.city}.${svc.description ? ` ${svc.description}` : ''}` : `${label} in ${p.city}: ${p.businessName}.`,
    offer: offerLine ? `${offerLine} (${p.businessName}, ${p.city})` : `Looking for ${label.toLowerCase()} in ${p.city}? ${p.businessName} is ready to help.`,
    trust: `${trust}. That is how ${p.businessName} works in ${p.city}.`,
    question: `${t.faqs[index % t.faqs.length].q.replace('{city}', p.city)} ${t.faqs[index % t.faqs.length].a.replace('{city}', p.city).replace('{business}', p.businessName)}`,
    local: `${p.city} neighbours: ${p.businessName} takes your request in a minute, no sign-up.`,
  };
  const body = lines[angle] ?? lines.intro;
  const rera = categoryOf(p.category)?.regulated === 'realEstate' && p.reraNumber ? `\nRERA: ${p.reraNumber}` : '';
  const cta = channel === 'TELEGRAM' || channel === 'FACEBOOK_PAGE' || channel === 'GOOGLE_BUSINESS' ? `\n${t.cta[(categoryOf(p.category)?.goal ?? 'ENQUIRY')]}: ${link}` : `\nLink in bio. ${t.cta[(categoryOf(p.category)?.goal ?? 'ENQUIRY')]}.`;
  const tags = [slugify(p.city).replace(/-/g, ''), ...(t.keywords[0] ? [t.keywords[0].replace(/\s+/g, '')] : []), 'local'].slice(0, 3);
  return { caption: `${body}${cta}${rera}`.slice(0, 1800), hashtags: tags, source: 'template' };
}

/**
 * Promotion: Get4Domain promotes a verified vendor on its own themed Pages and channels, never on the vendor's behalf without the switches being on.
 *   - the vendor switch (page.promotionEnabled) and the plan; the trade rules (promotionGate); a per-vendor kill switch; a global kill switch;
 *   - a monthly calendar, written to the AI Studio guardrails (and by template when no AI is configured);
 *   - an approval queue: posts of a new vendor need an admin's approval for the first weeks, then auto-approve if the admin allows it;
 *   - a manual task list for places with no API (Facebook Groups) and for Google Business Profile until the vendor grants access.
 */
@Injectable()
export class PromotionService {
  private readonly logger = new Logger(PromotionService.name);
  private aiWriter: AiWriter | null = null;

  constructor(
    private readonly prisma: PrismaService, private readonly publisher: SocialPublisherService, private readonly accounts: SocialAccountsService,
    private readonly settings: LeadspaceSettingsService, private readonly notifications: NotificationsService, @Optional() private readonly ai?: AiService,
  ) {}

  /** Tests (and a future provider) supply their own writer. */
  setAiWriter(w: AiWriter | null): void { this.aiWriter = w; }

  private async write(p: LeadspaceProfile, angle: string, base: string): Promise<string | null> {
    if (this.aiWriter) return this.aiWriter(p, angle, base, guardrailPrompt(p.category));
    if (!this.ai || !(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY)) return null;
    try {
      const r = await this.ai.generateContent(p.vendorId, {
        channel: 'social_post', vendorIndustry: p.category, skipImage: true,
        offerDetails: `Rewrite this post in a warm, plain voice, keep every fact and link, add nothing new. Keep it under 600 characters.\nPost:\n${base}\nRules:\n${guardrailPrompt(p.category)}`,
        tone: 'friendly and honest',
      }, true);
      return r.caption || null;
    } catch { return null; }
  }

  async plan(vendorId: string): Promise<PromotionPlan> {
    return this.prisma.promotionPlan.upsert({ where: { vendorId }, create: { vendorId, channels: ['FACEBOOK_PAGE', 'TELEGRAM'], schedule: { perWeek: 2 } }, update: {} });
  }

  private async profile(vendorId: string): Promise<LeadspaceProfile> {
    const p = await this.prisma.leadspaceProfile.findUnique({ where: { vendorId } });
    if (!p) throw new NotFoundException('Create your page first.');
    return p;
  }

  async setPlan(vendorId: string, input: { on?: boolean; channels?: string[]; perWeek?: number; offer?: string }): Promise<PromotionPlan> {
    const profile = await this.profile(vendorId);
    const plan = await this.plan(vendorId);
    const data: Prisma.PromotionPlanUpdateInput = {};
    if (input.channels) {
      const ch = [...new Set(input.channels.filter((c): c is PromoChannel => (PROMO_CHANNELS as readonly string[]).includes(c)))];
      if (!ch.length) throw new BadRequestException('Choose at least one place to promote you.');
      data.channels = ch;
    }
    if (input.perWeek !== undefined) {
      if (!Number.isInteger(input.perWeek) || input.perWeek < 1 || input.perWeek > 7) throw new BadRequestException('Choose between 1 and 7 posts a week.');
      data.schedule = { ...obj(plan.schedule), perWeek: input.perWeek };
    }
    if (input.offer !== undefined) data.offer = clean(input.offer, 240) || null;
    if (input.on === true) {
      const g = promotionGate(profile);
      if (!g.ok) throw new BadRequestException(g.reason);
      if (plan.killSwitch) throw new ForbiddenException('Promotion for your page has been paused by our team. Contact support.');
      const s = await this.settings.get();
      data.status = 'ACTIVE';
      if (!plan.manualUntil) data.manualUntil = new Date(Date.now() + s.manualApprovalDays * 86_400_000);
      await this.prisma.leadspaceProfile.update({ where: { id: profile.id }, data: { promotionEnabled: true } });
    } else if (input.on === false) {
      data.status = 'PAUSED';
      await this.prisma.leadspaceProfile.update({ where: { id: profile.id }, data: { promotionEnabled: false } });
      await this.stopVendor(vendorId, 'Promotion switched off by the vendor');
    }
    return this.prisma.promotionPlan.update({ where: { vendorId }, data });
  }

  /** Cancel what is waiting, without deleting anything that was already posted. */
  private async stopVendor(vendorId: string, why: string): Promise<number> {
    const n = await this.publisher.cancelWhere({ createdBy: `promotion:${vendorId}` });
    await this.prisma.postJob.updateMany({ where: { vendorId, status: { in: ['DRAFT', 'AWAITING_APPROVAL', 'APPROVED', 'SCHEDULED'] }, manualDoneAt: null }, data: { status: 'SKIPPED', results: { skipped: why } as Prisma.InputJsonValue } });
    return n;
  }

  /** Admin: stop one vendor's promotion (and keep it stopped) or let it resume. */
  async setKill(vendorId: string, on: boolean, by: string): Promise<PromotionPlan> {
    await this.plan(vendorId);
    if (on) await this.stopVendor(vendorId, 'Stopped by a kill switch');
    await this.prisma.leadspaceProfile.updateMany({ where: { vendorId }, data: on ? { promotionEnabled: false } : {} });
    await this.prisma.commercialAuditLog.create({ data: { actor: by, actorRole: 'staff', action: on ? 'leadspace.promotion.kill' : 'leadspace.promotion.resume', entityType: 'Vendor', entityId: vendorId, detail: {} } });
    return this.prisma.promotionPlan.update({ where: { vendorId }, data: { killSwitch: on, ...(on ? { status: 'PAUSED' } : {}) } });
  }

  async setAutoApprove(vendorId: string, on: boolean): Promise<PromotionPlan> {
    await this.plan(vendorId);
    return this.prisma.promotionPlan.update({ where: { vendorId }, data: { autoApprove: on } });
  }

  // — the calendar —

  async generateCalendar(vendorId: string, opts: { days?: number; replace?: boolean; from?: Date } = {}, by = 'system'): Promise<{ created: number; manualTasks: number; needsApproval: number; skipped: string[] }> {
    const profile = await this.profile(vendorId);
    const plan = await this.plan(vendorId);
    const s = await this.settings.get();
    if (s.globalKillSwitch) throw new ForbiddenException('Promotion is paused for everyone right now.');
    if (plan.killSwitch) throw new ForbiddenException('Promotion for this page is paused.');
    if (plan.status !== 'ACTIVE') throw new BadRequestException('Switch promotion on first.');
    const gate = promotionGate(profile);
    if (!gate.ok) throw new BadRequestException(gate.reason);
    const days = Math.min(Math.max(opts.days ?? 30, 7), 31);
    const start = new Date(istDayStart(opts.from ?? new Date()).getTime() + 86_400_000); // from tomorrow
    const end = new Date(start.getTime() + days * 86_400_000);
    if (opts.replace) await this.prisma.postJob.updateMany({ where: { vendorId, scheduledFor: { gte: start }, status: { in: ['DRAFT', 'AWAITING_APPROVAL', 'APPROVED'] } }, data: { status: 'SKIPPED' } });
    const existing = await this.prisma.postJob.count({ where: { vendorId, scheduledFor: { gte: start, lt: end }, status: { notIn: ['SKIPPED', 'FAILED'] } } });
    if (existing > 0) throw new BadRequestException('This period already has posts. Ask for a fresh calendar to replace the ones not yet approved.');

    const channels = (plan.channels as string[]).filter((c) => (PROMO_CHANNELS as readonly string[]).includes(c));
    const perWeek = Number(obj(plan.schedule).perWeek ?? 2);
    const total = Math.max(1, Math.round((perWeek * days) / 7));
    const all = await this.prisma.socialAccount.findMany({ where: { ownerType: 'PLATFORM' } });
    const vendorAccounts = await this.prisma.socialAccount.findMany({ where: { ownerType: 'VENDOR', vendorId } });
    const prices = cleanServices(profile.services).map((x) => (typeof x.price === 'number' ? x.price : null)).filter((x): x is number => x !== null);
    const manualPhase = !plan.autoApprove || (plan.manualUntil !== null && plan.manualUntil > new Date());
    const out = { created: 0, manualTasks: 0, needsApproval: 0, skipped: [] as string[] };
    const rows: Prisma.PostJobCreateManyInput[] = [];

    for (let i = 0; i < total; i++) {
      const channel = channels[i % channels.length];
      const dayOffset = Math.floor((i * days) / total);
      const scheduledFor = new Date(start.getTime() + dayOffset * 86_400_000 + (HOURS_IST[channel] ?? 11) * 3_600_000);
      const angle = ANGLES[i % ANGLES.length];
      let content = buildCopy(profile, angle, channel, i, plan.offer);
      const rewritten = await this.write(profile, angle, content.caption);
      if (rewritten) {
        const rera = categoryOf(profile.category)?.regulated === 'realEstate' ? profile.reraNumber : null;
        const text = rera && !rewritten.includes(rera) ? `${rewritten}\nRERA: ${rera}` : rewritten;
        const v = checkCopy(text, profile.category, prices, { rera });
        if (v.ok && text.includes(pageUrl(profile.slug).split('?')[0])) content = { ...content, caption: text, source: 'ai' };
        else out.skipped.push(`AI text for post ${i + 1} was not used: ${v.ok ? 'it lost the page link' : v.reason}`);
      }
      const v = checkCopy(content.caption, profile.category, prices, { rera: categoryOf(profile.category)?.regulated === 'realEstate' ? profile.reraNumber : null });
      if (!v.ok) { out.skipped.push(`Post ${i + 1} was dropped: ${v.reason}`); continue; }

      let account: SocialAccount | null = null; let manual = false; let manualTarget: string | null = null; let jobChannel = channel;
      if (channel === 'FACEBOOK_GROUPS') { manual = true; manualTarget = 'Facebook Groups (no API: post by hand in groups that allow business posts)'; jobChannel = 'MANUAL'; }
      else if (channel === 'GOOGLE_BUSINESS') {
        account = vendorAccounts.find((a) => a.channel === 'GOOGLE_BUSINESS' && a.status === 'CONNECTED') ?? null;
        if (!account) { manual = true; manualTarget = 'Google Business Profile: the vendor has not granted access. Post from the Profile manager or ask the vendor to connect.'; jobChannel = 'MANUAL'; content = { ...content, guided: 'Open the business profile, choose Add update, paste the text, add the picture, publish.' }; }
      } else {
        account = pickAccount(all, channel, profile.city, profile.category);
        if (channel === 'INSTAGRAM' && !profile.heroImage) { out.skipped.push(`Post ${i + 1}: Instagram needs a picture. Add a banner to the page.`); continue; }
        if (!account) { manual = true; manualTarget = `${channel.replace('_', ' ')}: no Get4Domain page for ${profile.city} / ${categoryOf(profile.category)?.label ?? profile.category} is connected yet`; jobChannel = 'MANUAL'; }
      }
      if (manual) out.manualTasks++;
      rows.push({
        planId: plan.id, vendorId, channel: jobChannel, accountId: account?.id ?? null, scheduledFor, theme: account?.theme ?? `${profile.city} ${categoryOf(profile.category)?.label ?? ''} Deals`.trim(),
        content: content as unknown as Prisma.InputJsonValue, assetUrl: profile.heroImage, linkUrl: pageUrl(profile.slug), status: manualPhase ? 'AWAITING_APPROVAL' : 'APPROVED', manualTask: manual, manualTarget,
        approvalLog: [{ at: new Date().toISOString(), by, action: 'generated', note: content.source }] as unknown as Prisma.InputJsonValue,
      });
    }
    if (rows.length) await this.prisma.postJob.createMany({ data: rows });
    out.created = rows.length;
    out.needsApproval = manualPhase ? rows.length : 0;
    if (!manualPhase) await this.scheduleApproved(vendorId);
    if (manualPhase && rows.length) await this.notifications.notifyAdmin('leadspace_approval', 'Posts waiting for approval', `${profile.businessName} has ${rows.length} promotion post(s) to review.`, { actionType: 'view_leadspace_queue', actionData: { vendorId } }).catch(() => undefined);
    return out;
  }

  /** Approved, non-manual jobs become scheduled posts on the shared publisher. */
  async scheduleApproved(vendorId?: string): Promise<number> {
    const jobs = await this.prisma.postJob.findMany({ where: { status: 'APPROVED', manualTask: false, accountId: { not: null }, ...(vendorId ? { vendorId } : {}) }, take: 200 });
    let n = 0;
    for (const j of jobs) {
      const plan = await this.prisma.promotionPlan.findUnique({ where: { id: j.planId } });
      if (!plan || plan.killSwitch || plan.status !== 'ACTIVE') continue;
      const c = obj(j.content) as unknown as JobContent;
      const text = `${c.caption}${c.hashtags?.length ? `\n${c.hashtags.map((h) => `#${h}`).join(' ')}` : ''}`;
      const post = await this.publisher.schedule({ accountId: j.accountId as string, content: text, imageUrl: j.channel === 'INSTAGRAM' || j.assetUrl ? j.assetUrl : null, linkUrl: j.channel === 'TELEGRAM' ? null : j.linkUrl, scheduledFor: j.scheduledFor, idempotencyKey: `job:${j.id}`, createdBy: `promotion:${j.vendorId}` });
      await this.prisma.postJob.update({ where: { id: j.id }, data: { status: 'SCHEDULED', socialPostId: post.id } });
      n++;
    }
    return n;
  }

  // — approval queue —

  async queue(q: { status?: string; vendorId?: string; take?: number } = {}): Promise<(PostJob & { businessName?: string })[]> {
    const jobs = await this.prisma.postJob.findMany({ where: { status: q.status ?? 'AWAITING_APPROVAL', ...(q.vendorId ? { vendorId: q.vendorId } : {}) }, orderBy: { scheduledFor: 'asc' }, take: Math.min(q.take ?? 100, 300) });
    const names = await this.prisma.leadspaceProfile.findMany({ where: { vendorId: { in: [...new Set(jobs.map((j) => j.vendorId))] } }, select: { vendorId: true, businessName: true } });
    return jobs.map((j) => ({ ...j, businessName: names.find((n) => n.vendorId === j.vendorId)?.businessName }));
  }

  private async log(job: PostJob, by: string, action: string, note?: string): Promise<Prisma.InputJsonValue> {
    const prev = Array.isArray(job.approvalLog) ? job.approvalLog : [];
    return [...prev, { at: new Date().toISOString(), by, action, ...(note ? { note } : {}) }] as unknown as Prisma.InputJsonValue;
  }

  async approve(ids: string[], by: string): Promise<{ approved: number; scheduled: number; refused: string[] }> {
    const s = await this.settings.get();
    const out = { approved: 0, scheduled: 0, refused: [] as string[] };
    for (const id of ids.slice(0, 200)) {
      const job = await this.prisma.postJob.findUnique({ where: { id } });
      if (!job || job.status !== 'AWAITING_APPROVAL') { out.refused.push(`${id}: not waiting for approval`); continue; }
      const plan = await this.prisma.promotionPlan.findUnique({ where: { id: job.planId } });
      if (s.globalKillSwitch || plan?.killSwitch) { out.refused.push(`${id}: promotion is paused`); continue; }
      const profile = await this.prisma.leadspaceProfile.findUnique({ where: { vendorId: job.vendorId } });
      if (!profile || !promotionGate(profile).ok) { out.refused.push(`${id}: the page no longer qualifies for promotion`); continue; }
      await this.prisma.postJob.update({ where: { id }, data: { status: 'APPROVED', approvalLog: await this.log(job, by, 'approved') } });
      out.approved++;
    }
    out.scheduled = await this.scheduleApproved();
    return out;
  }

  async reject(id: string, by: string, note: string): Promise<PostJob> {
    const job = await this.prisma.postJob.findUnique({ where: { id } });
    if (!job || !['AWAITING_APPROVAL', 'APPROVED'].includes(job.status)) throw new BadRequestException('Only a post that has not been sent can be rejected.');
    return this.prisma.postJob.update({ where: { id }, data: { status: 'SKIPPED', approvalLog: await this.log(job, by, 'rejected', note) } });
  }

  async editCopy(id: string, by: string, caption: string): Promise<PostJob> {
    const job = await this.prisma.postJob.findUnique({ where: { id } });
    if (!job || job.status !== 'AWAITING_APPROVAL') throw new BadRequestException('Only a post waiting for approval can be edited.');
    const profile = await this.profile(job.vendorId);
    const prices = cleanServices(profile.services).map((x) => (typeof x.price === 'number' ? x.price : null)).filter((x): x is number => x !== null);
    const rera = categoryOf(profile.category)?.regulated === 'realEstate' ? profile.reraNumber : null;
    const v = checkCopy(caption, profile.category, prices, { rera });
    if (!v.ok) throw new BadRequestException(v.reason);
    const c = obj(job.content);
    return this.prisma.postJob.update({ where: { id }, data: { content: { ...c, caption: clean(caption, 1800), source: 'template' } as Prisma.InputJsonValue, approvalLog: await this.log(job, by, 'edited') } });
  }

  // — keeping the jobs in step with the publisher —

  async sync(): Promise<number> {
    const jobs = await this.prisma.postJob.findMany({ where: { status: 'SCHEDULED', socialPostId: { not: null }, manualTask: false }, take: 300 });
    let n = 0;
    for (const j of jobs) {
      const post = await this.prisma.socialPost.findUnique({ where: { id: j.socialPostId as string } });
      if (!post) continue;
      if (post.status === 'POSTED') { await this.prisma.postJob.update({ where: { id: j.id }, data: { status: 'POSTED', results: { postUrl: post.postUrl, ...(obj(post.results)) } as Prisma.InputJsonValue } }); n++; }
      else if (post.status === 'FAILED') { await this.prisma.postJob.update({ where: { id: j.id }, data: { status: 'FAILED', results: { error: post.error } as Prisma.InputJsonValue } }); n++; }
      else if (post.status === 'CANCELLED') { await this.prisma.postJob.update({ where: { id: j.id }, data: { status: 'SKIPPED' } }); n++; }
    }
    return n;
  }

  @Cron('*/10 * * * *')
  async tick(): Promise<void> {
    if (process.env.LEADSPACE_SCHEDULER === 'off' || process.env.NODE_ENV === 'test') return;
    try { await this.scheduleApproved(); await this.sync(); } catch (e) { this.logger.warn(`Promotion sync failed: ${e instanceof Error ? e.message : 'unknown'}`); }
  }

  // — manual tasks (Facebook Groups, Google Business Profile guided posts) —

  async tasks(done = false): Promise<(PostJob & { businessName?: string })[]> {
    const jobs = await this.prisma.postJob.findMany({ where: { manualTask: true, status: done ? 'POSTED' : { in: ['APPROVED', 'SCHEDULED'] } }, orderBy: { scheduledFor: 'asc' }, take: 200 });
    const names = await this.prisma.leadspaceProfile.findMany({ where: { vendorId: { in: [...new Set(jobs.map((j) => j.vendorId))] } }, select: { vendorId: true, businessName: true } });
    return jobs.map((j) => ({ ...j, businessName: names.find((n) => n.vendorId === j.vendorId)?.businessName }));
  }

  async markDone(id: string, by: string): Promise<PostJob> {
    const job = await this.prisma.postJob.findUnique({ where: { id } });
    if (!job || !job.manualTask) throw new NotFoundException('We could not find that task.');
    if (!['APPROVED', 'SCHEDULED'].includes(job.status)) throw new BadRequestException('This task is not ready, or is already done.');
    return this.prisma.postJob.update({ where: { id }, data: { status: 'POSTED', manualDoneAt: new Date(), approvalLog: await this.log(job, by, 'done') } });
  }

  // manual tasks also need an approval first (they carry the same copy); approving a manual job moves it to APPROVED, which is the ready state above.

  // — what the vendor sees (read only) —

  async vendorView(vendorId: string): Promise<Record<string, unknown>> {
    const profile = await this.profile(vendorId);
    const plan = await this.plan(vendorId);
    const gate = promotionGate(profile);
    const jobs = await this.prisma.postJob.findMany({ where: { vendorId }, orderBy: { scheduledFor: 'desc' }, take: 60 });
    const view = (j: PostJob) => ({ id: j.id, channel: j.channel === 'MANUAL' ? 'Handled by our team' : j.channel, scheduledFor: j.scheduledFor, status: j.status, caption: String((obj(j.content) as { caption?: string }).caption ?? '').slice(0, 280), postUrl: (obj(j.results) as { postUrl?: string }).postUrl ?? null, results: j.results });
    const s = await this.settings.get();
    return {
      on: plan.status === 'ACTIVE' && profile.promotionEnabled, status: plan.status, killSwitch: plan.killSwitch || s.globalKillSwitch, canTurnOn: gate.ok, whyNot: gate.reason ?? null,
      channels: plan.channels, perWeek: obj(plan.schedule).perWeek ?? 2, offer: plan.offer, manualUntil: plan.manualUntil, autoApprove: plan.autoApprove,
      upcoming: jobs.filter((j) => ['AWAITING_APPROVAL', 'APPROVED', 'SCHEDULED'].includes(j.status)).sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime()).map(view),
      posted: jobs.filter((j) => j.status === 'POSTED').map(view),
    };
  }

  async requestChange(vendorId: string, text: string): Promise<{ received: true }> {
    const profile = await this.profile(vendorId);
    await this.notifications.notifyAdmin('leadspace_change_request', 'Promotion change requested', `${profile.businessName}: ${clean(text, 400)}`, { actionType: 'view_leadspace_queue', actionData: { vendorId } });
    return { received: true };
  }

  // — admin overview —

  async adminPlans(): Promise<unknown[]> {
    const plans = await this.prisma.promotionPlan.findMany({ orderBy: { updatedAt: 'desc' }, take: 200 });
    const profiles = await this.prisma.leadspaceProfile.findMany({ where: { vendorId: { in: plans.map((p) => p.vendorId) } }, select: { vendorId: true, businessName: true, city: true, category: true, promotionEnabled: true } });
    const counts = await this.prisma.postJob.groupBy({ by: ['vendorId', 'status'], where: { vendorId: { in: plans.map((p) => p.vendorId) } }, _count: true });
    return plans.map((p) => ({ ...p, profile: profiles.find((x) => x.vendorId === p.vendorId) ?? null, jobs: Object.fromEntries(counts.filter((c) => c.vendorId === p.vendorId).map((c) => [c.status, c._count])) }));
  }

  /** Guided task: submit the sitemap in Google Search Console. Shows how many pages it holds and when it was last marked done. */
  async sitemapTask(): Promise<{ url: string; pages: number; lastDoneAt: string | null; steps: string[] }> {
    const [pages, row] = await Promise.all([
      this.prisma.leadspaceProfile.count({ where: { status: 'PUBLISHED', verificationStatus: 'VERIFIED', noindex: false } }),
      this.prisma.leadspaceSetting.findUnique({ where: { key: 'sitemapSubmittedAt' } }),
    ]);
    const base = (process.env.PUBLIC_APP_URL || 'https://get4domain.com').replace(/\/+$/, '');
    return {
      url: `${base}/sitemap-leadspace.xml`, pages, lastDoneAt: typeof row?.value === 'string' ? row.value : null,
      steps: ['Open Google Search Console for get4domain.com.', 'Choose Sitemaps.', 'Enter sitemap-leadspace.xml and press Submit.', 'Come back here and press Done.'],
    };
  }

  async sitemapDone(by: string): Promise<{ done: true }> {
    const now = new Date().toISOString();
    await this.prisma.leadspaceSetting.upsert({ where: { key: 'sitemapSubmittedAt' }, create: { key: 'sitemapSubmittedAt', value: now, updatedBy: by }, update: { value: now, updatedBy: by } });
    return { done: true };
  }
}
