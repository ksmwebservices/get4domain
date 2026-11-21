import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminGapsController } from './api/admin-gaps.controllers';
import { AdminGapsService } from './admin-gaps.service';
import { AdminGapsStore } from './admin-gaps.store';
import { PrismaAdminGapsStore } from './prisma-admin-gaps.store';

/** The Wave 2 Part C staff routes that have no home in an existing module: the permission matrix, the vendors list, the held count and the notes. The activity log is global. */
@Module({ imports: [PrismaModule], controllers: [AdminGapsController], providers: [{ provide: AdminGapsStore, useClass: PrismaAdminGapsStore }, AdminGapsService], exports: [AdminGapsService] })
export class V3AdminGapsModule {}
