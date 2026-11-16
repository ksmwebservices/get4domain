import { FirmProfile } from './core/firm-core';

/** The one firm profile row. `get` is null only before the migration's first row exists; the service then answers the defaults. */
export abstract class FirmStore {
  abstract get(): Promise<FirmProfile | null>;
  /** Writes the fields in the patch to the single row (creating it from the defaults if it is missing) and returns the row as stored. */
  abstract update(patch: Partial<FirmProfile>, staffId: string | null): Promise<FirmProfile>;
}
