# Bolt brief: the LeadSpace landing page ("the vendor's app")

For ChatGPT / Bolt. Claude Code connects the finished design to the live data and the lead capture; Bolt only designs and builds the **front end** of the page. Do not touch any backend.

## 1. What we are making

LeadSpace is a product of its own (not BOS): a **free single-page mini web app** for a business that has no website, such as a driver, freelancer, small clinic, start-up, tutor, photographer, salon or small shop. Get4Domain's line is **"Your online visible partner"**. The page must feel like a small mobile app, not a long brochure.

The visitor sees the **business name and what it offers** (services or products with prices and pictures). The visitor never sees the business's **phone number, e-mail, street address or map link**. Every enquiry, booking, appointment, site visit or order goes **through us**: the visitor fills a short form, gets a code on WhatsApp, confirms, and we pass the request to the business. Never show a "call" or "WhatsApp the business" button on this page.

## 2. Layout: an app on a phone, a clean single page on a computer

Phone first (360 to 430 px wide). The experience is a **single page with a bottom navigation bar** (like our vendors' web apps):

| Bottom tab | What it scrolls or opens to |
|---|---|
| Home | Hero: business name, trade, city, one line, one big button (the single action, see section 4), the offer if any |
| Services (or Products / Menu / Listings, word set by the trade) | The grid or list of items: picture, name, price, short text. For shops a "+" to add to the order |
| About | About text, trust points, areas we serve, hours, questions people ask |
| Enquire (word set by the goal: Book / Order / Enquire / Book a visit) | The request form |

- The bar is fixed at the bottom on phones. The active tab is clear. A floating primary button is not needed: the bar's last tab is the action.
- On a computer, the same content as one centred column (max about 960 px) with the tabs as a simple top bar. No complicated layouts.
- Fast: no heavy libraries; images lazy-loaded except the hero; it must feel instant on a mid-range phone on 4G.
- Accessible: labels on every input, 44 px tap targets, contrast AA.

## 3. Look: one family, a different feel per trade

Twelve trades. Each gets its own colour, hero style and the order of sections. The accent colours already exist (use them as the starting point; improve if you like but keep them as data):

| Trade (id) | Accent | Feel and hero idea | Action word |
|---|---|---|---|
| home-services | #d97706 | friendly, practical; before the hero, three trust chips | Book a visit |
| builders-interiors | #0f766e | gallery-led, large photos | Book a site visit |
| real-estate | #1d4ed8 | listing cards; RERA number shown if given | Book a site visit |
| freelancer | #7c3aed | personal, portfolio-like, clean | Send your brief |
| startup | #e11d48 | bold, product-first | Talk to us |
| photography-events | #be185d | full-bleed photo gallery, elegant | Check my date |
| tutor | #0369a1 | trustworthy, batches and subjects | Book a demo class |
| salon-beauty | #c026d3 | soft, service menu with prices | Book my slot |
| shop-retail | #16a34a | product grid with big pictures, add-to-order | Send my order |
| restaurant-food | #ea580c | menu cards with food photos | Order now |
| advocate | #334155 | calm, text-led, no sales language, visible disclaimer | Send an enquiry |
| clinic | #0d9488 | clean, reassuring, visible disclaimer | Request an appointment |

Deliver the design as **one flexible layout plus a small set of variations** (hero style, card style, section order), not twelve separate sites. Each variation is chosen by the trade id and reads colours from the theme.

**Pictures matter.** Every product or service card has a picture slot. If an item has no picture, show a tasteful trade-coloured placeholder with the first letter, never an empty gap. The hero image is optional with a good no-image version.

## 4. The one action

Each page has exactly **one goal** (`goal` in the data): ENQUIRY, BOOKING, APPOINTMENT, SITE_VISIT or CART_ORDER. The button text is given (`primaryButton`). The form fields are given by the data (`form.fields`: kinds are `text`, `tel`, `textarea`, `date`, `select`, `cart`); the form must render whatever fields arrive, so a booking page has service, date and time slot and a shop page has the cart. **No payment is taken on the page.**

The form is three steps on one card (details; a 6-digit code sent to the visitor's WhatsApp; thank-you). Claude Code already has this working (`LeadForm`). Bolt may restyle it; keep the consent checkbox with the given consent text, the error line and the three states.

## 5. The data the page receives (exact shape, real example)

The page is rendered from this JSON (`GET /leadspace/public/page/<slug>`, shown here for a home-services business, long texts shortened). Build the design against this; do not invent fields. Sections come as `blocks`, and a block may be missing.

```json
{
  "slug": "ravi-plumbing-chennai", "goal": "BOOKING", "templateId": "home-services",
  "theme": { "accent": "#d97706", "accentDark": "#92400e", "soft": "#fffbeb", "ink": "#1f2937" },
  "business": { "name": "Ravi Plumbing Works", "city": "Chennai", "category": "home-services", "categoryLabel": "Handyman and home services" },
  "blocks": [
    { "type": "hero", "headline": "Trusted home services in Chennai", "subline": "Leaks fixed the same day. ...", "image": "https://.../hero.jpg", "primaryButton": "Book a visit" },
    { "type": "offer", "headline": "Monsoon check", "text": "Free leak inspection this month", "validUntil": null },
    { "type": "services", "title": "What we do", "items": [
        { "name": "Tap repair", "priceText": "Rs 350", "description": "Leaking taps fixed", "image": "https://.../tap.jpg", "buyPath": null },
        { "name": "Geyser fitting", "priceText": "Rs 900", "description": null, "image": null, "buyPath": "/ls/ravi-plumbing-chennai/go/1" } ] },
    { "type": "about", "text": "A family-run plumbing team ..." },
    { "type": "gallery", "images": [ { "src": "https://.../1.jpg", "alt": "..." } ] },
    { "type": "trust", "items": ["Background-checked professionals", "Clear price before work starts"] },
    { "type": "map", "address": null, "mapsLink": null, "area": "Adyar, Velachery", "hours": "Mon-Sat 8am-8pm" },
    { "type": "faq", "items": [ { "q": "How soon can someone come?", "a": "Pick a day and time slot ..." } ] }
  ],
  "primaryButton": "Book a visit", "stickyCta": { "label": "Book a visit" },
  "form": { "goal": "BOOKING", "submitLabel": "Book a visit", "consentText": "I agree that ...",
            "fields": [ { "key": "name", "label": "Your name", "kind": "text", "required": true },
                        { "key": "phone", "label": "Mobile number", "kind": "tel", "required": true, "hint": "We send a code to this number on WhatsApp." },
                        { "key": "service", "label": "Service", "kind": "select", "required": true, "options": ["Tap repair", "Geyser fitting"] },
                        { "key": "date", "label": "Date", "kind": "date", "required": true },
                        { "key": "time", "label": "Time slot", "kind": "select", "required": true, "options": ["9 am - 12 pm", "12 pm - 3 pm"] } ] },
  "disclaimer": null, "rera": null,
  "seo": { "title": "...", "description": "...", "canonical": "...", "robots": "index,follow", "jsonLd": { } }
}
```

Rules the design must respect:
- `disclaimer` (advocates, clinics, real estate) must always be visible near the form, not hidden in a fold.
- `rera` (real estate) is shown wherever the business name is prominent, if present.
- The `map` block has **no address and no link**; show it as "Where we serve" with the area and hours only.
- `priceText` may be null (then show "Ask for price" or nothing).
- `buyPath` is null for most items. When it is set, show a secondary "Buy online" link on that item's card (opens in a new tab, `rel="noopener noreferrer nofollow sponsored"`) pointing at exactly that path. It is a counted redirect on our side; never try to read or show the vendor's own address. The item still takes part in the order form as normal.
- Sections without data are simply not shown. A new vendor may have only a name, one service and no pictures: that page must still look good.

## 6. What Bolt delivers

1. A React + TypeScript + Tailwind component set under `src/app/ls/[slug]/themes/` (or a ZIP with the same structure): `LeadSpaceApp` (the bottom-nav shell and the sections) that takes **one prop, `model` (the JSON above)**, plus the variations per trade. Static data only for the preview; no API calls, no routing assumptions.
2. Preview with the sample JSON for at least: home-services, shop-retail (with pictures and the cart), salon-beauty, clinic (with disclaimer), real-estate (with RERA), freelancer (no pictures at all).
3. Phone and desktop screenshots of each.

Claude Code then: plugs the component into `/ls/[slug]`, keeps the working form, view and tap counting, the "Report this page" link, SEO and the JSON-LD, and runs it against real vendors' data.

## 7. Do not

- Do not show or ask for the business's contact details anywhere, and never add call or WhatsApp-the-business buttons.
- Do not add login, payment, chat widgets or third-party scripts.
- Do not remove the "Report this page", the privacy link and the "Page by Get4Domain LeadSpace" footer line.
- Do not call any API from the design components.
