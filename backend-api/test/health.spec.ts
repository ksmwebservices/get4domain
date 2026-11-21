import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { IS_PUBLIC_KEY } from '../src/common/decorators/public.decorator';
import { HealthController } from '../src/health/health.controller';
import { PrismaService } from '../src/prisma/prisma.service';

describe('GET /health and /health/ready', () => {
  let app: INestApplication;
  const queryRaw = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: { $queryRaw: queryRaw } }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => { await app.close(); });
  beforeEach(() => { queryRaw.mockReset(); });

  it('liveness answers 200 without touching the database', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptimeSeconds).toBe('number');
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('readiness answers 200 when the database answers', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    const res = await request(app.getHttpServer()).get('/health/ready').expect(200);
    expect(res.body).toMatchObject({ status: 'ready', database: 'up' });
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('readiness answers 503 and leaks nothing when the database fails', async () => {
    queryRaw.mockRejectedValue(new Error('password authentication failed for user "app" at host db.secret-project.supabase.co:5432'));
    const res = await request(app.getHttpServer()).get('/health/ready').expect(503);
    const body = JSON.stringify(res.body).toLowerCase();
    expect(res.body).toMatchObject({ status: 'not_ready', database: 'down' });
    for (const leak of ['password', 'supabase', 'secret-project', 'postgres', 'app"']) expect(body).not.toContain(leak);
  });

  it('readiness answers 503 when the database hangs (timeout)', async () => {
    queryRaw.mockReturnValue(new Promise(() => { /* never settles */ }));
    await request(app.getHttpServer()).get('/health/ready').expect(503);
  }, 10000);

  it('both routes are marked @Public (no JWT needed)', () => {
    const proto = HealthController.prototype;
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, proto.live)).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, proto.ready)).toBe(true);
  });
});
