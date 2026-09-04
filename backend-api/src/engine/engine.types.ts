import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

/**
 * The tenant + principal context every engine action executes under.
 *
 * `vendorId` is carried through UNCHANGED from the JWT (`u.sub`) — the same
 * multi-tenant boundary the industry controllers enforce. The engine never
 * derives, defaults or overrides it; it only forwards it into the real service.
 */
export interface ActionContext {
  vendorId: string;
  user: AuthenticatedUser;
}

/**
 * Human/UI-facing metadata for a registered action. `delegatesTo` records the
 * real REST route this intent maps to, so the UI and audit log can show the
 * provenance of every engine action (it is not a parallel implementation).
 */
export interface ActionDescriptor {
  /** Industry-agnostic intent, namespaced by industry, e.g. `restaurant.bill_order`. */
  intent: string;
  industry: string;
  /** The existing backend route this intent delegates into. Provenance only. */
  delegatesTo: string;
  description: string;
  /**
   * Whether an ANONYMOUS public-website visitor may fire this action (vendorId is
   * resolved from the site subdomain, not a JWT). Inbound lead-capture actions
   * (enquiry, booking, appointment) are public; anything that moves the vendor's
   * money or inventory (bill_order, create_sale) is NEVER public — vendor JWT only.
   */
  public?: boolean;
}

/**
 * A registered action: descriptor metadata + the input DTO class it validates
 * against (the SAME DTO the controller uses) + an executor that calls INTO the
 * existing industry service.
 */
export interface ActionDefinition<TInput extends object = object, TResult = unknown>
  extends ActionDescriptor {
  /** DTO class the raw input is validated against before dispatch. */
  readonly inputType: new () => TInput;
  execute(ctx: ActionContext, input: TInput): Promise<TResult>;
}
