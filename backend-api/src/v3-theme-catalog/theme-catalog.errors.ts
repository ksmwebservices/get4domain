import { HttpException } from '@nestjs/common';

/** Stable machine codes of the theme catalogue (Wave 3 Part H). Registered with the exception filter through BUSINESS_ERROR_CODES. */
export const THEME_CATALOG_ERROR_CODES = ['THEME_PACK_NOT_FOUND'] as const;
export const packNotFound = (): HttpException => new HttpException({ message: 'That pack does not exist.', code: 'THEME_PACK_NOT_FOUND' }, 404);
