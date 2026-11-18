import { Injectable } from '@nestjs/common';

/**
 * A plain notifier the runtime loader (TM1 M3) subscribes to: told after every publish and archive so its short cache is dropped at once. `notify` waits for the listeners, so when a publish answers, this
 * server already draws the new theme; a listener that fails never breaks the publish. Its own file so the render service and the market service can both use it without importing each other.
 */
@Injectable()
export class ThemeChangeNotifier {
  private readonly fns: Array<() => void | Promise<void>> = [];
  subscribe(fn: () => void | Promise<void>): void { this.fns.push(fn); }
  async notify(): Promise<void> { await Promise.allSettled(this.fns.map(async (f) => f())); }
}
