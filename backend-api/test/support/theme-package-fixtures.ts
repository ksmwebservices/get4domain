/* eslint-disable @typescript-eslint/no-require-imports */
import * as path from 'path';
import { loadKit, rendererDir } from '../../src/site-publish/renderer/renderer-loader';

/**
 * Real theme packages for the marketplace tests: a library theme of the kit, re-id'd, with a marketplace block, packed by the kit's own packer. Nothing is faked: the validator and the lint see real templates.
 */
type Packer = { packFiles(files: Record<string, Buffer>): { zip: Buffer } };
const kit = loadKit();
const { packFiles } = require(path.join(rendererDir(), 'lib', 'pack.cjs')) as Packer;
const { writeZip } = require(path.join(rendererDir(), 'lib', 'zip.cjs')) as { writeZip(e: Array<{ path: string; data: Buffer }>, o?: { allowUnsafePaths?: boolean }): Buffer };

export const MARKET = { packs: ['HOSPITALITY_EVENTS', 'FOOD_SERVICE'], addons: ['ONLINE_ORDERING_DELIVERY'], capabilities: [] as string[], tags: ['restaurant-plus-delivery'], catalogueCategories: [] as string[], licence: 'Built by the Get4Domain team for the marketplace.', starter: true, sourceVendorId: null as string | null };
export const buf = (s: string): Buffer => Buffer.from(s, 'utf8');

export function themeFiles(over: Record<string, unknown> = {}, id = 'tm1-test-hospitality'): Record<string, Buffer> {
  const files = kit.readThemeDir(path.join(rendererDir(), 'library', 'free-hospitality'));
  const m = JSON.parse(files['theme.json'].toString('utf8')) as Record<string, unknown>;
  delete m.contentHash; delete m.assets;
  Object.assign(m, { id, name: `TM1 test ${id}`, marketplace: MARKET, ...over });
  return { ...files, 'theme.json': buf(JSON.stringify(m, null, 2)) };
}
export const zipOf = (files: Record<string, Buffer>): Buffer => packFiles(files).zip;
export const goodZip = (over: Record<string, unknown> = {}, id = 'tm1-test-hospitality'): Buffer => zipOf(themeFiles(over, id));
/** a zip the kit's packer would not write (unsafe path), for refusal tests */
export const unsafeZip = (): Buffer => writeZip(Object.entries({ ...themeFiles(), '../evil.html': buf('x') }).map(([p, data]) => ({ path: p, data })), { allowUnsafePaths: true });
/** the same package with a script added to the home template: the kit lint refuses it */
export const scriptZip = (id = 'tm1-test-hospitality'): Buffer => { const f = themeFiles({}, id); f['templates/home.html'] = buf(`${f['templates/home.html'].toString('utf8')}\n<script>alert(1)</script>`); return zipOf(f); };
