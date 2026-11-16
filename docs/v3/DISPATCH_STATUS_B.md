# Dispatch B status (frontend lane)

| Step | State | Commit | Note |
|---|---|---|---|
| K0 S6 step 0 plan | DONE | 14d827b | HOSTNAMES_PLAN.md |
| K0 S6 step 1 hostnames module | DONE | 64544b3 | six env names, reserved data, classifier |
| K0 S6 step 2 host routing | DONE | e9f4451 | flag and MAIN_HOST guarded |
| K0 S6 step 3 directory on its host | DONE | 91feaec | robots and sitemap per host; backend items recorded as blocking |
| K0 S6 step 4 vendor renderer | DONE | 5e401d8 | proxy of the backend's stored pages, V2 fallthrough |
| K0 S6 step 5 checks and docs | DONE | 27c8418 + docs commit | smoke 590 checks, 160 unit tests |
| K1 S7 step 0 plan | DONE | 0f667f6 | PUBLIC_COMMERCE_PLAN.md |
| K1 S7 step 1 pricing | DONE | 55f172d | /pricing via main-host rewrite to /v3-site/pricing |
| K1 S7 step 2 register and login | DONE | b8c8c29 | /register, /directory-api/register and /subdomain; /login rewrites to the Slice 4 sign-in |
| K1 S7 step 3 referral | DONE | e273155 | /r/{code} route handler sets the cookie; /referral-link neutral page |
| K1 S7 step 4 marketing pages | DONE | 61c5be4 | six pages; sitemap needs no addition (same addresses as the live pages) |
| K1 S7 step 5 tests and checks | DONE | b6c79b2 | 216 unit tests, 795 smoke checks (three servers) |
| K1 S7 step 6 docs | TODO | | |

## ASSUMPTIONS
- Host layer active only with the flag and MAIN_HOST (keeps current staging working).
- Redirects always https (request scheme not trusted).
- Main host does not serve directory addresses; directory host serves claim/account/legal too.
- V3 asked first for vendor hosts, V2 for hosts V3 answers 404.

## QUESTIONS FOR THE OWNER
- nginx order for V2 names (G24). Backend items A to F (G26).
