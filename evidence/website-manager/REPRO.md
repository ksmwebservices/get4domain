# Phase 0 reproduction on test data

Generated 2026-10-14T09:21:13.672Z by scripts/website-manager/repro-public-html.js. A field is saved with a unique marker through PUT /cms/vendor/:id, then the public page HTML (`/site/<subdomain>`, the same renderer every custom domain and subdomain uses) is fetched. "yes" = the marker is in the HTML.

| Field the vendor saves | travel (engine kit) | clinic (engine kit) | retail (hand-built RetailSite) | real estate (hand-built) | general (generic fallback renderer) |
|---|---|---|---|---|---|
| Business name (`businessName`) | yes | yes | yes | yes | yes |
| Tagline (`tagline`) | yes | yes | yes | yes | yes |
| About text (`about`) | yes | yes | yes | yes | yes |
| Logo (`logo`) | NO | NO | yes | yes | yes |
| Banner (`banner`) | yes | yes | yes | yes | yes |
| SEO title (`seoTitle`) | yes | yes | yes | yes | yes |
| SEO description (`seoDesc`) | yes | yes | yes | yes | yes |
| Phone (`phone`) | yes | yes | yes | yes | yes |
| WhatsApp (`whatsapp`) | yes | yes | yes | yes | yes |
| E-mail (`email`) | NO | NO | NO | NO | NO |
| Address (`address`) | yes | yes | yes | yes | yes |
| Opening hours (`businessHours`) | yes | yes | yes | yes | NO |
| Instagram (`instagram`) | NO | NO | NO | NO | NO |
| Facebook (`facebook`) | NO | NO | NO | NO | NO |
| Google Maps (`googleMaps`) | NO | NO | NO | NO | NO |
| Favicon (`favicon`) | NO | NO | NO | NO | NO |
| Portfolio image (`portfolio`) | NO | NO | NO | NO | NO |
