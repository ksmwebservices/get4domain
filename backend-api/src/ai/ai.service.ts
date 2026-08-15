import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ChatDto } from './dto/chat.dto';
import { GenerateContentDto } from './dto/generate-content.dto';
import { AiGeneratePageDto } from './dto/generate-page.dto';
import { CallSummaryDto } from './dto/call-summary.dto';
import { WalletService } from '../wallet/wallet.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';

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
  // Legacy
  facebook: 'social_post',
  instagram: 'social_post',
  reel: 'reel_script',
  poster: 'festival_poster',
  blog: 'blog_article',
};

const MARKETING_PROMPT = `You are the Get4Domain AI assistant on get4domain.com.
Get4Domain is a SaaS platform for Indian SMBs.

Product (ONE simple plan — everything included):
  DomainApp — the complete Business Operating System.
  Price: ₹999 per month, all features included.
  What's inside: an industry website, business management (records,
  contacts, catalog, invoicing), TeleCRM, Campaigns (social, WhatsApp,
  SMS, leads), and AI Studio for content — all in one product.
  A wallet (pay-as-you-go top-up) covers optional usage-based extras
  such as AI generation and messaging credits. Custom domain optional.

There is only ONE product now. Do NOT mention a separate
"DomainCampaign" plan or any ₹3,999 / ₹13,999 / ₹24,999 / ₹29,999
pricing — those are outdated. Campaigns and AI are included in DomainApp.

We support 20+ industries: restaurant, travel, healthcare,
education, real estate, retail, beauty, fitness, construction,
professional services, events, finance, automobile, logistics,
hotel, diagnostics, photography, technology, agriculture, coaching.

To get started: book a free demo at get4domain.com/book-demo
Our consultant calls within 24 hours.

Company: KSM Quantum Technologies
Contact: +917550047567
Email: hello@get4domain.com

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
  ) {}

  /** Claude key from Admin → Integrations (ai/anthropic_api_key), env fallback. */
  private claudeKey(): Promise<string | null> {
    return this.settings.getResolvedValue('ai', 'anthropic_api_key');
  }

  private async callClaude(prompt: string, maxTokens: number): Promise<string> {
    const apiKey = await this.claudeKey();
    if (!apiKey) {
      throw new ServiceUnavailableException('AI content generation is not configured');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      this.logger.error(`Anthropic API error ${response.status}: ${await response.text()}`);
      throw new ServiceUnavailableException('AI content generation is temporarily unavailable');
    }

    const data = (await response.json()) as AnthropicResponse;
    return data.content.find((block) => block.type === 'text')?.text ?? '';
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
    // Charge only when an image was actually produced.
    if (img.url && !internal) {
      await this.walletService.deduct(vendorId, cost, 'AI document design image', 'ai_doc_design');
    }
    return { imageUrl: img.url, status: img.status, error: img.error };
  }

  /**
   * DALL-E image generation. Returns a discriminated result so callers can tell
   * "no key configured" apart from a real OpenAI API failure (invalid/expired key,
   * quota, no image access, …) — never masks an API error as "not configured".
   */
  private async generateImage(prompt: string): Promise<{ url: string | null; status: 'ok' | 'not_configured' | 'failed'; error?: string }> {
    const apiKey = await this.settings.getResolvedValue('ai', 'openai_api_key');
    if (!apiKey) {
      this.logger.warn('OpenAI image key not resolved (ai/openai_api_key or OPENAI_API_KEY env)');
      return { url: null, status: 'not_configured' };
    }

    try {
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size: '1024x1024' }),
      });

      const body = await response.text();
      if (!response.ok) {
        let message = `OpenAI HTTP ${response.status}`;
        try {
          const parsed = JSON.parse(body) as { error?: { message?: string } };
          if (parsed?.error?.message) message = parsed.error.message;
        } catch { /* non-JSON body */ }
        this.logger.error(`DALL-E error ${response.status}: ${body.slice(0, 400)}`);
        return { url: null, status: 'failed', error: message };
      }

      const data = JSON.parse(body) as { data: Array<{ url: string }> };
      return { url: data.data[0]?.url ?? null, status: 'ok' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'network error';
      this.logger.error(`DALL-E image request failed: ${message}`);
      return { url: null, status: 'failed', error: message };
    }
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

    const prompt = `Write a ${dto.channel} marketing post for an Indian small business in the ${dto.vendorIndustry} industry.
Offer/details: ${dto.offerDetails}
Tone: ${dto.tone ?? 'friendly and professional'}

Respond with ONLY a JSON object (no markdown fences) in this exact shape:
{"caption": string, "hashtags": [5-8 relevant hashtags without #], "imagePrompt": string (a visual description for an image generator)}`;

    const text = await this.callClaude(prompt, 500);
    const jsonText = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(jsonText) as { caption: string; hashtags: string[]; imagePrompt: string };

    // Internal admin staff use AI Studio for free — no wallet deduction.
    if (!internal) {
      await this.walletService.deduct(vendorId, cost, `AI ${dto.channel} content generated`, `ai_content_${dto.channel}`);
    }

    // Image is a best-effort add-on to the text — a failure here doesn't fail the
    // post. Skipped entirely when the vendor supplied their own image (skipImage).
    const img = !dto.skipImage && IMAGE_CHANNELS.has(dto.channel) ? await this.generateImage(parsed.imagePrompt) : null;

    return { ...parsed, imageUrl: img?.url ?? null };
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

    const text = await this.callClaude(prompt, 600);
    const jsonText = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    return JSON.parse(jsonText);
  }

  async callSummary(
    vendorId: string,
    dto: CallSummaryDto,
    internal = false,
  ): Promise<{ summary: string; nextAction: string; sentiment: string }> {
    const prompt = `Summarize this sales call note for a CRM.

Lead: ${dto.leadName}
Call duration: ${dto.callDuration ? `${dto.callDuration} seconds` : 'unknown'}
Notes: ${dto.textNotes}

Respond with ONLY a JSON object (no markdown fences) in this exact shape:
{"summary": string (1-2 sentences), "nextAction": string (recommended next step), "sentiment": "positive" | "neutral" | "negative"}`;

    const text = await this.callClaude(prompt, 300);
    const jsonText = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(jsonText) as { summary: string; nextAction: string; sentiment: string };

    // Internal admin staff use AI Studio for free — no wallet deduction.
    if (!internal) {
      await this.walletService.deduct(vendorId, CALL_SUMMARY_COST_PAISE, 'AI call summary generated', 'ai_call_summary');
    }

    return parsed;
  }

  async chat(dto: ChatDto): Promise<{ reply: string; suggestedActions: string[] }> {
    const apiKey = await this.claudeKey();
    if (!apiKey) {
      throw new ServiceUnavailableException('AI assistant is not configured');
    }

    let systemPrompt = dto.context === 'dashboard' ? DASHBOARD_PROMPT : MARKETING_PROMPT;
    if (dto.context === 'dashboard') {
      if (dto.vendorName) systemPrompt += `\n\nYou are currently talking to: ${dto.vendorName}.`;
      if (dto.industry) systemPrompt += ` Their business industry: ${dto.industry}.`;
    }

    const messages = [
      ...(dto.conversationHistory ?? []).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: dto.message },
    ];

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 300,
          system: systemPrompt,
          messages,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(`Anthropic API error ${response.status}: ${errorBody}`);
        throw new ServiceUnavailableException('AI assistant is temporarily unavailable');
      }

      const data = (await response.json()) as AnthropicResponse;
      const reply = data.content.find((block) => block.type === 'text')?.text ?? "Let me connect you with our team for that specific question.";

      const suggestedActions = /connect you with our team/i.test(reply) ? ['call', 'whatsapp'] : [];

      return { reply, suggestedActions };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.error('AI chat request failed', error instanceof Error ? error.stack : undefined);
      throw new ServiceUnavailableException('AI assistant is temporarily unavailable');
    }
  }
}
