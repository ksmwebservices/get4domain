/**
 * The seam between plan payments and wallet top-ups (Batch 4, slice 5.16a). Both are paid through the same Razorpay webhook. The webhook dispatch first looks for a PLAN order (unchanged,
 * slice 5.1b); only when there is none does it ask this hook whether the provider order is a wallet top-up. The wallet module provides the real one; without it nothing changes.
 */
export abstract class TopupSettlementHook {
  /** A verified, captured payment arrived whose provider order is not a plan order. Returns the result to record on the payment event, or null when it is not a top-up either. */
  abstract handleCapturedPayment(i: { providerOrderId: string; paymentId: string; amount: number; currency: string }): Promise<string | null>;
}
