
Branch `v3-build-be`. Worktree `C:\Get4Domain\get4domain-w2`. Never pushed. Source dispatch: `C:\Get4Domain\get4domain-site\DISPATCH_G1_BUILD_BACKEND.md`.

## B0 PLAN: backend jobs from COMPLETION_AUDIT section 7, ordered by the owner's priorities

Covered by an owner priority (P1 to P7) or left out (and why). Repo BE only; every UI or PUB job is out of this lane.

| Order | Audit job | Owner priority | Lane job | Note |
|---|---|---|---|---|
| 1 | Q1 enquiry form post, backend half | P1 | B1 | one public route that takes exactly what the theme form sends |
| 2 | Q4 real vendor alert on a new enquiry | P1 | B1 | alert rows exist; the e-mail leg goes through the guarded mail port (flag stays the owner's) |
| 3 | Q5 backend half (price book, plan prices) | P2 | B2 | reuse existing price-book routes; add only the gap; public pricing reflects them |
| 4 | Q14 backend gaps for the 25 sample-only vendor screens | P3 | B3 | routes that are missing get added; per-pack demo content set |
| 5 | Q9 backend half (claim approval and go-live) | P4 | B4 | |
| 6 | Q8 backend part (`GET /v3/me/billing/orders/:id`), terms and other PARTIAL journey items | P5 | B5 | journeys 1 to 12, each fix with a test |
| 7 | Q21 category alignment, T1 missing packs, T2 premium flag, T3 preview metadata, T4 CI hook | P6 | B6 | plus the theme gallery script |
| 8 | Q16 per-pack specs, Q17a public packs route, per-pack sample content | P7 | B3 / B6 | |
| not in this lane | Q20 real SMS and WhatsApp transport | - | - | needs the owner to pick a provider |
| not in this lane | Q2, Q3, Q6, Q7, Q10 to Q13, Q15 UI parts, Q18 PUB part, Q19 | - | - | UI or PUB repos |
| not in this lane | T5 V2 theme store retirement | - | - | the audit says "owner" decides |

## STATUS

| Row | State | Commit | One line |
|---|---|---|---|
| B0 | DONE | (first doc commit) | plan written |
| B1 | DONE | b7d3a29 | enquiry form route, inbox copy, alert, held rule; staging int 2/2, cleanup 0 |
| B2 | DONE | cb8116c | price book overview, plan price approve, theme switch fee on public pricing |
| B3 | PARTLY | c059801 | customer import, public packs, pack demo content; 10 screens need schema (B3_SCREEN_GAPS.md) |
| B4 | DONE | 37904f4 | claim status route and whole-path test |
| B5 | PARTLY | ee0ba1f | order read, terms flag on registration; staff screens and the gateway run are not backend |
| B6 | PARTLY | 6496d52 | catalogue fixes, previews, gallery script; new theme designs not done |
| B7 | DONE | (docs commit) | build, test:ci 295 suites / 5675 tests, int alone, cleanup 0, baseline, SEE_IT, report |

## ASSUMPTIONS

1. The dispatch's `docs\v3` is the worktree-root folder `C:\Get4Domain\get4domain-w2\docs\v3`, not a folder under `backend-api`.
2. The branch `v3-build-be` already existed with the audit commits at the start; the session continued on it.

## QUESTIONS FOR THE OWNER

See DISPATCH_REPORT_G1.md.
