# DISPATCH REPORT F1: V3 completion audit (read-only)

Branch `v3-audit`, documents only, not pushed. Full evidence is in `docs/v3/COMPLETION_AUDIT.md` (sections 1 to 9). Nothing was run: no app, server, database or network. Statements that could not be proven from code are marked UNVERIFIED there.

## Counts

| Measure | Result |
|---|---|
| Backend | 1439 routes: 663 V3, 222 retired per-industry, 421 other legacy, 133 shared |
| Industry packs (16) | 0 REAL, **16 PARTIAL**, 0 MISSING. All run on one generic record engine, one generic vendor screen, and a themed site; none has pack-specific logic or screens |
| Vendor app screens | 16 real (14 routed screens, pack tabs, theme panel), **25 mock-only**, 1 placeholder (AI studio), 1 local. At least 13 of the mock-only ones already have backend routes |
| Admin app | 11 real screens. Of 542 admin routes, 148 have a screen and 394 have none; of the V3 ones, 209 of 337 have none |
| Public site and partner portal | partner portal 5 of 5 data routes real; public site real behind `V3_PUBLIC_ENABLED` (off) and mock-by-default (`V3_PUBLIC_USE_MOCKS`) |
| Journeys (12) | **PASS 5** (2, 5, 6, 10, 11), **PARTIAL 5** (1, 4, 7, 9, 12), **BROKEN 2** (3 enquiry, 8 claim) |
| Launch set (journeys 1 to 7 and 10) | PASS 4, PARTIAL 3, BROKEN 1 |
| Themes | 5 served themes, all tier Standard, no Premium; 41 designed category presets of 196 catalogue categories; 4 of 16 packs have no dedicated theme (PHARMACY, B2B_DEALER, RENTAL_FLEET, MEMBERSHIP_WELLNESS); no per-theme preview |
| Queue | 26 jobs (Q1 to Q21 and T1 to T5); launch set is 9 jobs (Q1 to Q8, Q19); first lane can start now |

## The three biggest blockers for launch

1. **A visitor's enquiry never reaches the vendor (journey 3, BROKEN).** The theme form posts to `/enquire`, but the public app handles only GET (`vendor-site/[[...path]]/route.ts`), the backend route needs a JSON body with consent and an idempotency key that the form does not send, and the vendor Enquiries screen reads the mail inbox, not the requests inbox. Even when fixed, no e-mail, SMS or WhatsApp alert is sent to the vendor (messaging is sandbox only). Jobs Q1 to Q4.
2. **The owner cannot enter plan prices, features, tax rates or the price book in the admin dashboard.** No admin screen exists for 26 plan routes and 16 price-book routes, so plan, add-on, service, theme-switch and domain prices stay PENDING and checkout and theme switching cannot be completed. Job Q5.
3. **Nothing has been exercised end to end with real services.** Payments are off, e-mail is off (claim and reset codes and receipts cannot be sent), the public site is off and mock-by-default, and the vendor app has no terms-acceptance screen (needed to publish a paid site). Journeys 4, 6 and 9 were never run against a gateway (FRONTEND_GAPS S8). Jobs Q6, Q8, Q19 and the owner switches in section 8.

Also found: a claimed directory listing never goes live because no vendor screen calls the claim approval (journey 8, job Q9).

## Where to look

- Section 1: backend inventory and every OFF switch, with the effect on an enquiry.
- Section 2: the 16 packs. Section 3: vendor app tab by tab. Section 4: admin screens and unscreened routes, ranked.
- Section 5: public site, partner portal and open gaps. Section 6: the 12 journeys with the exact break.
- Section 7: the ranked queue, lanes, launch versus complete, job lists for dispatch files. Section 8: owner switches. Section 9: theme inventory.
