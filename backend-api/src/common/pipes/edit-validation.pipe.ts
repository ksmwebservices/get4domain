import { ArgumentMetadata, PipeTransform, Type, ValidationPipe, ValidationPipeOptions } from '@nestjs/common';
import { getMetadataStorage } from 'class-validator';

/**
 * Keys that a record carries but that nobody edits through a form: identity and bookkeeping (id, vendorId, createdAt, updatedAt, deletedAt) and a few
 * columns the server derives or sets itself. A screen that loads a record and sends it back (Bug B1: the Website Manager) echoes them, and the strict
 * whitelist used to refuse the whole save with "property id should not exist".
 *
 * For an EDIT body (a DTO whose class is called Update*, Patch* or Edit*) these keys are dropped when the DTO does not list them itself. Everything
 * else stays strict: an unknown key such as `role` is still refused with a message, and a DTO that does accept one of these keys keeps it.
 */
export const ECHOED_READ_ONLY_KEYS: readonly string[] = [
  'id', 'vendorId', 'createdAt', 'updatedAt', 'deletedAt',
  'createdBy', 'nameNormalized', 'openingBalancePaise', 'deliveredAt', 'lastBilledPeriod',
];

const EDIT_DTO = /^(Update|Patch|Edit)[A-Z]/;

export function stripEchoedKeys(value: unknown, metatype: Type<unknown> | undefined): unknown {
  if (!metatype || !EDIT_DTO.test(metatype.name) || !value || typeof value !== 'object' || Array.isArray(value)) return value;
  const accepted = new Set(getMetadataStorage().getTargetValidationMetadatas(metatype, undefined as unknown as string, false, false).map((m) => m.propertyName));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (ECHOED_READ_ONLY_KEYS.includes(k) && !accepted.has(k)) continue;
    out[k] = v;
  }
  return out;
}

/** The app-wide validation pipe: the same strict whitelist as before, tolerant only of echoed read-only keys on edit bodies. */
export class EditTolerantValidationPipe extends ValidationPipe implements PipeTransform {
  override async transform(value: unknown, metadata: ArgumentMetadata): Promise<unknown> {
    const v = metadata.type === 'body' ? stripEchoedKeys(value, metadata.metatype as Type<unknown> | undefined) : value;
    return super.transform(v, metadata);
  }
}

export const buildValidationPipe = (extra: ValidationPipeOptions = {}): EditTolerantValidationPipe =>
  new EditTolerantValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true, ...extra });
