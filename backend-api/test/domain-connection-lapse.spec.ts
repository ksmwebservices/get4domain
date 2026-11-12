import { connectionWorld } from './support/domain-connection-world';

/** Owner answer Q11 through the connection service: the watcher lapses a live connection when the plan no longer allows custom domains, and restores it when Pro returns. */
const V1 = { type: 'VENDOR' as const, id: 'u1', ip: null };
const tick = () => new Promise((r) => setImmediate(r));
const live = async (mode: 'CONNECT' | 'FORWARD' = 'CONNECT') => {
  const w = connectionWorld({ customHostnameTarget: 'edge.get4domain.test', connectionWatcherEnabled: true });
  await w.svc.begin('v1', 'd1', { mode }, V1); const id = [...w.cf.hostnames.keys()][0]; w.cf.setCert(id, 'ACTIVE'); await w.svc.check('v1', 'd1', V1); w.switched.length = 0;
  return { w, id };
};

describe('plan expiry (owner answer Q11)', () => {
  it('a free vendor cannot start a connection (the feature is a locked preview)', async () => {
    const w = connectionWorld(); w.pro.on = false;
    await expect(w.svc.begin('v1', 'd1', {}, V1)).rejects.toMatchObject({ response: { code: 'FEATURE_LOCKED' } });
    expect(w.cf.calls).toEqual([]);
  });
  it('after the plan lapses the live connection lapses: the vendor host redirects to the subdomain, the canonical switch runs, the row stays', async () => {
    const { w } = await live('CONNECT'); w.pro.on = false;
    await w.svc.watchTick();
    expect((await w.svc.get('v1', 'd1')).status).toBe('LAPSED');
    expect(w.cf.redirects.get('www.example.in')).toBe('acme.g4d.test'); expect(w.switched).toEqual(['v1']);
    await tick();
    const ev = w.events.find((e) => e.type === 'domain.redirect_on_lapse')!;
    expect(ev.actor).toEqual({ type: 'SYSTEM', id: null }); expect(ev.vendorId).toBe('v1');
    w.switched.length = 0; await w.svc.watchTick(); expect(w.switched).toEqual([]);   // running it again changes nothing
  });
  it('when Pro returns in connect mode the lapse redirect is removed, the canonical switch runs and the certificate is checked again', async () => {
    const { w } = await live('CONNECT'); w.pro.on = false; await w.svc.watchTick(); w.switched.length = 0;
    w.pro.on = true; await w.svc.watchTick();
    expect((await w.svc.get('v1', 'd1')).status).toBe('ACTIVE');
    expect(w.switched).toContain('v1'); expect(w.cf.redirects.size).toBe(0);
  });
  it('in forward mode the forward redirect to the subdomain is what remains after Pro returns', async () => {
    const { w } = await live('FORWARD'); w.pro.on = false; await w.svc.watchTick();
    w.pro.on = true; await w.svc.watchTick();
    expect((await w.svc.get('v1', 'd1')).status).toBe('ACTIVE'); expect(w.cf.redirects.get('www.example.in')).toBe('acme.g4d.test');
  });
  it('a lapsed connection takes no certificate news and a hand check changes nothing', async () => {
    const { w, id } = await live(); w.pro.on = false; await w.svc.watchTick(); w.cf.setCert(id, 'FAILED');
    expect((await w.svc.check('v1', 'd1', V1)).status).toBe('LAPSED');
  });
});
