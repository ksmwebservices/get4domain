import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ActionRegistry } from './action-registry';
import { ActionContext, ActionDescriptor } from './engine.types';

/**
 * Dispatches an intent to its registered action, which calls INTO the existing
 * industry service. The engine's own responsibilities are exactly: resolve the
 * intent → validate the input against the SAME DTO the controller uses → forward
 * the vendorId unchanged → return the real service's result. It owns nothing
 * about how the booking/order/sale is persisted or priced.
 */
@Injectable()
export class EngineService {
  constructor(private readonly registry: ActionRegistry) {}

  listActions(): ActionDescriptor[] {
    return this.registry.describe();
  }

  async dispatch(intent: string, ctx: ActionContext, rawInput: unknown): Promise<unknown> {
    const action = this.registry.get(intent);
    if (!action) throw new NotFoundException(`Unknown engine action intent: ${intent}`);
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
