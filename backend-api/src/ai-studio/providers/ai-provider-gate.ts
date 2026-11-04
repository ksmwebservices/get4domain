import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { aiError } from '../ai-studio.errors';
import { AiStudioRepository, ProviderRow } from '../ai-studio.repository';
import { openSecret } from '../secret-box';
import { AiSettingsService } from '../settings/ai-settings.service';
import { AiProvider, AnthropicTextAdapter, FetchLike, MockAiProvider, OpenAiTextAdapter } from './ai-provider.port';

export interface Resolved { provider: AiProvider; providerKey: string }

/**
 * Which model, if any, may be called right now (slice 5.11). With aiLiveCalls false (the default) the answer is ALWAYS the mock: nothing real is built, nothing is decrypted. With it true,
 * the first ACTIVE provider whose secret opens is used; if none can be used the request fails with AI_NOT_CONFIGURED instead of quietly answering from the mock (a mock must never pass
 * for a live answer). The decrypted key lives only inside the adapter.
 */
@Injectable()
export class AiProviderGate {
  /** overridable in tests */
  fetchFn: FetchLike | undefined;
  private readonly mock = new MockAiProvider();
  constructor(private readonly repo: AiStudioRepository, @Inject(AiSettingsService) private readonly settings: Pick<AiSettingsService, 'get'>) {}

  private build(row: ProviderRow): AiProvider | null {
    const apiKey = openSecret({ cipher: row.secretCipher, iv: row.secretIv, tag: row.secretTag });
    if (!apiKey || !row.model) return null;
    if (row.key === 'openai') return new OpenAiTextAdapter({ apiKey, model: row.model }, this.fetchFn);
    if (row.key === 'anthropic') return new AnthropicTextAdapter({ apiKey, model: row.model }, this.fetchFn);
    return null;
  }

  async resolve(): Promise<Resolved> {
    if (!(await this.settings.get()).aiLiveCalls) return { provider: this.mock, providerKey: 'mock' };
    for (const row of await this.repo.activeProviders()) { const p = this.build(row); if (p) return { provider: p, providerKey: row.key }; }
    throw new ConflictException(aiError('AI_NOT_CONFIGURED', 'AI suggestions are not available right now.'));
  }

  /** Staff "test connection": the mock unless aiLiveCalls is on. Never returns the provider's own error text. */
  async test(row: ProviderRow): Promise<{ ok: boolean; mode: 'mock' | 'live'; note: string }> {
    if (!(await this.settings.get()).aiLiveCalls) return { ok: true, mode: 'mock', note: 'Live calls are switched off (aiLiveCalls), so the built-in mock answered. No real model was called.' };
    const p = this.build(row);
    if (!p) return { ok: false, mode: 'live', note: 'The provider is not usable: its secret or model is missing, or it cannot be opened.' };
    try { await p.generate({ system: 'Reply with the single word OK.', user: 'ping', maxOutputTokens: 5 }); return { ok: true, mode: 'live', note: 'The provider answered.' }; } catch { return { ok: false, mode: 'live', note: 'The provider call failed.' }; }
  }
}
