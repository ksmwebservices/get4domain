/**
 * The model seam of AI Studio (slice 5.11). Every test uses MockAiProvider. The real adapters are built ONLY by AiProviderGate, and only when the plan setting aiLiveCalls is true, the
 * provider row is ACTIVE and its secret decrypts. They speak plain HTTPS (no vendor SDK). A provider's error text is never passed on: it can echo a key.
 */
export interface AiRequest { system: string; user: string; maxOutputTokens: number }
export interface AiResponse { text: string; inputTokens: number; outputTokens: number }
export abstract class AiProvider {
  abstract readonly mode: 'mock' | 'live';
  abstract generate(r: AiRequest): Promise<AiResponse>;
}

const approxTokens = (s: string): number => Math.ceil(s.length / 4);

/** Deterministic: the same request always gives the same text, built only from the DATA block. It follows no instruction found in the data. */
export class MockAiProvider extends AiProvider {
  readonly mode = 'mock' as const;
  async generate(r: AiRequest): Promise<AiResponse> {
    let data: Record<string, unknown> = {};
    try { const inner = r.user.slice(r.user.indexOf('<data>') + 6, r.user.lastIndexOf('</data>')); data = JSON.parse(inner) as Record<string, unknown>; } catch { /* a malformed block gives the generic line below */ }
    const name = typeof data.businessName === 'string' ? data.businessName : 'This business';
    const hint = typeof data.keyPoints === 'string' && data.keyPoints ? data.keyPoints : typeof data.category === 'string' ? data.category : 'local service';
    const text = `Mock suggestion for ${name}: ${hint}.`;
    return { text, inputTokens: approxTokens(r.system + r.user), outputTokens: approxTokens(text) };
  }
}

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export class OpenAiTextAdapter extends AiProvider {
  readonly mode = 'live' as const;
  constructor(private readonly cfg: { apiKey: string; model: string }, private readonly fetchFn: FetchLike = (u, i) => fetch(u, i) as never) { super(); }
  async generate(r: AiRequest): Promise<AiResponse> {
    const res = await this.fetchFn('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${this.cfg.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.cfg.model, max_tokens: r.maxOutputTokens, temperature: 0.4, messages: [{ role: 'system', content: r.system }, { role: 'user', content: r.user }] }),
    });
    const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
    const text = j.choices?.[0]?.message?.content;
    if (!res.ok || typeof text !== 'string') throw new Error(`provider call failed (${res.status})`);
    return { text, inputTokens: Number(j.usage?.prompt_tokens ?? 0) || 0, outputTokens: Number(j.usage?.completion_tokens ?? 0) || 0 };
  }
}

export class AnthropicTextAdapter extends AiProvider {
  readonly mode = 'live' as const;
  constructor(private readonly cfg: { apiKey: string; model: string }, private readonly fetchFn: FetchLike = (u, i) => fetch(u, i) as never) { super(); }
  async generate(r: AiRequest): Promise<AiResponse> {
    const res = await this.fetchFn('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'x-api-key': this.cfg.apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.cfg.model, max_tokens: r.maxOutputTokens, system: r.system, messages: [{ role: 'user', content: r.user }] }),
    });
    const j = (await res.json()) as { content?: Array<{ type?: string; text?: string }>; usage?: { input_tokens?: number; output_tokens?: number } };
    const text = j.content?.find((c) => c.type === 'text')?.text;
    if (!res.ok || typeof text !== 'string') throw new Error(`provider call failed (${res.status})`);
    return { text, inputTokens: Number(j.usage?.input_tokens ?? 0) || 0, outputTokens: Number(j.usage?.output_tokens ?? 0) || 0 };
  }
}
