import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ChatDto } from './dto/chat.dto';

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
