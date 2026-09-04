import { Injectable } from '@nestjs/common';
import { RestaurantService } from '../restaurant/restaurant.service';
import { RetailService } from '../retail/retail.service';
import { ActionContext, ActionDefinition, ActionDescriptor } from './engine.types';
import { BillOrderActionInput, CreateSaleDto } from './engine.dto';

/**
 * The Action Registry — the ONLY new persistence-adjacent code in the engine.
 *
 * Each entry holds REFERENCES, not logic: it points an industry-agnostic intent
 * at the real industry service method that already owns persistence, money math,
 * ownership guards and lifecycle side-effects (e.g. freeing a table, decrementing
 * stock in a transaction). The engine adds no parallel booking/ordering system.
 *
 * DEMONSTRABLE STUB: two intents are wired end-to-end to validate the pattern
 * before committing to the full 20-industry registry. Adding an industry action
 * is a ~3-line `register(...)` call pointing at its existing service method.
 */
@Injectable()
export class ActionRegistry {
  private readonly actions = new Map<string, ActionDefinition>();

  constructor(
    private readonly restaurant: RestaurantService,
    private readonly retail: RetailService,
  ) {
    // ── restaurant.bill_order → RestaurantService.billOrder (POST /restaurant/orders/:id/bill)
    this.register<BillOrderActionInput>({
      intent: 'restaurant.bill_order',
      industry: 'restaurant',
      delegatesTo: 'POST /restaurant/orders/:id/bill',
      description: 'Close a restaurant order, capture the payment method and free its table.',
      inputType: BillOrderActionInput,
      execute: (ctx, input) =>
        this.restaurant.billOrder(ctx.vendorId, input.orderId, { paymentMethod: input.paymentMethod }),
    });

    // ── retail.create_sale → RetailService.createSale (POST /retail/sales)
    this.register<CreateSaleDto>({
      intent: 'retail.create_sale',
      industry: 'retail',
      delegatesTo: 'POST /retail/sales',
      description: 'Ring up a retail sale: validate stock, decrement inventory and write the receipt atomically.',
      inputType: CreateSaleDto,
      execute: (ctx, input) => this.retail.createSale(ctx.vendorId, input),
    });
  }

  /** Register one action. Duplicate intents are a programming error. */
  private register<TInput extends object>(def: ActionDefinition<TInput>): void {
    if (this.actions.has(def.intent)) {
      throw new Error(`Duplicate engine action intent: ${def.intent}`);
    }
    this.actions.set(def.intent, def as unknown as ActionDefinition);
  }

  get(intent: string): ActionDefinition | undefined {
    return this.actions.get(intent);
  }

  /** Registered actions as descriptors (no executors) — for introspection/UI. */
  describe(): ActionDescriptor[] {
    return [...this.actions.values()].map(({ intent, industry, delegatesTo, description }) => ({
      intent,
      industry,
      delegatesTo,
      description,
    }));
  }
}
