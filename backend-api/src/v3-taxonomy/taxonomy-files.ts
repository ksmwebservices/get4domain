import * as fs from 'fs';
import * as path from 'path';
import { TaxonomyFiles } from './taxonomy-loader';
import { AliasFile, MasterFile, RelatedFile } from './taxonomy-core';

/** backend-api/data: found by walking up, so it works from src (tests) and from dist (the loader script). Read from disk by the script and by tests; the core never touches the file system. */
function findDataDir(): string {
  let dir = __dirname;
  for (let i = 0; i < 8; i += 1, dir = path.dirname(dir)) { const c = path.join(dir, 'data'); if (fs.existsSync(path.join(c, 'category-master-45.json'))) return c; }
  throw new Error('backend-api/data/category-master-45.json was not found');
}
export const TAXONOMY_DATA_DIR = findDataDir();

export function readTaxonomyFiles(dir: string = TAXONOMY_DATA_DIR): TaxonomyFiles {
  const read = <T>(f: string): T => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as T;
  return {
    master: read<MasterFile>('category-master-45.json'),
    aliases: read<AliasFile>('category-master-45-aliases.json'),
    related: read<RelatedFile>('category-master-45-related.json'),
  };
}
