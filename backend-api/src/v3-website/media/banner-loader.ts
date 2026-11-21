import { extFor, ExistingBanner, planBannerLoad, validateManifest } from '../core/media-core';
import { ImagePort, MediaStoragePort, sha256Hex } from './media.ports';
import { MediaStore } from './media.store';

/**
 * The Banner Library loader (slice 5.5b). Idempotent and safe: a DRY RUN unless `apply` is true; a manifest with any error loads NOTHING; an image with no manifest row is refused;
 * an image already loaded for its category is left alone (its licence data is updated if the manifest changed); nothing is ever deleted. Claude Code never downloads images: the owner's team
 * supplies the folder and the manifest. Images are re-encoded (metadata dropped) before they are hashed and stored, so the same picture is recognised on a second run.
 */
export interface LoaderFile { name: string; bytes: Buffer }
export interface LoaderInput { files: LoaderFile[]; manifest: unknown; categories: string[]; today: string; maxPixels: number | null; apply: boolean }
export interface LoaderReport {
  applied: boolean; errors: string[]; created: string[]; updated: string[]; unchanged: string[];
  refused: Array<{ file: string; reason: string }>; rowsWithoutFile: string[];
}

export async function runBannerLoad(d: { store: MediaStore; storage: MediaStoragePort; image: ImagePort }, i: LoaderInput): Promise<LoaderReport> {
  const empty = (errors: string[]): LoaderReport => ({ applied: false, errors, created: [], updated: [], unchanged: [], refused: [], rowsWithoutFile: [] });
  if (i.maxPixels === null) return empty(['Set the plan setting mediaMaxPixels first: it protects the server while pictures are read.']);
  const { rows, errors } = validateManifest(i.manifest, i.categories, i.today);
  if (errors.length) return empty(errors);

  const refused: LoaderReport['refused'] = [];
  const prepared: Array<{ name: string; sha256: string; bytes: Buffer; contentType: string; width: number; height: number }> = [];
  for (const f of i.files) {
    try { const r = await d.image.reencode(f.bytes, { maxPixels: i.maxPixels }); prepared.push({ name: f.name, sha256: sha256Hex(r.bytes), bytes: r.bytes, contentType: r.contentType, width: r.width, height: r.height }); }
    catch { refused.push({ file: f.name, reason: 'UNREADABLE' }); }
  }
  const existing: ExistingBanner[] = (await d.store.listBanners({})).map((b) => ({ categoryId: b.categoryId, sha256: b.sha256, author: b.author, licenceName: b.licenceName, sourceUrl: b.sourceUrl, obtainedOn: b.obtainedOn, altText: b.altText, hasPeople: b.hasPeople }));
  const plan = planBannerLoad(prepared, rows, existing);
  const report: LoaderReport = { applied: i.apply, errors: [], created: plan.create.map((c) => c.file), updated: plan.update.map((u) => u.file), unchanged: plan.unchanged.map((u) => u.file), refused: [...refused, ...plan.refused], rowsWithoutFile: plan.rowsWithoutFile };
  if (!i.apply) return report;

  const byName = new Map(prepared.map((p) => [p.name, p]));
  for (const item of [...plan.create, ...plan.update]) {
    const p = byName.get(item.file)!; const row = item.row;
    const path = `banner-library/${row.category}/${p.sha256}.${extFor(p.contentType)}`;
    const url = plan.create.includes(item) ? await d.storage.put(path, p.bytes, p.contentType) : (await d.store.listBanners({ categoryId: row.category })).find((b) => b.sha256 === p.sha256)?.url ?? '';
    await d.store.upsertBanner({ categoryId: row.category, storagePath: path, url, contentType: p.contentType, bytes: p.bytes.length, width: p.width, height: p.height, altText: row.alt, hasPeople: row.hasPeople, sourceUrl: row.sourceUrl, author: row.author, licenceName: row.licence, obtainedOn: row.obtainedOn, sha256: p.sha256 });
  }
  return report;
}
