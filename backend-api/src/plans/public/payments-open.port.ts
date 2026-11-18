/** The public pricing page asks "can a vendor pay online right now?" through this token, so the plans module does not import the billing module. Absent (a unit test of one module): the answer is false. */
export const PAYMENTS_OPEN = Symbol('PAYMENTS_OPEN');
export interface PaymentsOpenPort { isOpen(): Promise<boolean> }
