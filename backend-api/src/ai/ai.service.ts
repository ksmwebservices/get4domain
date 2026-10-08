import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ChatDto } from './dto/chat.dto';
import { GenerateContentDto } from './dto/generate-content.dto';
import { AiGeneratePageDto } from './dto/generate-page.dto';
import { CallSummaryDto } from './dto/call-summary.dto';
import { WalletService } from '../wallet/wallet.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { StorageService } from '../storage/storage.service';
import { AiErrorKind, AiProviderError, AiProviderName, VENDOR_MESSAGE, classifyProviderError, pickError, toVendorException } from './ai-errors';
import { persistGeneratedImage } from './ai-image-store';

export const CONTENT_CHANNEL_COST_PAISE: Record<string, number> = {
  // AI Studio content-type keys (source of truth for the grid).
  social_post: 500,
  reel_script: 800,
  blog_post: 1500,
  festival_poster: 1200,
  ad_creative: 1000,
  email: 600,
  whatsapp: 300,
  sms: 200,
  // Auto-generated live-site hero banner (DALL-E, landscape) at vendor creation.
  site_hero: 1200,
  // Legacy channel keys still used by Growth Hub publish flows.
  facebook: 500,
  instagram: 500,
  reel: 1000,
  poster: 1200,
  blog: 1500,
};

// Channels that also produce a generated image (DALL-E), same as Poster.
const IMAGE_CHANNELS = new Set(['social_post', 'festival_poster', 'ad_creative', 'facebook', 'instagram', 'poster']);
const CALL_SUMMARY_COST_PAISE = 300;
const TEXT_TIMEOUT_MS = 45_000;
const IMAGE_TIMEOUT_MS = 90_000;

// Maps AI content channels to admin-managed pricing keys (g4d_platform_settings).
const CONTENT_PRICING_KEY: Record<string, string> = {
  social_post: 'social_post',
  reel_script: 'reel_script',
  blog_post: 'blog_article',
  festival_poster: 'festival_poster',
  ad_creative: 'social_post',
  email: 'email_message',
  whatsapp: 'whatsapp_message',
  sms: 'sms_message',
  site_hero: 'festival_poster',
  // Legacy
  facebook: 'social_post',
  instagram: 'social_post',
  reel: 'reel_script',
  poster: 'festival_poster',
  blog: 'blog_article',
};

const MARKETING_PROMPT = `You are the Get4Domain AI assistant on get4domain.com.
Get4Domain is a SaaS platform for Indian SMBs.

We offer three things (full comparison at get4domain.com/pricing):

1. DomainApp — industry website + business workspace, two ANNUAL plans
   (prices exclude 18% GST; there is no monthly or quarterly billing):
   - Workspace: ₹999/month equivalent, billed ₹11,988 once a year.
     Industry website, hosting + SSL, lead capture, CRM + TeleCRM, website
     auto-bot reply, Communication Hub (WhatsApp, SMS, email), GST invoicing
     and expense tracking, team access, AI Studio (content, images, blog
     writing) with a ₹499 one-time credit, SEO/GEO/AEO with 3 keywords
     (keyword + meta tag/description optimization), Google Business Profile,
     Analytics and Search Console, backlinks, social media management and
     posting, PWA mobile apps, 2 theme/website customizations a year.
   - BOS: ₹1,999/month equivalent, billed ₹23,988 once a year.
     Everything in Workspace plus WhatsApp bot reply, accounting and GST
     (P&L, GSTR filing), HRM (staff, attendance, payroll), inventory
     management, task management, 6 SEO keywords, 4 theme customizations a
     year and a ₹1,299 one-time AI Studio credit.
   A wallet (pay-as-you-go top-up) covers usage-based extras such as AI
   generation, WhatsApp/SMS/email credits. Custom domain is optional.

2. DomainCampaign — our team runs the customer's Meta + Google ads and
   organic growth. Flat monthly management fee by monthly ad budget:
   up to ₹20,000 -> ₹2,000; ₹20,001 to ₹1,00,000 -> ₹5,000; above
   ₹1,00,000 -> ₹10,000 (plus 18% GST). Enterprise/multi-brand: custom
   quote. Ad spend is paid directly to Meta/Google, separate from our fee.
   Details: get4domain.com/domain-campaign

3. Managed Services — custom web/mobile apps, bespoke CRM/ERP software,
   managed ads, social media, content, influencer work and commercial ad
   production. Always custom-quoted per project (no fixed price list).
   Get a quote: get4domain.com/managed-services#quote

Do NOT quote the old ₹3,999 / ₹13,999 / ₹24,999 / ₹29,999 tiers, a
single "₹999 everything included" plan, or ₹9,999/year - all outdated.

We support 20+ industries: restaurant, travel, healthcare,
education, real estate, retail, beauty, fitness, construction,
professional services, events, finance, automobile, logistics,
hotel, diagnostics, photography, technology, agriculture, coaching.

To get started: book a free demo at get4domain.com/book-demo
Our consultant calls within 24 hours.

Company: KSM Quantum Technologies
Email: support@get4domain.com

We do NOT publish a phone number to call. If someone wants to speak to a person,
offer a callback — collect their name and phone and tell them our team will call
them back. Never invite them to call or message us on a number.

For demo booking: collect name, phone, business name, industry.
Then say: "Great! I've noted your details. Our consultant will call
you within 24 hours. You can also book directly at /book-demo"

Always respond in a friendly, professional tone.
Keep responses concise - max 3-4 sentences.
If asked something you don't know, say:
"Let me connect you with our team for that specific question."`;

const DASHBOARD_PROMPT = `You are the Get4Domain support assistant for logged-in vendors.
You help vendors manage their Get4Domain subscription.

You can help with:
- How to update website content
- How to pay invoices
- How to download invoices
- How to add products/services
- How to check campaign status
- How to raise support tickets
- How to renew subscription
- How to upgrade plan
- How to map custom domain

Dashboard navigation:
- Pay invoices: go to Billing & Payments
- Update website: go to My Website
- Add products: go to My Products
- Campaign status: go to My Campaign
- Raise ticket: go to Support
- Upgrade plan: go to My Plans & Services

If you cannot resolve the issue, say:
"Let me connect you with our team for that specific question."

Always be helpful and friendly.
Keep responses under 3 sentences.`;

interface AnthropicResponse {
  content: Array<{ type: string; text?: string }>;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly model = 'claude-haiku-4-5-20251001';

  constructor(
    private readonly walletService: WalletService,
    private readonly settings: PlatformSettingsService,
    private readonly storage: StorageService,
  ) {}

  private readonly openaiTextModel = 'gpt-4o-mini';

  /** Claude key from Admin → Integrations (ai/anthropic_api_key), env fallback. */
  private claudeKey(): Promise<string | null> {
    return this.settings.getResolvedValue('ai', 'anthropic_api_key');
  }

  /** Providers that have a key configured, in preference order: OpenAI first (the key most deployments credit), then Anthropic. */
  private async configuredProviders(): Promise<Array<{ name: AiProviderName; key: string }>> {
    const [openai, claude] = await Promise.all([this.settings.getResolvedValue('ai', 'openai_api_key'), this.claudeKey()]);
    const out: Array<{ name: AiProviderName; key: string }> = [];
    if (openai) out.push({ name: 'openai', key: openai });
    if (claude) out.push({ name: 'anthropic', key: claude });
    return out;
  }

  /**
   * Provider-agnostic text generation with FALLBACK. Tries each configured provider in order (OpenAI, then Claude); when one is missing a key
   * or its call fails (bad key, no credit, rate limit, timeout, outage) the next one is tried, so one dead account does not stop AI Studio.
   * A content-policy refusal is NOT retried elsewhere. If every provider fails the vendor gets ONE specific, classified message
   * (see ai-errors.ts) — never a canned/mock string, and never a charge: callers debit only after this returns real content.
   */
  private async generateText(prompt: string, maxTokens: number, opts: { system?: string; history?: Array<{ role: string; content: string }> } = {}): Promise<string> {
    const providers = await this.configuredProviders();
    if (providers.length === 0) throw new ServiceUnavailableException('AI content generation is not configured');
    const errors: AiProviderError[] = [];
    for (const p of providers) {
      try {
        return p.name === 'openai' ? await this.callOpenAiText(p.key, prompt, maxTokens, opts) : await this.callClaudeText(p.key, prompt, maxTokens, opts);
      } catch (e) {
        const err = e instanceof AiProviderError ? e : new AiProviderError(p.name, 'UNAVAILABLE', null, e instanceof Error ? e.message : 'unknown error');
        this.logger.error(`AI text via ${p.name} failed: ${err.kind}${err.status ? ` HTTP ${err.status}` : ''} — ${err.detail.slice(0, 300)}`);
        errors.push(err);
        if (err.kind === 'CONTENT_BLOCKED') break; // the request itself was refused; another provider will not make it acceptable
      }
    }
    throw toVendorException(pickError(errors).kind);
  }

  private async callProvider(provider: AiProviderName, url: string, init: RequestInit): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(url, { ...init, signal: AbortSignal.timeout(TEXT_TIMEOUT_MS) });
    } catch (e) {
      throw new AiProviderError(provider, classifyProviderError(null, '', e), null, e instanceof Error ? e.message : String(e));
    }
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new AiProviderError(provider, classifyProviderError(response.status, body), response.status, body);
    }
    return response;
  }

  private async callOpenAiText(apiKey: string, prompt: string, maxTokens: number, opts: { system?: string; history?: Array<{ role: string; content: string }> } = {}): Promise<string> {
    const messages = [...(opts.system ? [{ role: 'system', content: opts.system }] : []), ...(opts.history ?? []), { role: 'user', content: prompt }];
    const response = await this.callProvider('openai', 'https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: this.openaiTextModel, max_tokens: maxTokens, messages }),
    });
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? '';
  }

  private async callClaudeText(apiKey: string, prompt: string, maxTokens: number, opts: { system?: string; history?: Array<{ role: string; content: string }> } = {}): Promise<string> {
    const response = await this.callProvider('anthropic', 'https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        ...(opts.system ? { system: opts.system } : {}),
        messages: [...(opts.history ?? []), { role: 'user', content: prompt }],
      }),
    });
    const data = (await response.json()) as AnthropicResponse;
    return data.content.find((block) => block.type === 'text')?.text ?? '';
  }

  /** Robustly pull a JSON object out of a model response (handles ```json fences
   *  and any surrounding prose the model adds). Throws a clean error rather than a
   *  raw SyntaxError so the wallet is never debited on an unparseable response. */
  private parseJsonBlock<T>(text: string): T {
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    try { return JSON.parse(cleaned) as T; } catch { /* try to extract a { … } block */ }
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]) as T; } catch { /* fall through */ }
    }
    this.logger.error(`AI returned non-JSON content: ${text.slice(0, 300)}`);
    throw new ServiceUnavailableException('AI returned an unexpected format. Please try again.');
  }

  /**
   * Grounded WhatsApp-bot reply (fallback when the vendor's knowledge base has no
   * match). Answers ONLY from the supplied business context (KB + hours/location/
   * services/pricing) so it uses the vendor's REAL data, never an invented price or
   * time. Short, WhatsApp-style. Throws (like other AI calls) when no key is
   * configured — the caller escalates to a human instead.
   */
  async whatsappBotReply(params: { businessName: string; context: string; history: string; message: string }): Promise<string> {
    const prompt = `You are the WhatsApp assistant for "${params.businessName}", an Indian small business. Reply to the customer's latest message using ONLY the business information below. If that information does not contain the answer, say the team will follow up shortly — do NOT invent prices, hours, availability or any fact. Keep it short and friendly (1-3 sentences), plain text, no markdown.

BUSINESS INFORMATION:
${params.context || '(none provided)'}

CONVERSATION SO FAR:
${params.history || '(this is the first message)'}

Customer's latest message: ${params.message}

Your reply:`;
    const text = await this.generateText(prompt, 300);
    return text.trim();
  }

  /**
   * Design-only background image for a structured document (Letterhead / Visiting
   * Card / ID Card). The real business text is overlaid crisply by the client — the
   * image is JUST the design (no text), so nothing gets garbled. Free for internal
   * staff; returns null when no image key is configured (client falls back to a
   * CSS design).
   */
  async generateDesignImage(vendorId: string, prompt: string, internal = false): Promise<{ imageUrl: string | null; status: string; error?: string }> {
    const cost = await this.walletService.getRate('document', 1500);
    if (!internal && !(await this.walletService.hasSufficientBalance(vendorId, cost))) {
      throw new BadRequestException('INSUFFICIENT_WALLET_BALANCE');
    }
    const img = await this.generateImage(prompt);
    // Charge only when an image was actually produced; keep a permanent copy (the provider's link expires in about an hour).
    if (img.url && !internal) {
      await this.walletService.deduct(vendorId, cost, 'AI document design image', 'ai_doc_design');
    }
    const imageUrl = img.url ? (await persistGeneratedImage(img.url)) ?? img.url : null;
    return { imageUrl, status: img.status, error: img.error };
  }

  /**
   * DALL-E image generation. Returns a discriminated result so callers can tell
   * "no key configured" apart from a real OpenAI API failure (invalid/expired key,
   * quota, no image access, …) — never masks an API error as "not configured".
   */
  private async generateImage(
    prompt: string,
    size: '1024x1024' | '1792x1024' | '1024x1792' = '1024x1024',
  ): Promise<{ url: string | null; status: 'ok' | 'not_configured' | 'failed'; error?: string; kind?: AiErrorKind }> {
    const apiKey = await this.settings.getResolvedValue('ai', 'openai_api_key');
    if (!apiKey) {
      this.logger.warn('OpenAI image key not resolved (ai/openai_api_key or OPENAI_API_KEY env)');
      return { url: null, status: 'not_configured' };
    }

    try {
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size }),
        signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
      });

      const body = await response.text();
      if (!response.ok) {
        // The raw provider message stays in the server log; the vendor gets the classified, actionable one.
        const kind = classifyProviderError(response.status, body);
        this.logger.error(`DALL-E error ${response.status} (${kind}): ${body.slice(0, 400)}`);
        return { url: null, status: 'failed', error: VENDOR_MESSAGE[kind], kind };
      }

      const data = JSON.parse(body) as { data: Array<{ url: string }> };
      return { url: data.data[0]?.url ?? null, status: 'ok' };
    } catch (error) {
      const kind = classifyProviderError(null, '', error);
      this.logger.error(`DALL-E image request failed (${kind}): ${error instanceof Error ? error.message : 'network error'}`);
      return { url: null, status: 'failed', error: VENDOR_MESSAGE[kind], kind };
    }
  }

  /**
   * Generate a durable, industry-appropriate HERO BANNER for a vendor's live site and
   * persist it to Supabase Storage. DALL-E hands back a URL that expires in ~1h, so a
   * temp URL can't back a live website — we re-host it and return a permanent public URL,
   * or a discriminated non-ok status so callers (e.g. auto-seed at vendor creation) can
   * degrade to the curated sample image instead of failing. Wallet is charged once, only
   * after a real image was both generated AND persisted.
   *
   * The prompt is deliberately TEXT-FREE (no words, logos or UI baked into the pixels) so
   * nothing renders garbled — headline/CTA text is overlaid by the site's hero component.
   */
  async generateSiteHero(
    vendorId: string,
    params: { businessName: string; industry: string; tagline?: string },
    internal = false,
  ): Promise<{ url: string | null; status: 'ok' | 'not_configured' | 'failed'; error?: string }> {
    // No point calling a paid image API if the result can't be persisted durably.
    if (!(await this.storage.isConfigured())) {
      return { url: null, status: 'not_configured', error: 'storage not configured' };
    }

    const prompt = `A premium, photorealistic wide banner photograph for the website hero of a ${params.industry} business in India. Professional, bright, editorial commercial photography with natural depth of field and a welcoming atmosphere. Wide 16:9 composition with clean negative space on one side for an overlaid headline. Absolutely no text, no words, no letters, no logos, no watermarks and no user-interface elements.`;

    const img = await this.generateImage(prompt, '1792x1024');
    if (img.status !== 'ok' || !img.url) {
      return { url: null, status: img.status, error: img.error };
    }

    const stored = await this.storage.uploadFromUrl(img.url, `vendors/${vendorId}/hero-${Date.now()}.png`);
    if (stored.status !== 'ok' || !stored.url) {
      return { url: null, status: 'failed', error: stored.error ?? 'persist failed' };
    }

    if (!internal) {
      const cost = await this.walletService.getRate(
        CONTENT_PRICING_KEY.site_hero ?? '',
        CONTENT_CHANNEL_COST_PAISE.site_hero ?? 1200,
      );
      try {
        await this.walletService.deduct(vendorId, cost, 'AI site hero banner generated', 'ai_site_hero');
      } catch (error) {
        // The banner is already persisted and free to keep — a debit failure (e.g. low
        // balance) must not discard it or fail the caller. Log and move on.
        this.logger.warn(`Site hero persisted but wallet debit failed for ${vendorId}: ${error instanceof Error ? error.message : 'error'}`);
      }
    }

    return { url: stored.url, status: 'ok' };
  }

  /** Resolved per-use cost (paise) for each AI Studio content type — the single
   *  source of truth for the vendor-facing showcase pricing. Admin Pricing Manager
   *  overrides (g4d_platform_settings) win over the hardcoded defaults, exactly like
   *  the deduction path in generateContent below (same key map + fallbacks). */
  async contentCosts(): Promise<Record<string, number>> {
    const channels = ['social_post', 'reel_script', 'blog_post', 'festival_poster', 'ad_creative', 'email', 'whatsapp', 'sms'];
    const out: Record<string, number> = {};
    for (const ch of channels) {
      out[ch] = await this.walletService.getRate(CONTENT_PRICING_KEY[ch] ?? '', CONTENT_CHANNEL_COST_PAISE[ch] ?? 500);
    }
    return out;
  }

  async generateContent(
    vendorId: string,
    dto: GenerateContentDto,
    internal = false,
  ): Promise<{ caption: string; hashtags: string[]; imagePrompt: string; imageUrl: string | null }> {
    // DB-managed rate first (admin Pricing Manager), else hardcoded default.
    const cost = await this.walletService.getRate(
      CONTENT_PRICING_KEY[dto.channel] ?? '',
      CONTENT_CHANNEL_COST_PAISE[dto.channel] ?? 500,
    );

    // Wallet first: no provider money is spent for a vendor who cannot pay. (Debit still happens only after real content comes back.)
    if (!internal && !(await this.walletService.hasSufficientBalance(vendorId, cost))) {
      throw new BadRequestException('INSUFFICIENT_WALLET_BALANCE');
    }

    const prompt = `Write a ${dto.channel} marketing post for an Indian small business in the ${dto.vendorIndustry} industry.
Offer/details: ${dto.offerDetails}
Tone: ${dto.tone ?? 'friendly and professional'}

Respond with ONLY a JSON object (no markdown fences) in this exact shape:
{"caption": string, "hashtags": [5-8 relevant hashtags without #], "imagePrompt": string (a visual description for an image generator)}`;

    const text = await this.generateText(prompt, 500);
    const parsed = this.parseJsonBlock<{ caption: string; hashtags: string[]; imagePrompt: string }>(text);

    // Wallet is debited ONLY here — after a real provider call returned parseable
    // content. If generation or parsing failed above, we already threw and never
    // reached this line, so no credits are spent on a failed/fake response.
    if (!internal) {
      await this.walletService.deduct(vendorId, cost, `AI ${dto.channel} content generated`, `ai_content_${dto.channel}`);
    }

    // Image is a best-effort add-on to the text — a failure here doesn't fail the
    // post. Skipped entirely when the vendor supplied their own image (skipImage).
    const img = !dto.skipImage && IMAGE_CHANNELS.has(dto.channel) ? await this.generateImage(parsed.imagePrompt) : null;

    // Keep a permanent copy of the picture in our uploads (the provider's link expires); fall back to the temporary link only if saving fails.
    const imageUrl = img?.url ? (await persistGeneratedImage(img.url)) ?? img.url : null;
    return { ...parsed, imageUrl };
  }

  async generatePage(dto: AiGeneratePageDto): Promise<{
    headline: string;
    subheadline: string;
    benefits: string[];
    aboutText: string;
    ctaText: string;
  }> {
    const prompt = `Generate landing page marketing copy for a small business in India.

Business: ${dto.businessName}
Industry: ${dto.industry}
Offer: ${dto.offerTitle}
About: ${dto.description}

Respond with ONLY a JSON object (no markdown fences, no commentary) in this exact shape:
{"headline": string, "subheadline": string, "benefits": [5 short benefit strings], "aboutText": string (2-3 sentences), "ctaText": string (2-4 words)}`;

    const text = await this.generateText(prompt, 600);
    return this.parseJsonBlock(text);
  }

  async callSummary(
    vendorId: string,
    dto: CallSummaryDto,
    internal = false,
  ): Promise<{ summary: string; nextAction: string; sentiment: string }> {
    if (!internal && !(await this.walletService.hasSufficientBalance(vendorId, CALL_SUMMARY_COST_PAISE))) {
      throw new BadRequestException('INSUFFICIENT_WALLET_BALANCE');
    }

    const prompt = `Summarize this sales call note for a CRM.

Lead: ${dto.leadName}
Call duration: ${dto.callDuration ? `${dto.callDuration} seconds` : 'unknown'}
Notes: ${dto.textNotes}

Respond with ONLY a JSON object (no markdown fences) in this exact shape:
{"summary": string (1-2 sentences), "nextAction": string (recommended next step), "sentiment": "positive" | "neutral" | "negative"}`;

    const text = await this.generateText(prompt, 300);
    const parsed = this.parseJsonBlock<{ summary: string; nextAction: string; sentiment: string }>(text);

    // Debit only after a real, parseable summary — never on a failed call.
    if (!internal) {
      await this.walletService.deduct(vendorId, CALL_SUMMARY_COST_PAISE, 'AI call summary generated', 'ai_call_summary');
    }

    return parsed;
  }

  async chat(dto: ChatDto): Promise<{ reply: string; suggestedActions: string[] }> {
    if ((await this.configuredProviders()).length === 0) {
      throw new ServiceUnavailableException('AI assistant is not configured');
    }

    let systemPrompt = dto.context === 'dashboard' ? DASHBOARD_PROMPT : MARKETING_PROMPT;
    if (dto.context === 'dashboard') {
      if (dto.vendorName) systemPrompt += `\n\nYou are currently talking to: ${dto.vendorName}.`;
      if (dto.industry) systemPrompt += ` Their business industry: ${dto.industry}.`;
    }

    const history = (dto.conversationHistory ?? []).map((m) => ({ role: m.role, content: m.content }));
    const fallback = 'Let me connect you with our team for that specific question.';

    // Same provider fallback + classified errors as the rest of AI Studio.
    const text = await this.generateText(dto.message, 300, { system: systemPrompt, history });
    const reply = text.trim() ? text : fallback;

    // Human escalation offers a callback (we call them) — never an inbound number.
    const suggestedActions = /connect you with our team/i.test(reply) ? ['callback'] : [];
    return { reply, suggestedActions };
  }
}
