import { ArgumentsHost, ConflictException, ForbiddenException } from '@nestjs/common';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PLAN_ERROR_CODES, planError } from '../src/plans/plans.errors';

/** S51.4: the stable machine codes of the plans slice reach the client (with the upsell text) and nothing else leaks. */
function run(exception: unknown) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = { switchToHttp: () => ({ getResponse: () => ({ status }), getRequest: () => ({ method: 'POST', url: '/x' }) }) } as unknown as ArgumentsHost;
  new HttpExceptionFilter().catch(exception, host);
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0][0] as Record<string, unknown> };
}

describe('plan error codes', () => {
  it('lists the stable codes of the design note (the two GST rate codes added in Wave 4, TAX_RATE_IN_FORCE added in dispatch A3, and PLAN_NAME_INVALID, PRICE_NOT_APPROVED and PRICE_REASON_REQUIRED added with the plan rename and the price approval flow)', () => {
    expect([...PLAN_ERROR_CODES].sort()).toEqual([
      'FEATURE_IN_USE', 'FEATURE_LOCKED', 'FREE_PLAN_HAS_NO_PRICE', 'GST_RATE_EXISTS', 'GST_RATE_INVALID', 'INVALID_AMOUNT', 'INVALID_TERM', 'LIMIT_REACHED', 'PLAN_IN_USE', 'PLAN_NAME_INVALID', 'PRICE_DATE_INVALID', 'PRICE_DATE_IN_PAST', 'PRICE_NOT_APPROVED', 'PRICE_REASON_REQUIRED', 'PRICE_START_CLASH', 'REASON_REQUIRED', 'STALE_WRITE', 'TAX_RATE_IN_FORCE', 'UNKNOWN_PLAN', 'UNKNOWN_VENDOR',
    ]);
  });

  it('FEATURE_LOCKED reaches the client with the code, the feature and the upsell text', () => {
    const { status, body } = run(new ForbiddenException(planError('FEATURE_LOCKED', 'This feature is not part of your plan.', { feature: 'site.video', upsellText: 'Add video with Pro.' })));
    expect(status).toBe(403);
    expect(body.code).toBe('FEATURE_LOCKED');
    expect(body.message).toBe('This feature is not part of your plan.');
    expect(body.data).toMatchObject({ code: 'FEATURE_LOCKED', feature: 'site.video', upsellText: 'Add video with Pro.' });
  });

  it('LIMIT_REACHED and STALE_WRITE keep their code; PLAN_REQUIRED (existing) still works', () => {
    expect(run(new ForbiddenException(planError('LIMIT_REACHED', 'You have reached the limit.', { feature: 'site.services', limit: 8 }))).body.code).toBe('LIMIT_REACHED');
    expect(run(new ConflictException(planError('STALE_WRITE', 'Someone else changed this. Reload and try again.'))).body.code).toBe('STALE_WRITE');
    expect(run(new ForbiddenException({ message: 'x', code: 'PLAN_REQUIRED', feature: 'f', requiredPlan: 'PRO' })).body.code).toBe('PLAN_REQUIRED');
  });

  it('an unknown code is NOT passed through, and extra fields never leak', () => {
    const { body } = run(new ForbiddenException({ message: 'no', code: 'SOMETHING_ELSE', secret: 'hunter2', internal: 'C:\\x' }));
    expect(body.code).toBeUndefined();
    expect(JSON.stringify(body)).not.toMatch(/hunter2|C:\\\\x/);
  });
});
