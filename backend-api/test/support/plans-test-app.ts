import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { JwtStrategy } from '../../src/auth/jwt.strategy';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import { ModuleGuard } from '../../src/common/guards/module.guard';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../../src/common/interceptors/transform.interceptor';
import { buildValidationPipe } from '../../src/common/pipes/edit-validation.pipe';
import { PlansModule } from '../../src/plans/plans.module';
import { PrismaModule } from '../../src/prisma/prisma.module';

/** A slim app with the real PlansModule, the real JWT strategy and the same global guards, pipe, interceptor and filter as main.ts. Requires ./staging-env first. */
export async function buildPlansTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [PrismaModule, PassportModule, PlansModule],
    providers: [JwtStrategy, { provide: APP_GUARD, useClass: JwtAuthGuard }, { provide: APP_GUARD, useClass: ModuleGuard }],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(buildValidationPipe());
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
  return app;
}
