import * as crypto from 'crypto';

/**
 * The social publisher's provider interface (Dispatch A section 6, built here because it did not exist).
 * One provider per channel. A SANDBOX provider keeps posts in memory so everything can be tested and reviewed before any network approves us.
 */
export type SocialChannel = 'FACEBOOK_PAGE' | 'INSTAGRAM' | 'TELEGRAM' | 'GOOGLE_BUSINESS';

export interface ProviderAccount { externalId: string | null; token: string | null; name: string }
export interface ProviderPost { kind: 'TEXT' | 'IMAGE' | 'LINK'; content: string; imageUrl?: string | null; linkUrl?: string | null }
export interface PublishedPost { providerPostId: string; postUrl: string | null }
export interface PostResults { impressions?: number; clicks?: number }

export class PublishError extends Error {
  constructor(message: string, readonly retryable: boolean) { super(message); }
}

export interface SocialProvider {
  readonly channel: SocialChannel;
  readonly sandbox: boolean;
  publish(account: ProviderAccount, post: ProviderPost): Promise<PublishedPost>;
  /** A read-only call that proves the saved credential works (used by "Test connection"). */
  test(account: ProviderAccount): Promise<{ ok: boolean; message: string }>;
  results(account: ProviderAccount, providerPostId: string): Promise<PostResults | null>;
}

type Fetcher = typeof fetch;
const json = async (res: Response): Promise<Record<string, unknown>> => ((await res.json().catch(() => ({}))) as Record<string, unknown>);
const retryable = (status: number): boolean => status === 429 || status >= 500;
const graphError = (j: Record<string, unknown>, status: number): PublishError => new PublishError(((j.error as { message?: string } | undefined)?.message) ?? `The network refused the post (${status}).`, retryable(status));

export class SandboxSocialProvider implements SocialProvider {
  readonly sandbox = true;
  readonly posts: { account: string; post: ProviderPost; id: string; at: Date }[] = [];
  constructor(readonly channel: SocialChannel) {}
  async publish(account: ProviderAccount, post: ProviderPost): Promise<PublishedPost> {
    if (this.channel === 'INSTAGRAM' && !post.imageUrl) throw new PublishError('Instagram posts need a picture.', false);
    const id = `sandbox_${this.channel.toLowerCase()}_${crypto.randomBytes(6).toString('hex')}`;
    this.posts.push({ account: account.name, post, id, at: new Date() });
    return { providerPostId: id, postUrl: `https://sandbox.invalid/${id}` };
  }
  async test(): Promise<{ ok: boolean; message: string }> { return { ok: true, message: 'Sandbox: nothing is sent to the network.' }; }
  async results(): Promise<PostResults | null> { return { impressions: 0, clicks: 0 }; }
}

export class FacebookPageProvider implements SocialProvider {
  readonly channel = 'FACEBOOK_PAGE' as const;
  readonly sandbox = false;
  constructor(private readonly f: Fetcher = fetch, private readonly v = 'v20.0') {}
  async publish(a: ProviderAccount, p: ProviderPost): Promise<PublishedPost> {
    if (!a.externalId || !a.token) throw new PublishError('This Facebook Page is not connected yet.', false);
    const useImage = p.kind === 'IMAGE' && p.imageUrl;
    const url = `https://graph.facebook.com/${this.v}/${a.externalId}/${useImage ? 'photos' : 'feed'}`;
    const body = useImage ? { url: p.imageUrl, caption: p.content, access_token: a.token } : { message: p.content, ...(p.linkUrl ? { link: p.linkUrl } : {}), access_token: a.token };
    const res = await this.f(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
    const j = await json(res);
    if (!res.ok || !(j.id || j.post_id)) throw graphError(j, res.status);
    const id = String(j.post_id ?? j.id);
    return { providerPostId: id, postUrl: `https://www.facebook.com/${id}` };
  }
  async test(a: ProviderAccount): Promise<{ ok: boolean; message: string }> {
    if (!a.externalId || !a.token) return { ok: false, message: 'Save the Page id and the access token first.' };
    const res = await this.f(`https://graph.facebook.com/${this.v}/${a.externalId}?fields=id,name&access_token=${encodeURIComponent(a.token)}`, { signal: AbortSignal.timeout(15_000) });
    return res.ok ? { ok: true, message: 'Facebook accepted the token for this Page.' } : { ok: false, message: 'Facebook did not accept the token. Create a new Page access token and save it again.' };
  }
  async results(a: ProviderAccount, id: string): Promise<PostResults | null> {
    if (!a.token) return null;
    const res = await this.f(`https://graph.facebook.com/${this.v}/${id}/insights?metric=post_impressions,post_clicks&access_token=${encodeURIComponent(a.token)}`, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const j = (await json(res)) as { data?: { name: string; values?: { value: number }[] }[] };
    const val = (n: string): number | undefined => j.data?.find((d) => d.name === n)?.values?.[0]?.value;
    return { impressions: val('post_impressions'), clicks: val('post_clicks') };
  }
}

export class InstagramProvider implements SocialProvider {
  readonly channel = 'INSTAGRAM' as const;
  readonly sandbox = false;
  constructor(private readonly f: Fetcher = fetch, private readonly v = 'v20.0') {}
  async publish(a: ProviderAccount, p: ProviderPost): Promise<PublishedPost> {
    if (!a.externalId || !a.token) throw new PublishError('This Instagram account is not connected yet.', false);
    if (!p.imageUrl) throw new PublishError('Instagram posts need a picture.', false);
    const base = `https://graph.facebook.com/${this.v}/${a.externalId}`;
    const create = await this.f(`${base}/media`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image_url: p.imageUrl, caption: p.content, access_token: a.token }), signal: AbortSignal.timeout(20_000) });
    const cj = await json(create);
    if (!create.ok || !cj.id) throw graphError(cj, create.status);
    const pub = await this.f(`${base}/media_publish`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ creation_id: cj.id, access_token: a.token }), signal: AbortSignal.timeout(20_000) });
    const pj = await json(pub);
    if (!pub.ok || !pj.id) throw graphError(pj, pub.status);
    return { providerPostId: String(pj.id), postUrl: null };
  }
  async test(a: ProviderAccount): Promise<{ ok: boolean; message: string }> {
    if (!a.externalId || !a.token) return { ok: false, message: 'Save the Instagram account id and the access token first.' };
    const res = await this.f(`https://graph.facebook.com/${this.v}/${a.externalId}?fields=id,username&access_token=${encodeURIComponent(a.token)}`, { signal: AbortSignal.timeout(15_000) });
    return res.ok ? { ok: true, message: 'Instagram accepted the token for this account.' } : { ok: false, message: 'Instagram did not accept the token. Create a new access token and save it again.' };
  }
  async results(): Promise<PostResults | null> { return null; }
}

export class TelegramProvider implements SocialProvider {
  readonly channel = 'TELEGRAM' as const;
  readonly sandbox = false;
  constructor(private readonly f: Fetcher = fetch) {}
  async publish(a: ProviderAccount, p: ProviderPost): Promise<PublishedPost> {
    if (!a.externalId || !a.token) throw new PublishError('This Telegram channel is not connected yet.', false);
    const useImage = p.imageUrl && p.kind === 'IMAGE';
    const text = p.linkUrl ? `${p.content}\n${p.linkUrl}` : p.content;
    const res = await this.f(`https://api.telegram.org/bot${a.token}/${useImage ? 'sendPhoto' : 'sendMessage'}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(useImage ? { chat_id: a.externalId, photo: p.imageUrl, caption: text } : { chat_id: a.externalId, text }),
      signal: AbortSignal.timeout(20_000),
    });
    const j = (await json(res)) as { ok?: boolean; result?: { message_id?: number }; description?: string };
    if (!res.ok || !j.ok || !j.result?.message_id) throw new PublishError(j.description ?? `Telegram refused the post (${res.status}).`, retryable(res.status));
    const handle = a.externalId.startsWith('@') ? a.externalId.slice(1) : null;
    return { providerPostId: String(j.result.message_id), postUrl: handle ? `https://t.me/${handle}/${j.result.message_id}` : null };
  }
  async test(a: ProviderAccount): Promise<{ ok: boolean; message: string }> {
    if (!a.token) return { ok: false, message: 'Save the bot token first.' };
    const res = await this.f(`https://api.telegram.org/bot${a.token}/getMe`, { signal: AbortSignal.timeout(15_000) });
    return res.ok ? { ok: true, message: 'Telegram accepted the bot token. Make sure the bot is an admin of the channel.' } : { ok: false, message: 'Telegram did not accept the bot token.' };
  }
  async results(): Promise<PostResults | null> { return null; }
}

/** Google Business Profile local posts. Needs the vendor's own OAuth grant (token) and the location resource name as externalId (accounts/x/locations/y). */
export class GoogleBusinessProvider implements SocialProvider {
  readonly channel = 'GOOGLE_BUSINESS' as const;
  readonly sandbox = false;
  constructor(private readonly f: Fetcher = fetch) {}
  async publish(a: ProviderAccount, p: ProviderPost): Promise<PublishedPost> {
    if (!a.externalId || !a.token) throw new PublishError('This Google Business Profile is not connected yet.', false);
    const res = await this.f(`https://mybusiness.googleapis.com/v4/${a.externalId}/localPosts`, {
      method: 'POST', headers: { Authorization: `Bearer ${a.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ languageCode: 'en', summary: p.content, topicType: 'STANDARD', ...(p.linkUrl ? { callToAction: { actionType: 'LEARN_MORE', url: p.linkUrl } } : {}), ...(p.imageUrl ? { media: [{ mediaFormat: 'PHOTO', sourceUrl: p.imageUrl }] } : {}) }),
      signal: AbortSignal.timeout(20_000),
    });
    const j = await json(res);
    if (!res.ok || !j.name) throw graphError(j, res.status);
    return { providerPostId: String(j.name), postUrl: (j.searchUrl as string | undefined) ?? null };
  }
  async test(a: ProviderAccount): Promise<{ ok: boolean; message: string }> {
    if (!a.externalId || !a.token) return { ok: false, message: 'The vendor has not granted access yet.' };
    const res = await this.f(`https://mybusinessbusinessinformation.googleapis.com/v1/${a.externalId}?readMask=name,title`, { headers: { Authorization: `Bearer ${a.token}` }, signal: AbortSignal.timeout(15_000) });
    return res.ok ? { ok: true, message: 'Google accepted the access for this business.' } : { ok: false, message: 'Google did not accept the access. Ask the vendor to connect again.' };
  }
  async results(): Promise<PostResults | null> { return null; }
}
