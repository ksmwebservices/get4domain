import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/** Liveness/readiness probes. PrismaService comes from the global PrismaModule. */
@Module({ controllers: [HealthController] })
export class HealthModule {}
