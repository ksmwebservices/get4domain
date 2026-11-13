# V3 enquiry inbox and lane 1 email (Block 4b, slice 2; Amendment 12 Q3 and Q5)

Nothing here is deployed and no provider has been called: every test uses a fake. Both sending flags default OFF.

## The three mail lanes, as the code sees them

| Lane | Kinds the code lets through | Sends in this block? |
|---|---|---|
| 1 SYSTEM (send subdomain, Resend) | `OTP`, `RECEIPT`, `ACCOUNT_NOTICE`, `ENQUIRY_FORWARD` | yes, behind the flags below |
| 2 VENDOR_OFFICIAL (vendor's own mailbox) | `ENQUIRY_REPLY`, `QUOTATION`, `ORDER` | **no**: recorded as rules, refuses `EMAIL_NOT_LIVE` |
| 3 PROMOTIONS | none | **no sending code exists** |

**Hard rule, in code and in tests** (`test/mail-lanes.spec.ts`): `GuardedEmailPort` is the only way out. The kinds a lane may send are closed lists with no promotional member; any other kind is refused (`EMAIL_KIND_FORBIDDEN`) before a provider is reached; a message has exactly one valid recipient; no line break may appear in a subject, name or Reply-To. A source scan fails the build if a promotional kind or a list of recipients appears in the module.

## Flags and environment variable names (values never printed)

| Name | Default | What |
|---|---|---|
| `EMAIL_LIVE_SEND` | OFF | one-time codes and receipts (lane 1) |
| `EMAIL_FORWARD_LIVE` | OFF | forwarding of enquiries to the business |
| `RESEND_API_KEY` | none | existing Resend key (lane 1 account) |
| `INBOUND_EMAIL_SECRET` | none | HMAC secret shared with the Worker |
| `SITE_BASE_DOMAIN` | `get4domain.com` | existing: addresses are `<anything>@<subdomain>.<this>` |

Settings (all start unset; SUPER_ADMIN, one plan-settings API): `mailSystemFromAddress`, `mailSystemFromName`, `inboxMaxBytes`, `inboxRatePerHour`, `inboxSpamThreshold`. While any inbox setting is unset the inbound endpoint answers `INBOX_NOT_CONFIGURED`.

## What happens to a message

1. The Worker posts JSON to `POST /v3/inbound/email` with header `x-g4d-signature: t=<unix seconds>,v1=<hex hmac-sha256 of "<t>.<raw body>">`. A signature older or newer than 300 seconds is refused.
2. The API checks settings, shape and size, finds the business by the subdomain in the address, and checks its plan is **active or in grace on a V3 plan and not suspended**. Otherwise `INBOX_PLAN_INACTIVE`: nothing is stored or forwarded (held enquiries, a separate flag, come in a later slice).
3. Per business, one at a time, the hourly count is checked and the message stored (text only, no HTML is kept; the same message id twice is one row).
4. A score above `inboxSpamThreshold` marks it SPAM: kept, never forwarded.
5. Otherwise it is forwarded through lane 1 to the business's own address with `Reply-To` set to the original sender. With `EMAIL_FORWARD_LIVE` OFF the row says `SKIPPED_FLAG_OFF`; a provider failure says `FAILED`. The plan is checked on every message, so forwarding stops the moment the plan ends.

Owner routes (owner only, plan-gated): `GET /v3/me/inbox`, `GET /v3/me/inbox/:id`, `PUT /v3/me/inbox/:id/state`.

## Decision to confirm: what "plan active" means

Amendment 12 says forwarding is free on any plan including Free and stops when the plan ends. The code reads "ends" as the subscription being EXPIRED or CANCELLED (grace still counts as active), and a legacy vendor has no inbox. Amendment 10 Part L (held enquiries for vendors without Pro) is the separate flag in a later slice.

## Cloudflare Email Worker (NOT deployed)

Checks before you deploy: the Email Routing and Workers limits on your Cloudflare plan; that your Resend plan is not needed for inbound (the Worker posts to our API, Resend is only used for sending); and which spam header Cloudflare adds (TO VERIFY: the script reads `X-Spam-Score` if present and otherwise sends no score, which the API treats as CLEAN). Fallback if any check fails: plain Cloudflare forwarding for the first vendors.

Set up: Email Routing on the base domain with a catch-all rule "Send to a Worker". Wildcard mail for `*.get4domain.com` needs the subdomain addressing enabled on the zone (TO VERIFY with Cloudflare: catch-all on subdomains). Secrets: `wrangler secret put INBOUND_EMAIL_SECRET` (same value as the API) and the variable `API_URL`.

```js
// worker.js - bundle with postal-mime (npm i postal-mime)
import PostalMime from 'postal-mime';

async function sign(secret, body, t) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${body}`));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async email(message, env) {
    const parsed = await PostalMime.parse(message.raw);
    const score = Number(message.headers.get('x-spam-score'));
    const payload = JSON.stringify({
      to: message.to,
      from: message.from,
      fromName: parsed.from && parsed.from.name ? parsed.from.name : null,
      subject: parsed.subject || '',
      text: parsed.text || '',
      messageId: message.headers.get('message-id'),
      spamScore: Number.isFinite(score) ? score : null,
      sizeBytes: message.rawSize,
    });
    const t = Math.floor(Date.now() / 1000);
    const res = await fetch(`${env.API_URL}/v3/inbound/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-g4d-signature': `t=${t},v1=${await sign(env.INBOUND_EMAIL_SECRET, payload, t)}` },
      body: payload,
    });
    // 404 (no such business), 403 (plan ended), 413 (too large) and 429 (rate limit) are final: tell the sender.
    if ([403, 404, 413, 429].includes(res.status)) message.setReject('This address cannot receive mail right now.');
    // anything else that is not 200 is a fault on our side: let Cloudflare retry by throwing
    else if (!res.ok) throw new Error('inbox unavailable');
  },
};
```

Not done here: the Worker is not deployed, no DNS or routing rule is created, no real message has been received or sent. The first live test is: set the settings and secret, switch `EMAIL_LIVE_SEND` and `EMAIL_FORWARD_LIVE` on staging only, send one mail to a test business, check the row and the forward.

## Held enquiries (Block 4b, slice 6; Amendment 10 Part L)

For a business whose plan is **not active**, enquiries can be kept instead of refused. This is OFF by default and needs BOTH:

1. SUPER_ADMIN's setting `heldEnquiriesEnabled` = `true` (default `false`), and
2. the **Enquiry Consent** policy text published by counsel (`ConsentGate`). Until the policy store (slice 12) binds the real answer, the gate says no, so holding stays off even if the setting is turned on. A placeholder body cannot be published, so the flag cannot be defeated by a draft.

What happens when both are on: the message is stored with state `HELD` and forward status `SKIPPED_PLAN_ENDED`, counted against the same size and rate limits, never forwarded, and never shared with anyone (a test checks the held branch has no send, share or export). A spam-scored message is not held for an unpaid business. The Worker sees `accepted: true, held: true`.

What the business sees: `GET /v3/me/inbox/waiting` returns only `{ count, text }` with text like "3 enquiries waiting" ("1 enquiry waiting"; null when none). No sender, subject or text in the count; the list and read routes still answer `INBOX_PLAN_INACTIVE` while the plan is not active.

Unlock: when the plan is active again, the first call to `waiting`, `list` or `get` releases the business's held messages to `NEW` (event `inbox.held_released`). They are not forwarded after the fact: forwarding happens only when a message arrives while the plan stands.

Not decided here (counsel and the owner): how long held enquiries are kept, and what is said to the sender. No retention number is invented; none is enforced.
