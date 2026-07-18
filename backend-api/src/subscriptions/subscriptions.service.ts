import { Injectable, NotFoundException } from '@nestjs/common';
import { Subscription } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<Subscription[]> {
    return this.prisma.subscription.findMany({
      include: { vendor: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(dto: CreateSubscriptionDto): Promise<Subscription> {
    return this.prisma.subscription.create({
      data: {
        vendorId: dto.vendorId,
        product: dto.product,
        plan: dto.plan,
        amount: dto.amount,
      },
    });
  }

  private async findOne(id: string): Promise<Subscription> {
    const subscription = await this.prisma.subscription.findUnique({ where: { id } });
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }
    return subscription;
  }

  async activate(id: string): Promise<Subscription> {
    await this.findOne(id);
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + 1);

    return this.prisma.subscription.update({
      where: { id },
      data: { status: 'ACTIVE', startDate, endDate },
    });
  }

  async cancel(id: string): Promise<Subscription> {
    await this.findOne(id);
    return this.prisma.subscription.update({ where: { id }, data: { status: 'CANCELLED' } });
  }
}
