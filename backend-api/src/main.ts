import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { buildValidationPipe } from './common/pipes/edit-validation.pipe';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { existsSync, mkdirSync } from 'fs';
import { AppModule } from './app.module';
import { uploadsDir, uploadsStaticOptions } from './uploads/uploads.util';
import { buildCorsOptions } from './common/cors';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const logger = new Logger('Bootstrap');

  // Behind nginx the socket address is the proxy's. Trust exactly N proxy hops so `req.ip` (the rate-limit
  // key) is the real client address and cannot be forged through X-Forwarded-For. Override with TRUST_PROXY_HOPS.
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 1));

  // Local VM disk storage for uploaded images, served at /uploads/*.
  const publicUploads = uploadsDir();
  if (!existsSync(publicUploads)) mkdirSync(publicUploads, { recursive: true });
  app.useStaticAssets(publicUploads, uploadsStaticOptions);

  // Default: reflect the request origin (any) so the embeddable widget (3B) works from arbitrary
  // vendor domains. Safe: the API is Bearer-token authed (no cookie auth), so a random
  // origin cannot access authed data — CORS is not the auth boundary here.
  // CORS_MODE=strict + CORS_EXTRA_ORIGINS=<comma list> restricts it to the platform and the listed custom domains (common/cors.ts).
  app.enableCors(buildCorsOptions());

  app.useGlobalPipes(
    buildValidationPipe(),
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
