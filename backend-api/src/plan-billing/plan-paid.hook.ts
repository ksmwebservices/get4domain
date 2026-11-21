/**
 * What happens AFTER a plan payment is committed or reversed, as far as other modules care (Wave 3 Part I). The settlement calls it best effort and never lets it block or undo a payment:
 * the referral module makes a commission line on a vendor's FIRST paid plan payment (gateway or admin-confirmed cash) and marks it REVERSED when that payment is reversed.
 * An abstract class, so billing imports nothing from the referral module (no import cycle); absent = nobody is told.
 */
export interface PlanPaidInfo { vendorId: string; orderId: string; paidAt: Date; via: string }
export interface PlanReversedInfo { vendorId: string; orderId: string; reason: string }
export abstract class PlanPaidHook {
  abstract onPlanPaid(i: PlanPaidInfo): Promise<void>;
  abstract onPaymentReversed(i: PlanReversedInfo): Promise<void>;
}
