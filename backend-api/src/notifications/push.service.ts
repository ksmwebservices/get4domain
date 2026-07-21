import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

interface CachedToken {
  token: string;
  expiresAt: number;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly projectId = process.env.FIREBASE_PROJECT_ID;
  private readonly clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  private readonly privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  private cachedToken: CachedToken | null = null;

  get isConfigured(): boolean {
    return Boolean(this.projectId && this.clientEmail && this.privateKey);
  }

  async send(fcmToken: string, title: string, body: string, data?: Record<string, string>): Promise<boolean> {
    if (!this.isConfigured) {
      this.logger.warn(`Push not configured — skipping notification "${title}"`);
      return false;
    }

    try {
      const accessToken = await this.getAccessToken();
      const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token: fcmToken,
              notification: { title, body },
              data: data ?? {},
            },
          }),
        },
      );

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(`FCM send failed: ${response.status} ${errorBody}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Push notification failed', error instanceof Error ? error.stack : undefined);
      return false;
    }
  }

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 60_000) {
      return this.cachedToken.token;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const claims = {
      iss: this.clientEmail,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    };

    const encode = (obj: unknown): string => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const signingInput = `${encode(header)}.${encode(claims)}`;
    const signature = crypto.createSign('RSA-SHA256').update(signingInput).sign(this.privateKey as string, 'base64url');
    const assertion = `${signingInput}.${signature}`;

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to obtain FCM access token: ${response.status}`);
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };
    this.cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return data.access_token;
  }
}
