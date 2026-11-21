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
import { resolveTrustProxy } from './common/trust-proxy';
import { assertLiveEnv } from './common/startup-check';

async function bootstrap(): Promise<void> {
  // The V3 live process (NODE_ENV=production and V3_LIVE=true, set by Dockerfile.v3live) refuses to boot with a missing or placeholder variable or a staging or test database. A no-op everywhere else.
  assertLiveEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const logger = new Logger('Bootstrap');

  // Behind nginx the socket address is the proxy's. `req.ip` (the rate-limit key) must be the real client address and must not be forgeable through X-Forwarded-For. TRUSTED_PROXIES (addresses and subnets)
  // says WHICH peers may set it; without it the older TRUST_PROXY_HOPS count (default 1) applies (common/trust-proxy.ts).
  const trust = resolveTrustProxy(process.env);
  app.set('trust proxy', trust.value);
  if (trust.rejected.length) logger.warn(`TRUSTED_PROXIES entries ignored (not an address, subnet or loopback, linklocal, uniquelocal): ${trust.rejected.join(', ')}`);
  logger.log(`Client address from X-Forwarded-For: ${trust.source === 'TRUSTED_PROXIES' ? `only from ${(trust.value as string[]).join(', ')}` : `${String(trust.value)} proxy hop(s) (${trust.source}); set TRUSTED_PROXIES to name the proxy`}`);

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
  // HOST (default 0.0.0.0, every address): in the live container the network is private and the host's nginx reaches it by the container address (docker-compose.v3live.yml).
  const host = process.env.HOST?.trim() || '0.0.0.0';
  await app.listen(port, host);
  logger.log(`Get4Domain API running on port ${port}`);
}

bootstrap();
