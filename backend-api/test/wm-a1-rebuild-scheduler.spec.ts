import { SiteRebuildScheduler } from '../src/site-domains/site-rebuild-scheduler';
import { SiteRebuild } from '../src/site-domains/canonical.store';

/** Website Manager lane A, item h: a claim rebuilds the site at once; other indexing-relevant changes are debounced into one rebuild per vendor. */
class FakeRebuild extends SiteRebuild {
  calls: string[] = [];
  fail = false;
  gate: Promise<void> | null = null;
  async rebuildAndPublish(vendorId: string): Promise<void> {
    this.calls.push(vendorId);
    if (this.gate) await this.gate;
    if (this.fail) throw new Error('build broke');
  }
}
const make = () => {
  const port = new FakeRebuild();
  const s = new SiteRebuildScheduler({ get: () => port } as never);
  s.debounceMs = 1000; s.maxWaitMs = 5000;
  return { port, s };
};

describe('the site rebuild scheduler', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  it('a claim rebuilds at once, with no waiting', async () => {
    const { port, s } = make();
    s.request('v1', 'claim', { immediate: true });
    await s.whenIdle('v1');
    expect(port.calls).toEqual(['v1']);
  });

  it('repeated edits become ONE rebuild after the window', async () => {
    const { port, s } = make();
    for (let i = 0; i < 6; i++) { s.request('v1', 'edit'); jest.advanceTimersByTime(400); }
    expect(port.calls).toEqual([]);
    jest.advanceTimersByTime(1000);
    await s.whenIdle('v1');
    expect(port.calls).toEqual(['v1']);
  });

  it('a vendor who keeps editing is still rebuilt at the maximum wait', async () => {
    const { port, s } = make();
    let t = 0; s.now = () => t;
    for (let i = 0; i < 20; i++) { s.request('v1', 'edit'); t += 400; jest.advanceTimersByTime(400); }
    await s.whenIdle('v1');
    expect(port.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('different vendors are separate; an immediate request replaces a waiting one', async () => {
    const { port, s } = make();
    s.request('a', 'edit'); s.request('b', 'edit');
    s.request('a', 'claim', { immediate: true });
    await s.whenIdle('a');
    expect(port.calls).toEqual(['a']);
    jest.advanceTimersByTime(1500);
    await s.whenIdle('b');
    expect(port.calls.sort()).toEqual(['a', 'b']);
  });

  it('one rebuild at a time per vendor: a request during a run runs once more afterwards', async () => {
    const { port, s } = make();
    let release!: () => void; port.gate = new Promise<void>((r) => { release = r; });
    s.request('v1', 'claim', { immediate: true });
    await Promise.resolve();
    s.request('v1', 'claim', { immediate: true }); s.request('v1', 'claim', { immediate: true });
    expect(port.calls).toEqual(['v1']);
    port.gate = null; release();
    await s.whenIdle('v1');
    expect(port.calls).toEqual(['v1', 'v1']);
  });

  it('a failing build never throws to the caller and the next request still works', async () => {
    const { port, s } = make();
    port.fail = true;
    expect(() => s.request('v1', 'claim', { immediate: true })).not.toThrow();
    await s.whenIdle('v1');
    port.fail = false;
    s.request('v1', 'claim', { immediate: true });
    await s.whenIdle('v1');
    expect(port.calls).toEqual(['v1', 'v1']);
  });

  it('an empty vendor id is ignored; shutdown clears the waiting timers', () => {
    const { port, s } = make();
    s.request('', 'edit');
    s.request('v1', 'edit');
    expect(s.isBusy('v1')).toBe(true);
    s.onModuleDestroy();
    jest.advanceTimersByTime(10_000);
    expect(port.calls).toEqual([]);
  });
});
