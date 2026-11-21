# V3 staff actions and per-host visit counts (Block 4b, slice 9; Amendment 09 Part A, Amendment 11 Q12)

Roles: OPERATIONS plays "SUPPORT" (see V3_SUPPORT_TICKETS.md). Every action needs a written reason (5 to 300 characters) and is written to the activity log with the staff member as the actor (the activity interceptor logs every signed-in route under `/v3/admin`). MARKETING is refused everywhere here.

## What already existed (not rebuilt)

| Item | Where |
|---|---|
| A3 delete a listing only when empty | `POST /v3/admin/vendors/:id/lifecycle/delete-empty-listing` refuses with `LIFECYCLE_NOT_EMPTY` when there is business content. **"Otherwise archive"**: archiving is the existing suspend / reinstate (`.../lifecycle/suspend`) and the directory moderate route; no new code. Anything with money history is never deleted. |
| Per-vendor domain log (domain added, verified, certificate state, canonical switch, expiry, renewal, transfer, redirect) | `GET /v3/admin/vendors/:id/domain-log` (a read model over the activity log, time and actor) |
| Assigning a plan | `POST /v3/admin/vendors/:id/subscription` (SUPER_ADMIN, takes effect now) |

## New

| Route | Roles | What |
|---|---|---|
| `PUT /v3/admin/vendors/:id/business-name` | OPERATIONS, SUPER_ADMIN | A2. Free sites too. The old name goes to the history; the payee-name check runs again on every active UPI payee so a mismatch raises its existing alert. |
| `GET /v3/admin/vendors/:id/business-name-history` | same | the earlier names, newest first |
| `POST /v3/admin/vendors/:id/plan-change` | same | A1. Any plan, **now or at an effective date**. Now goes through the one plan assignment (entitlements recalculate; a downgrade follows the Stage 6 rules). A later date waits as PENDING. |
| `GET /v3/admin/vendors/:id/plan-changes`, `POST /v3/admin/plan-changes/:id/cancel` | same | the list, and cancelling a change that has not happened yet |
| `GET /v3/admin/vendors/:id/visits?from&to` | same | Q12. Page visits per host (subdomain and custom domain) per day, defaults to 30 days. Counts only. |
| `POST /v3/admin/listing-merges/plan`, `POST /v3/admin/listing-merges`, `GET /v3/admin/listing-merges`, `POST /v3/admin/listing-merges/:id/reverse` | **SUPER_ADMIN only** | A4. See below. |

A job runs every 5 minutes and applies pending plan changes that are due (each is claimed once, so two runs never apply it twice; a failure is recorded on the change with its reason and never stops the others).

## A4: merging two listings (what is and is not built)

**Built: contacts only.** The merged listing's customers move to the kept listing, with their source rows, in one transaction. A customer whose phone or email the kept listing already has stays where it is and is reported as a conflict (nothing is overwritten). A unique-key clash at the moment of the move rolls everything back and nothing moves. SUPER_ADMIN can undo it until the window ends: the customers that are still on the kept listing go back, and the answer says how many could not (they changed hands since).

**OFF until staff set `adminMergeReversalDays`.** The amendment says 30 days and lists it as an open question, so no number is built in: unset refuses the merge (`ADMIN_MERGE_NOT_ENABLED`). The plan route works either way and says whether merging is on. Set it to 30 once the owner confirms.

**Not built, on purpose:**
- **Pages.** A business has one site document, so there is no page to move; the kept listing keeps its own site.
- **Products.** A product's stock ledger, variants and keyed stock moves must move together and be checked against the kept listing's SKUs; that needs a rehearsal on staging first.
- Merging does not suspend or hide the merged listing: staff do that with the existing suspend action if wanted.

**Money history stays on the original** (orders, sales, payments, documents, wallet). The merge record (`g4d_v3_listing_merges`) is the pointer: it names both listings, who did it and why, and what moved. A consequence to know: an old order or job on the merged listing can still carry the id of a customer that now belongs to the kept listing. Each listing's queries are scoped to its own business, so it reads as a missing customer there, never as a leak.

The merge SQL path (`applyMerge`, `reverseMerge`) has **not been run against a real database**; `test/block4b-stores.int.spec.ts` covers it for the owner's staging run.

## Visit counts (Q12)

The public page route counts each page served for a host (a 200 or a 304) in memory; the counter is written to `g4d_v3_host_visits_daily` every half minute and when the server stops (a crash can lose up to half a minute of counts). A host nobody owns is not counted; only host names that look like host names are counted. The report returns hosts, days and counts and nothing else: no IP, agent or cookie exists anywhere in it. Counts are pages served by the site front end, so a page the front end serves from its own cache is not counted; this is a measure, not an audit. The existing directory click counts (`g4d_directory_visit_daily`) are a different measure (clicks from the directory) and are left as they are.

## Not done

- **A2: the site title and metadata refresh.** The published site reads its business name from its own content document, which the vendor or a staff act-on-behalf edit changes and republishes. This slice changes the business record only. Refreshing the live site title is a publish on behalf of the vendor and is left to that existing flow.
- **A1 on the vendor's own screens and the Stage 6 Pro-features-off behaviour** are the existing plan engine's: this slice calls it and does not reimplement it.
