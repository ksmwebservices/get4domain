import * as fs from 'fs';
import * as path from 'path';
import { ArgumentsHost, ConflictException } from '@nestjs/common';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { MODULES } from './b13-isolation.spec';

/**
 * The lesson of the Stage 13 and Stage 15 staging runs, applied to this batch before staging: the exception filter passes a body `code` through only when it is on a registered list, and a
 * service-level unit test never sees the HTTP layer. This guard reads every code the Batch 13 modules put in an HTTP error body and sends each one through the REAL filter; a code that is thrown but
 * not passed through fails here. (Internal errors that a service maps itself never reach the filter and are not scanned.)
 */
const walk = (dir: string): string[] => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : [])) : []);

function passThrough(code: string): unknown {
  let body: Record<string, unknown> = {};
  const res = { status: () => ({ json: (b: Record<string, unknown>) => { body = b; } }) };
  const host = { switchToHttp: () => ({ getResponse: () => res, getRequest: () => ({ method: 'POST', url: '/v3/test', headers: {} }) }) } as unknown as ArgumentsHost;
  new HttpExceptionFilter().catch(new ConflictException({ message: 'x', code }), host);
  return body.code;
}

describe('Batch 13 modules wiring (HTTP layer)', () => {
  it('every error code the business modules put in an HTTP error body is passed through by the exception filter', () => {
    const thrown = new Set<string>();
    for (const mod of MODULES) {
      for (const f of walk(path.resolve(__dirname, '../src', mod))) {
        if (f.endsWith('.errors.ts')) continue;
        const text = fs.readFileSync(f, 'utf8');
        for (const m of text.matchAll(/(?<![A-Za-z])(?:\w*[eE]rror|err)\(\s*(?:\d{3},\s*)?'([A-Z][A-Z0-9_]{4,})'/g)) thrown.add(m[1]);
      }
    }
    expect(thrown.size).toBeGreaterThan(3);
    expect([...thrown].filter((c) => passThrough(c) !== c)).toEqual([]);
  });
  it('the filter really does drop a code that is not registered (so the guard above can fail)', () => { expect(passThrough('NOT_A_REGISTERED_CODE_XYZ')).toBeUndefined(); });
});
