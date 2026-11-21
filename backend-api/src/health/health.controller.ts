import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

/** How long the readiness probe waits for the database before reporting "not ready". */
export const READY_DB_TIMEOUT_MS = 2000;

export interface LivenessBody {
  status: 'ok';
  uptimeSeconds: number;
}

export interface ReadinessBody {
  status: 'ready';
  database: 'up';
  version: string;
  commit: string;
}

/**
 * Health endpoints for Docker/uptime probes. Public and un-throttled, and they never return secrets,
 * connection details or error messages.
 *   GET /health        liveness: the process is up (no database call)
 *   GET /health/ready  readiness: the database answers `SELECT 1` within READY_DB_TIMEOUT_MS
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @SkipThrottle()
  @Get()
  @ApiOperation({ summary: 'Liveness probe: the API process is running' })
  live(): LivenessBody {
    return { status: 'ok', uptimeSeconds: Math.round(process.uptime()) };
  }

  @Public()
  @SkipThrottle()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe: the database is reachable' })
  async ready(): Promise<ReadinessBody> {
    let timer: NodeJS.Timeout | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), READY_DB_TIMEOUT_MS);
      });
      await Promise.race([this.prisma.$queryRaw`SELECT 1`, timeout]);
    } catch {
      // Deliberately generic: the reason (host, credentials, driver text) must not reach the caller.
      throw new ServiceUnavailableException({ status: 'not_ready', database: 'down' });
    } finally {
      if (timer) clearTimeout(timer);
    }
    return {
      status: 'ready',
      database: 'up',
      version: process.env.APP_VERSION ?? 'unknown',
      commit: process.env.GIT_COMMIT ?? 'unknown',
    };
  }
}
