import { Injectable } from '@nestjs/common';
import { Notification, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from './push.service';

export const ADMIN_RECIPIENT_ID = 'ADMIN';

export interface CreateNotificationParams {
  recipientId: string;
  recipientType: 'VENDOR' | 'ADMIN';
  type: string;
  priority?: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  actionRequired?: boolean;
  actionType?: string;
  actionData?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
  ) {}

  async create(params: CreateNotificationParams): Promise<Notification> {
    const notification = await this.prisma.notification.create({
      data: {
        recipientId: params.recipientId,
        recipientType: params.recipientType,
        type: params.type,
        priority: params.priority ?? 'INFO',
        title: params.title,
        message: params.message,
        data: (params.data as Prisma.InputJsonValue) ?? undefined,
        actionRequired: params.actionRequired ?? false,
        actionType: params.actionType,
        actionData: (params.actionData as Prisma.InputJsonValue) ?? undefined,
      },
    });

    await this.pushToRecipient(params.recipientId, params.recipientType, params.title, params.message);
    return notification;
  }

  notifyAdmin(
    type: string,
    title: string,
    message: string,
    opts: Partial<CreateNotificationParams> = {},
  ): Promise<Notification> {
    return this.create({ ...opts, recipientId: ADMIN_RECIPIENT_ID, recipientType: 'ADMIN', type, title, message });
  }

  notifyVendor(
    vendorId: string,
    type: string,
    title: string,
    message: string,
    opts: Partial<CreateNotificationParams> = {},
  ): Promise<Notification> {
    return this.create({ ...opts, recipientId: vendorId, recipientType: 'VENDOR', type, title, message });
  }

  findForRecipient(recipientId: string): Promise<Notification[]> {
    return this.prisma.notification.findMany({
      where: { recipientId },
      orderBy: [{ read: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async markRead(id: string): Promise<Notification> {
    return this.prisma.notification.update({ where: { id }, data: { read: true } });
  }

  async markAllRead(recipientId: string): Promise<{ count: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { recipientId, read: false },
      data: { read: true },
    });
    return { count: result.count };
  }

  async subscribe(
    userId: string,
    userType: string,
    endpoint: string,
    p256dh: string,
    auth: string,
    device: string,
  ): Promise<void> {
    const existing = await this.prisma.pushSubscription.findFirst({ where: { userId, endpoint } });
    if (existing) return;
    await this.prisma.pushSubscription.create({ data: { userId, userType, endpoint, p256dh, auth, device } });
  }

  private async pushToRecipient(recipientId: string, recipientType: string, title: string, body: string): Promise<void> {
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: recipientType === 'ADMIN' ? { userType: 'ADMIN' } : { userId: recipientId, userType: 'VENDOR' },
    });

    const results = await Promise.all(
      subscriptions.map(async (sub) => ({
        id: sub.id,
        result: await this.pushService.send({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, title, body),
      })),
    );

    const expiredIds = results.filter((r) => r.result.expired).map((r) => r.id);
    if (expiredIds.length > 0) {
      await this.prisma.pushSubscription.deleteMany({ where: { id: { in: expiredIds } } });
    }
  }
}
