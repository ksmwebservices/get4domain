import * as fs from 'fs';
import * as path from 'path';
import { PackEngineSettings } from '../core/pack-core';
import { SeedSources } from './pack-seed';

/** Where the data sheets and the settings file live (backend-api/prisma/seed/pack-engine). Read from disk by the loader script and by tests; the pure core never touches the file system. */
function findSeedDir(): string {
  let dir = __dirname;
  for (let i = 0; i < 8; i += 1, dir = path.dirname(dir)) { const c = path.join(dir, 'prisma/seed/pack-engine'); if (fs.existsSync(c)) return c; }
  throw new Error('prisma/seed/pack-engine was not found');
}
export const PACK_SEED_DIR = findSeedDir();

export function readSeedSources(dir: string = PACK_SEED_DIR): SeedSources {
  const read = (f: string): string => fs.readFileSync(path.join(dir, f), 'utf8');
  return {
    settings: JSON.parse(read('pack-engine-settings.json')) as PackEngineSettings,
    packSummaryCsv: read('PACK_SUMMARY_V1.csv'),
    categoryMasterCsv: read('CATEGORY_MASTER_V3_ADMIN_REGISTRATION.csv'),
    categoryMapCsv: read('CATEGORY_TO_PACK_MAP_V1.csv'),
  };
}
