PROMPT T1B: Free sites technical upgrade (same Bolt themes project; paste after T1)

Free sites keep the five layouts and the 41 category presets from T1. This prompt raises their technical quality for every category. Do not change Pro themes or the lint rules except where stated. Every Free layout must pass lint for all 41 categories.

RESPONSIVE AND PERFORMANCE
- Mobile-first at 360, 414, 768, 1024, 1280 and 1536 px. No horizontal scroll at any width. Fluid type and spacing with clamp(); container queries for cards.
- Images: width and height set on every image, srcset and sizes slots in the binding (data-g4d-img supplies the source set), loading=lazy below the fold, hero image eager with fetchpriority high, modern formats supplied by the platform.
- CSS under 40 KB per layout, no render-blocking fonts: approved fonts only, with font-display swap and a system-font fallback stack.
- Layout shift: reserve space for all slots (map, enquiry form, reviews) so nothing jumps.
- Performance readout in the harness: CSS size, image count, estimated LCP element, layout shift risk.

ACCESSIBILITY
- AA contrast (lint check), visible focus states, skip-to-content link, one H1, landmark regions, button and link sizes at least 44 px on touch, alt text required, language attribute, form labels in the enquiry slot, reduced-motion support.

LIGHT MOTION (CSS only, from the T5 kit at Low intensity; paste order does not matter)
- Gentle reveal for cards below the fold, hover lift, animated call button underline, smooth mobile menu. First screen is never hidden. Respect prefers-reduced-motion.

ADVANCED FREE FEATURES (still script-free in the theme; the platform provides behaviour through slots)
- Sticky mobile action bar: Call, WhatsApp, Directions (CSS only).
- Click-to-call, WhatsApp, email, map directions links with tracking attributes the platform reads.
- Open-now badge slot and today's hours highlight (platform slot).
- Enquiry form slot (name, phone, message, consent), booking request slot for Professional, product enquiry slot for Ecommerce Shop Lite.
- Reviews slot (real reviews only), map slot, WhatsApp float slot, listed-on-Get4Domain badge slot.
- Gallery with CSS-only lightbox, FAQ using native details, service price list, service area chips, hours table.
- Dark mode via prefers-color-scheme using the token set; the vendor accent colour stays readable (contrast checked).
- Share and QR block: a printable QR code for the site address (platform generated) and share links as plain anchors.
- Print stylesheet: business card style print of name, address, phone, services.
- Language support: layout works with English and Tamil text (font stack with Tamil glyphs, no text overflow) and with right-length variations; show a text-stretch test in the harness.
- Structured data, canonical, title, meta and sitemap are added by the platform; the layouts must expose the fields that feed them (name, address, phone, hours, services, FAQ, geo, logo, images).

CATEGORY FIT
Each of the five layouts keeps its category presets, but add per-family extraBlocks placement checks so a clinic shows credentials and timings first, a plumber shows emergency badge and areas first, a bakery shows menu and order enquiry first, and so on, for all 41 categories.

ACCEPTANCE
All 41 categories pass lint in the five Free layouts. Performance readout shown for each layout. Text-stretch and Tamil text tests pass at 360, 768 and 1280 px. Reduced-motion toggle shows a fully static site. Show the coverage page. List files.
