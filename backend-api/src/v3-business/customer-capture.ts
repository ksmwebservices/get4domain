import { CustomersService } from '../v3-customers/customers.service';

/** Puts a person on the business's one customer list (slice 5.23a). Returns the customer id, or null when the person cannot be recognised. Shared by jobs, appointments and the store. */
export abstract class CustomerCapture { abstract capture(vendorId: string, i: { name: string; phone: string; refType: string; refId: string }): Promise<string | null> }

/** A person met through a job, an appointment or an order goes on the customer list with the source MANUAL (the business entered them). */
export const customerCaptureFor = (customers: Pick<CustomersService, 'capture'>): CustomerCapture => ({
  async capture(vendorId, i) {
    try { return (await customers.capture(vendorId, { name: i.name, phone: i.phone, source: 'MANUAL', refType: i.refType, refId: i.refId })).customer.id; } catch { return null; }   // an unreadable phone leaves the record without a customer link; the record itself stands
  },
});
