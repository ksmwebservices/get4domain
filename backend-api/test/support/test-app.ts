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
import { CrmModule } from '../../src/crm/crm.module';
import { DomainAppModule } from '../../src/domainapp/domainapp.module';
import { NotificationsModule } from '../../src/notifications/notifications.module';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { StockModule } from '../../src/stock/stock.module';
import { VendorPaymentsModule } from '../../src/vendor-payments/vendor-payments.module';

/**
 * A slim copy of the real app: the real controllers/services for the families under test, the real JWT strategy and the
 * same two global guards, pipe, interceptor and filter as main.ts/app.module.ts. Deliberately NOT AppModule and NOT
 * ConfigModule (which would load .env.local = production credentials). Requires ./staging-env to have run first.
 */
export async function buildTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [PrismaModule, PassportModule, CrmModule, DomainAppModule, NotificationsModule, StockModule, VendorPaymentsModule],
    providers: [
      JwtStrategy,
      { provide: APP_GUARD, useClass: JwtAuthGuard },
      { provide: APP_GUARD, useClass: ModuleGuard },
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(buildValidationPipe());
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
  return app;
}
