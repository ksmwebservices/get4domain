import { Injectable, Logger } from '@nestjs/common';
import * as webpush from 'web-push';

export interface WebPushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushSendResult {
  sent: boolean;
  expired: boolean;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly publicKey = process.env.VAPID_PUBLIC_KEY;
  private readonly privateKey = process.env.VAPID_PRIVATE_KEY;
  private readonly subject = process.env.VAPID_SUBJECT || 'mailto:admin@get4domain.com';

  constructor() {
    if (this.isConfigured) {
      webpush.setVapidDetails(this.subject, this.publicKey as string, this.privateKey as string);
    }
  }

  get isConfigured(): boolean {
    return Boolean(this.publicKey && this.privateKey);
  }

  async send(subscription: WebPushSubscription, title: string, body: string, data?: Record<string, string>): Promise<PushSendResult> {
    if (!this.isConfigured) {
      this.logger.warn(`Push not configured — skipping notification "${title}"`);
      return { sent: false, expired: false };
    }

    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify({ title, body, data: data ?? {} }),
      );
      return { sent: true, expired: false };
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      const expired = statusCode === 404 || statusCode === 410;
      if (!expired) {
        this.logger.error('Push notification failed', error instanceof Error ? error.stack : undefined);
      }
      return { sent: false, expired };
    }
  }
}
