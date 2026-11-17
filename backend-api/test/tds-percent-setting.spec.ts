import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { buildValidationPipe } from '../src/common/pipes/edit-validation.pipe';
import { PutPlanSettingDto } from '../src/plans/admin/dto/plans-admin.dto';
import { validateSettingValue } from '../src/plans/admin/admin-validation';

/**
 * PUT /v3/admin/plan-settings/tdsPercent, through the REAL path: the app-wide strict ValidationPipe on PutPlanSettingDto (whitelist + forbidNonWhitelisted),
 * then the per-key validator the service runs. The staging test got a 400 for { valueJson: 10 } because the DTO field had no decorator, so the pipe refused the body.
 */
const meta: ArgumentMetadata = { type: 'body', metatype: PutPlanSettingDto, data: '' };
const pipe = buildValidationPipe();
const through = async (body: unknown): Promise<PutPlanSettingDto> => (await pipe.transform(body, meta)) as PutPlanSettingDto;
/** the body passes the pipe, then the service-side validator for the key */
const accepts = async (value: unknown): Promise<void> => { const dto = await through({ valueJson: value }); validateSettingValue('tdsPercent', dto.valueJson); };

describe('the plan-settings body and the tdsPercent value', () => {
  it('the strict pipe keeps valueJson for every shape (it used to refuse the whole body)', async () => {
    for (const v of [10, 0, 7.5, true, 'x', [1, 2], null]) expect((await through({ valueJson: v })).valueJson).toEqual(v);
    expect((await through({ valueJson: 10, description: 'CA rate', expectedUpdatedAt: '2026-01-01T00:00:00.000Z' })).valueJson).toBe(10);
  });
  it('an unknown extra key is still refused by the pipe', async () => {
    await expect(through({ valueJson: 10, role: 'SUPER_ADMIN' })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('accepts 10 (an integer), 0, 100 and 7.25', async () => {
    for (const v of [10, 0, 100, 7.25]) await expect(accepts(v)).resolves.toBeUndefined();
  });
  it('refuses 101, -1, 7.255, a string, a boolean, a list, null, NaN and a missing value with the key in the message', async () => {
    for (const v of [101, -1, 7.255, '10', true, [10], null, Number.NaN]) await expect(accepts(v)).rejects.toThrow(/tdsPercent/);
    expect(() => validateSettingValue('tdsPercent', undefined)).toThrow(/tdsPercent/);
  });
});
