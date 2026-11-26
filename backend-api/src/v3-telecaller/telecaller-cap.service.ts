import { ConflictException, Injectable, Module } from '@nestjs/common';
import { KeyedQueue } from '../common/keyed-queue';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { capReached, startOfIndiaDay } from './core/telecaller-core';
import { TelecallerSettingsService } from './settings/telecaller-settings';

/**
 * The daily cap of new businesses per telecaller. It is applied where a business with its site is created (AdminVendorSiteService), so both doors a telecaller login can use meet the same rule.
 * Requests of one telecaller run one at a time, so two quick clicks cannot both pass the last place (inside one API process).
 */
@Injectable()
export class TelecallerCapService {
  clock: () => Date = () => new Date();
  private readonly queue = new KeyedQueue();
  constructor(private readonly prisma: PrismaService, private readonly settings: TelecallerSettingsService) {}

  run<T>(staffId: string, create: () => Promise<T>): Promise<T> {
    return this.queue.run(staffId, async () => {
      const { telecallerDailyCap } = await this.settings.get();
      const today = await this.prisma.vendor.count({ where: { registeredByStaffId: staffId, createdAt: { gte: startOfIndiaDay(this.clock()) } } });
      if (capReached(today, telecallerDailyCap)) throw new ConflictException({ code: 'TELECALLER_DAILY_CAP', message: 'You have reached the number of businesses you can create today.' });
      return create();
    });
  }
}

/** Its own small module (database only), so the vendor-site module can use the cap without importing the telecaller module. */
@Module({ imports: [PrismaModule], providers: [TelecallerSettingsService, TelecallerCapService], exports: [TelecallerSettingsService, TelecallerCapService] })
export class TelecallerCapModule {}
