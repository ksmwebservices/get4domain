import { ServiceUnavailableException } from '@nestjs/common';

/**
 * An in-process first-in-first-out queue per key. Work for one key runs one at a time; different keys run in parallel; a failure never blocks the next item.
 *
 * WHY: a per-vendor database advisory lock is taken INSIDE an interactive transaction, so every request that waits for the lock is already holding one pooled connection.
 * With a pool of a few connections and many parallel requests for one vendor, the waiting requests take every connection, the rest cannot even start a transaction
 * ("Unable to start a transaction in the given time"), and callers get 5xx. Waiting here, BEFORE the transaction opens, costs memory only. The advisory lock stays as the
 * guard between server processes; inside one process it is now never contended.
 */
export class KeyedQueue {
  private readonly tails = new Map<string, Promise<void>>();
  private readonly pending = new Map<string, number>();
  constructor(private readonly maxPendingPerKey = 1000) {}

  run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const waiting = this.pending.get(key) ?? 0;
    if (waiting >= this.maxPendingPerKey) return Promise.reject(new ServiceUnavailableException('BUSY'));
    this.pending.set(key, waiting + 1);
    const prev = this.tails.get(key) ?? Promise.resolve();
    const result = prev.then(fn);
    const tail = result.then(() => undefined, () => undefined);
    this.tails.set(key, tail);
    void tail.then(() => {
      const left = (this.pending.get(key) ?? 1) - 1;
      if (left <= 0) { this.pending.delete(key); if (this.tails.get(key) === tail) this.tails.delete(key); } else this.pending.set(key, left);
    });
    return result;
  }

  /** Keys with work queued or running (tests and diagnostics). */
  size(): number { return this.tails.size; }
}
