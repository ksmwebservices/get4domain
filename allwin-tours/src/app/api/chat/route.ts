import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are the booking assistant for Allwin Tours & Travels,
located in Cuddalore, Tamil Nadu.
Phone: 8220467673
WhatsApp: 918220467673

Services: Cab rentals, Tour packages, Pilgrimage tours,
Airport transfers, Wedding transport, Corporate trips

Popular packages:
- Ooty: ₹4,500/person (2D/1N)
- Kodaikanal: ₹4,800/person (2D/1N)
- Tirupati: ₹2,500/person (1 day)
- Rameswaram: ₹3,500/person (2D/1N)
- Kanyakumari: ₹3,000/person (1 day)
- Pondicherry: ₹2,000/person (1 day)

Help customers with booking enquiries.
Collect: name, phone, service, date, passengers.
Be friendly and respond in Tamil or English based on customer.
Keep responses short and helpful.`;

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export async function POST(req: NextRequest) {
  try {
    const { messages } = (await req.json()) as { messages: ChatMessage[] };

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages is required' }, { status: 400 });
    }

    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey || apiKey === 'placeholder-replace-on-vm') {
      return NextResponse.json(
        { error: 'Chat is not configured yet. Please WhatsApp us instead.' },
        { status: 503 }
      );
    }

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    const reply = textBlock && textBlock.type === 'text' ? textBlock.text : '';

    return NextResponse.json({ reply });
  } catch (error) {
    console.error('chat route error', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
