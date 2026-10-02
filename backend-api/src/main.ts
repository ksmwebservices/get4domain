import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const logger = new Logger('Bootstrap');

  // Behind nginx the socket address is the proxy's. Trust exactly N proxy hops so `req.ip` (the rate-limit
  // key) is the real client address and cannot be forged through X-Forwarded-For. Override with TRUST_PROXY_HOPS.
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 1));

  // Local VM disk storage for uploaded images, served at /uploads/*.
  const uploadsDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });
  app.useStaticAssets(uploadsDir, { prefix: '/uploads/' });

  // Reflect the request origin (any) so the embeddable widget (3B) works from arbitrary
  // vendor domains. Safe: the API is Bearer-token authed (no cookie auth), so a random
  // origin cannot access authed data — CORS is not the auth boundary here.
  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Get4Domain API')
    .setDescription('Get4Domain backend API — vendors, subscriptions, invoices, payments, CMS, support')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ? Number(process.env.PORT) : 3008;
  await app.listen(port);
  logger.log(`Get4Domain API running on port ${port}`);
}

bootstrap();
