# Dispatch report P3: one free state, the Free plan

Branch `v3-pub-fe11` (from `v3-pub-fe10`). Not pushed. No backend, no .env.

## What changed
- **P3.1** Pricing Free card rewritten in `site-strings.ts` (`SITE.pricing.free`) and `pricing/page.tsx`: title "Free plan", the owner tagline, "Included on Free" (5 points), "Move to a paid plan to unlock" (5 points), buttons "Start free" (to /register?plan=free) and "See paid plans" (jumps to the paid plans block).
  **The Free card text is static, not from the API plan data** (the API feeds only the paid plans), so no fallback was needed.
- **P3.2** "Free trial", "trial site", "Start free trial" removed from the public strings: pricing (meta, intro, FAQ, comparison table "Compare Free and paid" with column "Free plan"), register (title/meta/intro, plan label "Free plan", subdomain hint, success text), home, how it works, product pages, industry and category pages, guides, footer, directory/portal strings, legal text (terms, delivery, privacy, partner). Register h1: "Start with a free site".
- **P3.3** Copy guards: both rule sets (`site-copy-rules`, `legal-copy-rules`) now ban `free trial` and `trial`, still ban `leads`; the legal digit/time-word rule still allows only "48 hours" and "one month" in grievance sentences. New test for the Free plan card wording. Delivery-policy fact test now expects "Free plan site is informational".

## Choices made (details left to me)
- Free sites are called "free site" in running copy, "Free plan site" in legal text.
- Guide `from-trial-to-paid-plan` renamed to `from-free-to-paid-plan` (title "From the Free plan to a paid plan"). **The old URL now 404s**; add a redirect if it was ever indexed.
- The owner phrase "SEO and promotion" conflicted with the existing ban on "promotion"; the pricing copy test now allows that exact phrase only.
- Smoke scripts (`scripts/v3-public/smoke*.mjs`) updated to the new strings; not run (they need a running server).
- The register page title meta still reads as before apart from the wording; no number added anywhere.

## P3.4 Where "Free trial" / trial still comes from (NOT edited)
- Backend: `platform-settings.constants.ts` (setting key `trial_free_credit`, label "Trial sandbox - free credit"), `public-pricing.controller.ts` (`freeCredit.trial`), `vendors.service.ts` (`TRIAL_CREDIT_FALLBACK_PAISE`, wallet note "Trial plan welcome credit", reason `trial_credit`), `auth.service.ts` and `register.dto.ts` comments.
- Admin app (`get4domain_mvp/src/app/admin/pricing/page.tsx`): `trial_free_credit` field in the "Plan Free Credit" group; `src/lib/pricing.ts` type `freeCredit.trial`.
- Vendor-app/site seeds with "Free Trial" as demo gym content (not plan names): `backend-api/src/site-doc/pack-seeds.ts`, `seeds/part1.ts`, `src/data/industry-content.ts`, `engine/**` kit/registry, CRM stage "Trial" in `config/industry-experience.ts`.
- No plan row called "Free trial" was found in the seed files read; plan names for the paid plans come from the API at runtime, so check the live plan table for a Free plan name.

## Verification
- `npm.cmd run test:v3-public`: 414 pass, 0 fail. `npm.cmd run build` (includes typecheck) passes.
