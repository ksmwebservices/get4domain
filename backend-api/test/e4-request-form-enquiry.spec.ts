import { collectAnswers } from '../src/requests-orders/enquiry-form.service';
import { enquiryWorld } from './support/enquiry-world';
import { HOST_A, requestsWorld, RW } from './support/requests-world';

/** S1 shell: the request sheet's answers are checked against the business's own questions and stored with the lead, with the chosen item. */
jest.setTimeout(60_000);
const form = (over: Record<string, unknown> = {}) => ({ name: 'Meena R', phone: '98765 43210', message: 'Please come', consent: 'on', source: 'request-sheet', ...over });
const code = async (p: Promise<unknown>): Promise<string> => { try { await p; return 'OK'; } catch (e) { const r = (e as { response?: { code?: string } }).response; return r?.code ?? `HTTP${(e as { status?: number }).status}`; } };

async function make(industry: string | null) {
  const w: RW = await requestsWorld();
  const world = enquiryWorld(w);
  (world.svc as unknown as { prisma: unknown }).prisma = { vendor: { findUnique: async () => ({ industry }) } };
  return { w, ...world };
}
type Stored = { payload?: Record<string, unknown>; payloadJson?: Record<string, unknown>; kind: string };
const payloadOf = (r: Stored): Record<string, unknown> => (r.payload ?? r.payloadJson ?? {}) as Record<string, unknown>;

describe('the request sheet answers', () => {
  it('a plumber: address and time are stored on the lead and shown in the vendor inbox copy', async () => {
    const { w, svc, inboxStore } = await make('plumber');
    const r = await svc.enquire(HOST_A, form({ f_address: '12 Market Road', f_when: 'Today', f_problem: 'Leak' }), '1.1.1.1');
    expect(r).toMatchObject({ received: true });
    const req = [...w.store.requests.values()][0] as unknown as Stored;
    expect(req.kind).toBe('ENQUIRY');
    expect(payloadOf(req)).toMatchObject({ message: 'Please come', answers: { address: '12 Market Road', when: 'Today', problem: 'Leak' } });
    expect(inboxStore.rows[0].bodyText).toContain('Address where the work is needed: 12 Market Road');
    expect(inboxStore.rows[0].bodyText).toContain('When do you need us?: Today');
  });

  it('a required question that is not answered is refused with its name, and nothing is stored', async () => {
    const { w, svc } = await make('plumber');
    expect(await code(svc.enquire(HOST_A, form({ f_when: 'Today' }), '1.1.1.1'))).toBe('REQUEST_INVALID');
    expect(w.store.requests.size).toBe(0);
  });

  it('a builder: site, visit date and time; a wrong date is refused', async () => {
    const { w, svc } = await make('mason-contractor');
    expect(await code(svc.enquire(HOST_A, form({ f_site: 'Plot 4, Aluva', f_visit_date: '2026-02-30' }), '1.1.1.1'))).toBe('REQUEST_INVALID');
    await svc.enquire(HOST_A, form({ f_site: 'Plot 4, Aluva', f_visit_date: '2026-12-20', f_visit_time: 'Morning' }), '1.1.1.1');
    const req = [...w.store.requests.values()][0] as unknown as Stored;
    expect(payloadOf(req).answers).toEqual({ site: 'Plot 4, Aluva', visit_date: '2026-12-20', visit_time: 'Morning' });
  });

  it('an ambulance: the pickup place and how soon', async () => {
    const { w, svc } = await make('ambulance-service');
    await svc.enquire(HOST_A, form({ f_pickup_location: 'Bus stand, Aluva', f_urgency: 'Emergency, now' }), '1.1.1.1');
    expect(payloadOf([...w.store.requests.values()][0] as unknown as Stored).answers).toEqual({ pickup_location: 'Bus stand, Aluva', urgency: 'Emergency, now' });
  });

  it('the chosen item is stored with the lead (a product enquiry) together with the answers', async () => {
    const { w, svc } = await make('plumber');
    await svc.enquire(HOST_A, form({ item: 'item-77', f_address: 'Road 1' }), '1.1.1.1');
    const req = [...w.store.requests.values()][0] as unknown as Stored;
    expect(req.kind).toBe('PRODUCT_ENQUIRY');
    expect(payloadOf(req)).toMatchObject({ productRef: 'item-77', answers: { address: 'Road 1' } });
  });

  it('a field the business does not ask is ignored and never stored; unknown keys cannot reach the lead', async () => {
    const { w, svc } = await make('plumber');
    await svc.enquire(HOST_A, form({ f_address: 'Road 1', f_secret: 'x', f_constructor: 'y', evil: 'z' }), '1.1.1.1');
    expect(payloadOf([...w.store.requests.values()][0] as unknown as Stored).answers).toEqual({ address: 'Road 1' });
  });

  it('a script may send the answers as a fields object', async () => {
    const { w, svc } = await make('plumber');
    await svc.enquire(HOST_A, form({ fields: { address: 'Road 9', when: 'Tomorrow' } }), '1.1.1.1');
    expect(payloadOf([...w.store.requests.values()][0] as unknown as Stored).answers).toEqual({ address: 'Road 9', when: 'Tomorrow' });
  });

  it('a business with no category gets the default question; the plain old form still works', async () => {
    const { w, svc } = await make(null);
    const r = await svc.enquire(HOST_A, form({ f_preferred_time: 'Evening' }), '1.1.1.1');
    expect(r).toMatchObject({ received: true });
    expect(payloadOf([...w.store.requests.values()][0] as unknown as Stored).answers).toEqual({ preferred_time: 'Evening' });
    const plain = await make(null);
    await plain.svc.enquire(HOST_A, form({ source: 'site' }), '1.1.1.1');
    expect(payloadOf([...plain.w.store.requests.values()][0] as unknown as Stored).answers).toBeUndefined();
  });

  it('the same words with different answers are different enquiries; the same answers twice are one', async () => {
    const { w, svc } = await make('plumber');
    await svc.enquire(HOST_A, form({ f_address: 'Road 1' }), '1.1.1.1'); await svc.enquire(HOST_A, form({ f_address: 'Road 1' }), '1.1.1.1');
    expect(w.store.requests.size).toBe(1);
    await svc.enquire(HOST_A, form({ f_address: 'Road 2' }), '1.1.1.1');
    expect(w.store.requests.size).toBe(2);
  });
});

describe('collecting answers from the form post', () => {
  it('reads f_<key> fields and a fields object, only lower-case names, and never a prototype key', () => {
    const o = collectAnswers({ f_address: 'a', f_Bad: 'x', f_ok_1: 'b', fields: { zip: '1', 'Bad Key': 'x', __proto__: 'p' } } as never);
    expect(o).toEqual({ address: 'a', ok_1: 'b', zip: '1' });
    expect(Object.getPrototypeOf(o)).toBe(Object.prototype);
    expect(collectAnswers(undefined as never)).toEqual({});
  });
});
