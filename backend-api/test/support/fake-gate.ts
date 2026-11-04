import { PaymentsGate } from '../../src/plan-billing/razorpay/payments-gate';
import { RazorpayPort } from '../../src/plan-billing/razorpay/razorpay.port';
import { FakeRazorpay } from './fake-razorpay';

/** The real PaymentsGate rules (off / test / live), with the fake provider in place of the network adapter. Used by the unit worlds and by the staging suites (which never use a real provider). */
export class FakeGate extends PaymentsGate {
  constructor(settings: never, readonly fake: FakeRazorpay) { super(settings); }
  protected build(): RazorpayPort | null { return this.fake; }
}
