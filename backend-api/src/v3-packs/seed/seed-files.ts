import * as fs from 'fs';
import * as path from 'path';
import { PackEngineSettings } from '../core/pack-core';
import { SeedSources } from './pack-seed';

/** Where the data sheets and the settings file live (backend-api/prisma/seed/pack-engine). Read from disk by the loader script and by tests; the pure core never touches the file system. */
export const PACK_SEED_DIR = path.resolve(__dirname, '../../../../prisma/seed/pack-engine');

export function readSeedSources(dir: string = PACK_SEED_DIR): SeedSources {
  const read = (f: string): string => fs.readFileSync(path.join(dir, f), 'utf8');
  return {
    settings: JSON.parse(read('pack-engine-settings.json')) as PackEngineSettings,
    packSummaryCsv: read('PACK_SUMMARY_V1.csv'),
    categoryMasterCsv: read('CATEGORY_MASTER_V3_ADMIN_REGISTRATION.csv'),
    categoryMapCsv: read('CATEGORY_TO_PACK_MAP_V1.csv'),
  };
}
