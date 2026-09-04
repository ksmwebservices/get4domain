import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CmsService } from '../cms/cms.service';
import { ActionRegistry } from './action-registry';
import { ActionContext, ActionDescriptor } from './engine.types';

/**
 * Dispatches an intent to its registered action, which calls INTO the existing
 * industry service. The engine's own responsibilities are exactly: resolve the
 * intent → validate the input against the SAME DTO the controller uses → forward
 * the vendorId unchanged → return the real service's result. It owns nothing
 * about how the booking/order/sale is persisted or priced.
 *
 * Two dispatch surfaces share ONE registry:
 *  - authenticated: the vendor's JWT supplies vendorId (any action).
 *  - public: an anonymous site visitor; vendorId is resolved from the site
 *    subdomain and only actions flagged `public` are allowed.
 */
@Injectable()
export class EngineService {
  constructor(
    private readonly registry: ActionRegistry,
    private readonly cms: CmsService,
  ) {}

  listActions(): ActionDescriptor[] {
    return this.registry.describe();
  }

  /** Public actions only — what a generated website may expose to visitors. */
  listPublicActions(): ActionDescriptor[] {
    return this.registry.describe().filter((a) => a.public);
  }

  /** Authenticated dispatch: vendorId comes from the caller's JWT. */
  async dispatch(intent: string, ctx: ActionContext, rawInput: unknown): Promise<unknown> {
    const action = this.registry.get(intent);
    if (!action) throw new NotFoundException(`Unknown engine action intent: ${intent}`);
    const input = await this.validateInput(action.inputType, rawInput);
    return action.execute(ctx, input);
  }

  /**
   * Public dispatch: resolve the vendor from the site subdomain and run the action
   * only if it is flagged public. vendorId is derived server-side from the resolved
   * site — never trusted from the client — preserving the tenant boundary for
   * anonymous callers.
   */
  async dispatchPublic(subdomain: string, intent: string, rawInput: unknown): Promise<unknown> {
    const action = this.registry.get(intent);
    if (!action) throw new NotFoundException(`Unknown engine action intent: ${intent}`);
    if (!action.public) throw new ForbiddenException(`Action '${intent}' is not available on public websites`);

    const site = await this.cms.getSiteBySubdomain(subdomain); // throws NotFound for missing/sandbox sites
    const ctx: ActionContext = {
      vendorId: site.vendor.id,
      user: { sub: site.vendor.id, email: '', role: 'PUBLIC', kind: 'public' },
    };
    const input = await this.validateInput(action.inputType, rawInput);
    return action.execute(ctx, input);
  }

  /**
   * Validate raw input against the action's DTO class, mirroring the global
   * ValidationPipe config (whitelist + forbidNonWhitelisted). `plainToInstance`
   * applies the DTO's `@Type` decorators so nested arrays (e.g. sale lines) are
   * built and recursively validated by `@ValidateNested`.
   */
  private async validateInput<T extends object>(type: new () => T, raw: unknown): Promise<T> {
    const instance = plainToInstance(type, raw ?? {});
    const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length) {
      const messages = errors.flatMap((e) => Object.values(e.constraints ?? {}));
      throw new BadRequestException(messages.length ? messages : 'Invalid action input');
    }
    return instance;
  }
}
