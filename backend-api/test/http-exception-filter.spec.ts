import { ArgumentsHost, BadRequestException, ForbiddenException, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

/**
 * What a client may learn from an error response. Deliberate HttpExceptions keep their messages. Anything else (a Prisma error,
 * a thrown Error, a provider SDK object) must NEVER put server paths, SQL, Prisma invocation text or provider detail on the wire:
 * clients get a fixed sentence (and a reference id for 5xx), and the full detail goes to the server log under that same reference.
 */
const LEAK_NEEDLES = ['c:\\', '/app/', 'node_modules', 'prisma', 'invocation', 'invalid `', 'select ', 'insert ', 'foreign key', 'constraint', '.ts:', '.js:', 'password', 'stack'];

function run(exception: unknown, req: { method: string; url: string } = { method: 'DELETE', url: '/x/1' }) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = { switchToHttp: () => ({ getResponse: () => ({ status }), getRequest: () => req }) } as unknown as ArgumentsHost;
  new HttpExceptionFilter().catch(exception, host);
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0][0] as Record<string, unknown> };
}

const prismaError = (code: string, message = 'Invalid `this.prisma.contact.delete()` invocation in C:\\Get4Domain\\get4domain-site\\backend-api\\src\\domainapp\\contacts.service.ts:89:37\n\n  Foreign key constraint violated on the constraint: `Record_contactId_fkey`') =>
  new Prisma.PrismaClientKnownRequestError(message, { code, clientVersion: '6.19.3' });

const expectNoLeak = (body: Record<string, unknown>) => {
  const text = JSON.stringify(body).toLowerCase();
  for (const needle of LEAK_NEEDLES) expect({ needle, found: text.includes(needle) }).toEqual({ needle, found: false });
};

describe('HttpExceptionFilter', () => {
  let errorLog: jest.SpyInstance;
  let warnLog: jest.SpyInstance;
  beforeEach(() => {
    errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    warnLog = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  describe('Prisma errors become client errors with a fixed sentence', () => {
    it('P2003 (still referenced by other rows) -> 409', () => {
      const { status, body } = run(prismaError('P2003'));
      expect(status).toBe(409);
      expect(body).toMatchObject({ success: false, statusCode: 409 });
      expect(String(body.message)).toMatch(/still linked to other records/i);
      expectNoLeak(body);
    });
    it('P2014 (a required relation would be broken) -> 409', () => {
      expect(run(prismaError('P2014')).status).toBe(409);
    });
    it('P2002 (unique value already exists) -> 409', () => {
      const { status, body } = run(prismaError('P2002', 'Unique constraint failed on the fields: (`email`)'));
      expect(status).toBe(409);
      expect(String(body.message)).toMatch(/already exists/i);
      expectNoLeak(body);
    });
    it('P2025 (row not found) -> 404', () => {
      const { status, body } = run(prismaError('P2025', 'An operation failed because it depends on one or more records that were required but not found.'));
      expect(status).toBe(404);
      expectNoLeak(body);
    });
    it('an unmapped Prisma code -> generic 500 with a reference, never the Prisma text', () => {
      const { status, body } = run(prismaError('P1001', "Can't reach database server at `db.example.invalid:5432`"));
      expect(status).toBe(500);
      expect(body.message).toMatch(/something went wrong on our side/i);
      expectNoLeak(body);
      expect(JSON.stringify(body)).not.toContain('example.invalid');
    });
  });

  describe('everything else that is not a deliberate HttpException', () => {
    it('a thrown Error -> generic 500 + reference; the full detail is logged under the same reference', () => {
      const err = new Error('SELECT * FROM "g4d_x" WHERE password = $1 at /app/dist/src/x/y.service.js:12:9');
      const { status, body } = run(err);
      expect(status).toBe(500);
      const reference = (body.data as { reference: string }).reference;
      expect(reference).toMatch(/^[0-9a-f]{8}$/);
      expect(String(body.message)).toContain(reference);
      expectNoLeak(body);
      const logged = errorLog.mock.calls.map((c) => String(c[0])).join('\n');
      expect(logged).toContain(reference);
      expect(logged).toContain('SELECT * FROM');            // the operator still sees the real error
    });

    it('a provider SDK object (Razorpay-style) -> 502 and none of its description', () => {
      const raw = { statusCode: 400, error: { code: 'BAD_REQUEST_ERROR', description: 'The amount must be at least INR 1.00', field: 'amount' } };
      const { status, body } = run(raw);
      expect(status).toBe(502);
      expect(JSON.stringify(body)).not.toContain('INR 1.00');
      expect(body.message).toMatch(/provider/i);
      expect(errorLog.mock.calls.map((c) => String(c[0])).join('\n')).toContain('INR 1.00');
    });

    it('a thrown string or null -> generic 500', () => {
      for (const thing of ['boom at C:\\secret\\path.ts', null, undefined, 42]) {
        const { status, body } = run(thing);
        expect(status).toBe(500);
        expectNoLeak(body);
      }
    });

    it('two different failures get two different references', () => {
      const a = (run(new Error('a')).body.data as { reference: string }).reference;
      const b = (run(new Error('b')).body.data as { reference: string }).reference;
      expect(a).not.toBe(b);
    });

    it('keeps the response envelope: success, statusCode, message, data, timestamp', () => {
      const { body } = run(new Error('x'));
      expect(Object.keys(body).sort()).toEqual(['data', 'message', 'statusCode', 'success', 'timestamp']);
      expect(body.success).toBe(false);
      expect(Number.isNaN(Date.parse(String(body.timestamp)))).toBe(false);
    });
  });

  describe('deliberate HttpExceptions are untouched', () => {
    it('keeps a 404 message', () => {
      const { status, body } = run(new NotFoundException('Contact not found'));
      expect(status).toBe(404);
      expect(body.message).toBe('Contact not found');
    });
    it('keeps a 403 message', () => {
      expect(run(new ForbiddenException('You do not own this lead')).body.message).toBe('You do not own this lead');
    });
    it('keeps INSUFFICIENT_WALLET_BALANCE (other code and screens match on this text)', () => {
      const { status, body } = run(new BadRequestException('INSUFFICIENT_WALLET_BALANCE'));
      expect(status).toBe(400);
      expect(body.message).toBe('INSUFFICIENT_WALLET_BALANCE');
    });
    it('still turns validation arrays into one plain sentence with the field list', () => {
      const { status, body } = run(new BadRequestException(['name should not be empty']));
      expect(status).toBe(400);
      expect(String(body.message)).toMatch(/name is required/i);
      expect(body.data).toEqual({ fields: ['name'] });
    });
    it('keeps an intentional 503 as a 503 with Nest\'s own message (the /health/ready probe only needs the status code)', () => {
      // Characterises today's behaviour: the filter has never passed a structured object body through, only its status and message.
      const { status, body } = run(new ServiceUnavailableException({ status: 'not_ready', database: 'down' }));
      expect(status).toBe(503);
      expect(body.message).toBe('Service Unavailable Exception');
      expectNoLeak(body);
    });
    it('does not log client errors as server errors', () => {
      run(new NotFoundException('nope'));
      expect(errorLog).not.toHaveBeenCalled();
    });
  });

  it('logs mapped Prisma errors as warnings, with the Prisma code, not the full message', () => {
    run(prismaError('P2003'));
    expect(warnLog).toHaveBeenCalled();
    expect(String(warnLog.mock.calls[0][0])).toContain('P2003');
  });
});
