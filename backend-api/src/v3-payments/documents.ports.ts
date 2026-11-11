import { Injectable } from '@nestjs/common';

/**
 * The only door out for a message in the payment slices. Batch 6 replaces the consumer with a real sender; until then ONLY the fake below exists, and it sends nothing: a live attempt
 * (MESSAGING_LIVE_ENABLED=true) is FAILED plainly because no live adapter exists in this build.
 */
export interface OutgoingMessage { channel: 'WHATSAPP' | 'EMAIL'; to: string; text: string; idempotencyKey: string }
export abstract class MessageSenderPort { abstract send(m: OutgoingMessage): Promise<'SENT_SANDBOX' | 'FAILED'>; }

@Injectable()
export class FakeMessageSender extends MessageSenderPort {
  env: Record<string, string | undefined> = process.env;
  sent: OutgoingMessage[] = [];
  async send(m: OutgoingMessage): Promise<'SENT_SANDBOX' | 'FAILED'> {
    if (this.env.MESSAGING_LIVE_ENABLED === 'true') return 'FAILED';
    this.sent.push(m); return 'SENT_SANDBOX';
  }
}

/** Makes the PDF of a document. The fake returns a reference and stores nothing; the real renderer (the existing pdf pipeline) is wired later. */
export abstract class PdfPort { abstract render(d: { vendorId: string; number: string }): Promise<{ ref: string; mode: 'FAKE' }>; }
@Injectable()
export class FakePdf extends PdfPort { async render(d: { vendorId: string; number: string }): Promise<{ ref: string; mode: 'FAKE' }> { return { ref: `fake-pdf/${d.vendorId}/${d.number}.pdf`, mode: 'FAKE' }; } }
