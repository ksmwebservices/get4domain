import * as fs from 'fs';
import * as path from 'path';
import { ArgumentsHost, ConflictException } from '@nestjs/common';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

/**
 * The staging run (Batch 11, Stage 15) found what the service-level unit tests cannot see because they bypass the HTTP layer: the exception filter passes a `code` through only when it is on a
 * registered list, and the registrar, identity and connection code lists had never been added. A client got the right status and NO code (the screens switch on `code`).
 * This guard reads every code the new modules put into an HTTP error body and sends each one through the REAL filter: a code that is thrown but not passed through fails here, in the unit gate.
 * (Internal errors such as RegistrarError / CloudflareError / DocCryptoError are mapped by the services and never reach the filter, so they are not scanned.)
 */
const MODULES = ['v3-registrar', 'v3-domain-automation'];
const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : []));

function passThrough(code: string): unknown {
  let body: Record<string, unknown> = {};
  const res = { status: () => ({ json: (b: Record<string, unknown>) => { body = b; } }) };
  const host = { switchToHttp: () => ({ getResponse: () => res, getRequest: () => ({ method: 'POST', url: '/v3/test', headers: {} }) }) } as unknown as ArgumentsHost;
  new HttpExceptionFilter().catch(new ConflictException({ message: 'x', code }), host);
  return body.code;
}

describe('Domain modules wiring (HTTP layer)', () => {
  it('every error code the registrar, identity and connection services put in an HTTP error body is passed through by the exception filter', () => {
    const thrown = new Set<string>();
    for (const mod of MODULES) {
      for (const f of walk(path.resolve(__dirname, '../src', mod))) {
        const text = fs.readFileSync(f, 'utf8');
        // the modules' own `err('CODE', ...)` helpers, plus the shared plan and wallet helpers they call
        for (const m of text.matchAll(/(?<![A-Za-z])(?:err|planError|walletError)\(\s*'([A-Z][A-Z0-9_]{4,})'/g)) thrown.add(m[1]);
      }
    }
    expect(thrown.size).toBeGreaterThan(30);
    const dropped = [...thrown].filter((c) => passThrough(c) !== c);
    expect(dropped).toEqual([]);
  });

  it('the filter really does drop a code that is not registered (so the guard above can fail)', () => {
    expect(passThrough('NOT_A_REGISTERED_CODE_XYZ')).toBeUndefined();
  });
});
