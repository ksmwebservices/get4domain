import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ChatDto } from './dto/chat.dto';
import { GenerateContentDto } from './dto/generate-content.dto';
import { AiGeneratePageDto } from './dto/generate-page.dto';
import { CallSummaryDto } from './dto/call-summary.dto';
import { WalletService } from '../wallet/wallet.service';

export const CONTENT_CHANNEL_COST_PAISE: Record<string, number> = {
  facebook: 500,
  instagram: 500,
  reel: 1000,
  poster: 800,
  blog: 1500,
};

const IMAGE_CHANNELS = new Set(['facebook', 'instagram', 'poster']);
const CALL_SUMMARY_COST_PAISE = 300;

const MARKETING_PROMPT = `You are the Get4Domain AI assistant on get4domain.com.
Get4Domain is a SaaS platform for Indian SMBs.

Products:
1. DomainApp - Business Operating System
   Startup: ₹3,999 (6mo) / ₹6,999 (yearly)
   Enterprise: ₹13,999 (6mo) / ₹24,999 (yearly)

2. DomainCampaign - Managed Digital Marketing
   Starter: ₹3,999 (6mo) / ₹6,999 (yearly)
   Business: ₹16,999 (6mo) / ₹29,999 (yearly)

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

  constructor(private readonly walletService: WalletService) {}

  private async callClaude(prompt: string, maxTokens: number): Promise<string> {
    const apiKey = process.env.CLAUDE_API_KEY;
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

  private async generateImage(prompt: string): Promise<string | null> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY not configured — skipping DALL-E image generation');
      return null;
    }

    try {
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size: '1024x1024' }),
      });

      if (!response.ok) {
        this.logger.error(`DALL-E error ${response.status}: ${await response.text()}`);
        return null;
      }

      const data = (await response.json()) as { data: Array<{ url: string }> };
      return data.data[0]?.url ?? null;
    } catch (error) {
      this.logger.error('DALL-E image generation failed', error instanceof Error ? error.stack : undefined);
      return null;
    }
  }

  async generateContent(
    vendorId: string,
    dto: GenerateContentDto,
  ): Promise<{ caption: string; hashtags: string[]; imagePrompt: string; imageUrl: string | null }> {
    const cost = CONTENT_CHANNEL_COST_PAISE[dto.channel] ?? 500;

    const prompt = `Write a ${dto.channel} marketing post for an Indian small business in the ${dto.vendorIndustry} industry.
Offer/details: ${dto.offerDetails}
Tone: ${dto.tone ?? 'friendly and professional'}

Respond with ONLY a JSON object (no markdown fences) in this exact shape:
{"caption": string, "hashtags": [5-8 relevant hashtags without #], "imagePrompt": string (a visual description for an image generator)}`;

    const text = await this.callClaude(prompt, 500);
    const jsonText = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(jsonText) as { caption: string; hashtags: string[]; imagePrompt: string };

    await this.walletService.deduct(vendorId, cost, `AI ${dto.channel} content generated`, `ai_content_${dto.channel}`);

    const imageUrl = IMAGE_CHANNELS.has(dto.channel) ? await this.generateImage(parsed.imagePrompt) : null;

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

    const text = await this.callClaude(prompt, 600);
    const jsonText = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    return JSON.parse(jsonText);
  }

  async callSummary(
    vendorId: string,
    dto: CallSummaryDto,
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

    await this.walletService.deduct(vendorId, CALL_SUMMARY_COST_PAISE, 'AI call summary generated', 'ai_call_summary');

    return parsed;
  }

  async chat(dto: ChatDto): Promise<{ reply: string; suggestedActions: string[] }> {
    const apiKey = process.env.CLAUDE_API_KEY;
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
