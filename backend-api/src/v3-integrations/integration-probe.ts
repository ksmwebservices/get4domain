import { Injectable } from '@nestjs/common';
import { liveFlags } from '../v3-registrar/core/registrar-core';
import { RegistrarError } from '../v3-registrar/registrar.port';
import { FetchHttp, ResellerClubAdapter } from '../v3-registrar/resellerclub.adapter';
import { ProviderKey, TestState, Values } from './integrations-core';

/** Asks a provider whether the saved details work, with one harmless READ. Never sends an e-mail, buys a domain or runs a model. A state comes back, never the provider's own words. */
export abstract class IntegrationProbe { abstract probe(provider: ProviderKey, values: Values): Promise<TestState>; }

export type FetchFn = (url: string, init: { method: 'GET'; headers: Record<string, string>; signal: AbortSignal }) => Promise<{ status: number; json: () => Promise<unknown> }>;

/** The registrar failure codes to the plain states of the TEST route. Exported for the registrar check script and the tests. */
export function stateOfRegistrarError(e: unknown): TestState {
  const code = e instanceof RegistrarError ? e.code : '';
  if (code === 'REGISTRAR_KEYS_MISSING') return 'NOT_CONFIGURED';
  if (code === 'REGISTRAR_NOT_AUTHORISED') return 'ACCESS_DENIED';
  if (code === 'REGISTRAR_BAD_KEYS') return 'REJECTED';
  if (code === 'REGISTRAR_TIMEOUT') return 'TIMEOUT';
  if (code === 'REGISTRAR_LIVE_DISABLED') return 'REGISTRAR_OFF';
  if (code === 'REGISTRAR_UNREACHABLE' || code === 'REGISTRAR_SERVER_ERROR') return 'UNREACHABLE';
  return 'UNKNOWN';
}

const TIMEOUT_MS = 10_000;

/**
 * The product probe. ResellerClub: one availability read through the registrar adapter with the SAVED keys, and only while the domain-search switch (REGISTRAR_LIVE_SEARCH) is on, so a server that has not
 * been switched on makes no call. Resend: GET /domains (a key limited to sending answers "restricted", which still proves the key is real). Claude: GET /v1/models. One attempt each, 10 second limit.
 * The key goes only into a request header or parameter; it is never logged.
 */
@Injectable()
export class LiveIntegrationProbe extends IntegrationProbe {
  fetchFn: FetchFn = (url, init) => fetch(url, init);
  env: () => Record<string, string | undefined> = () => process.env;

  async probe(provider: ProviderKey, v: Values): Promise<TestState> {
    if (provider === 'resellerclub') return this.registrar(v);
    if (provider === 'email') return this.http('https://api.resend.com/domains', { authorization: `Bearer ${v.apiKey}` }, async (status, json) => (status === 200 || (json as { name?: string } | null)?.name === 'restricted_api_key' ? 'OK' : status === 401 || status === 400 || status === 403 ? 'REJECTED' : 'UNKNOWN'));
    if (provider === 'claude') return this.http('https://api.anthropic.com/v1/models', { 'x-api-key': v.apiKey, 'anthropic-version': '2023-06-01' }, async (status) => (status === 200 ? 'OK' : status === 401 ? 'REJECTED' : status === 403 ? 'ACCESS_DENIED' : 'UNKNOWN'));
    return 'NOT_AVAILABLE';
  }

  private async registrar(v: Values): Promise<TestState> {
    if (!liveFlags(this.env()).search) return 'REGISTRAR_OFF';
    const mode = v.mode === 'live' ? 'live' : 'demo';
    const adapter = new ResellerClubAdapter(new FetchHttp(this.env, TIMEOUT_MS), this.env, async () => ({ userId: v.resellerId, apiKey: v.apiKey, mode }));
    adapter.readAttempts = 1;
    try {
      const hits = await adapter.search('get4domain-registrar-check', ['com']);
      return hits.length > 0 ? 'OK' : 'UNKNOWN';
    } catch (e) { return stateOfRegistrarError(e); }
  }

  private async http(url: string, headers: Record<string, string>, read: (status: number, json: unknown) => Promise<TestState>): Promise<TestState> {
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const res = await this.fetchFn(url, { method: 'GET', headers, signal: ctl.signal });
      let json: unknown = null; try { json = await res.json(); } catch { json = null; }
      return await read(res.status, json);
    } catch (e) { return e && typeof e === 'object' && (e as { name?: string }).name === 'AbortError' ? 'TIMEOUT' : 'UNREACHABLE'; }
    finally { clearTimeout(timer); }
  }
}

