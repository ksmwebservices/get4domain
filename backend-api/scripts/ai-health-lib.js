'use strict';
// One minimal call per provider, classified. Used by scripts/ai-health.js and by the verify suite (with a stub fetch).
const path = require('path');
const { classifyProviderError } = require(path.join(__dirname, '..', 'dist', 'src', 'ai', 'ai-errors'));

const TIMEOUT_MS = 20_000;

/** @returns {Promise<{ provider: string, ok: boolean, status: number|null, kind: string|null, ms: number }>} Never includes the key or the response text. */
async function checkProvider(provider, apiKey, fetchImpl = fetch) {
  const started = Date.now();
  const call = provider === 'openai'
    ? { url: 'https://api.openai.com/v1/chat/completions', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: { model: 'gpt-4o-mini', max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] } }
    : { url: 'https://api.anthropic.com/v1/messages', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }, body: { model: 'claude-haiku-4-5-20251001', max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] } };
  try {
    const res = await fetchImpl(call.url, { method: 'POST', headers: call.headers, body: JSON.stringify(call.body), signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.ok) return { provider, ok: true, status: res.status, kind: null, ms: Date.now() - started };
    const body = await res.text().catch(() => '');
    return { provider, ok: false, status: res.status, kind: classifyProviderError(res.status, body), ms: Date.now() - started };
  } catch (e) {
    return { provider, ok: false, status: null, kind: classifyProviderError(null, '', e), ms: Date.now() - started };
  }
}

/** Image check is opt-in (--image): it generates one real DALL-E picture, which costs a few rupees. */
async function checkImage(apiKey, fetchImpl = fetch) {
  const started = Date.now();
  try {
    const res = await fetchImpl('https://api.openai.com/v1/images/generations', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'dall-e-3', prompt: 'A plain light-grey square, no text.', n: 1, size: '1024x1024' }), signal: AbortSignal.timeout(90_000),
    });
    if (res.ok) return { provider: 'openai-image', ok: true, status: res.status, kind: null, ms: Date.now() - started };
    return { provider: 'openai-image', ok: false, status: res.status, kind: classifyProviderError(res.status, await res.text().catch(() => '')), ms: Date.now() - started };
  } catch (e) {
    return { provider: 'openai-image', ok: false, status: null, kind: classifyProviderError(null, '', e), ms: Date.now() - started };
  }
}

module.exports = { checkProvider, checkImage };
