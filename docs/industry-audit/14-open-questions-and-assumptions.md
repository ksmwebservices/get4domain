# 14 Open questions, conflicts, assumptions, totals (Stage 1, lane V2)

## A. Conflicts with the owner's decisions and with the brief (reported, not resolved)

| # | Conflict | Evidence | Where |
|---|---|---|---|
| C1 | **Owner: vendors may pick several related categories. Code: one category per vendor.** | `g4d_vendor_packs.vendorId @unique`; `POST /v3/me/pack/register` returns `PACK_ALREADY_SET` for a different category | file 10 row 13 |
| C2 | **Owner: a category may sit in several families. Code: registration side holds one family string and one pack per category.** The E1 tables hold many-to-many but registration does not read them | `g4d_pack_categories.family`, `packKey` | file 10 row 2 |
| C3 | **Owner: 45 packs. Brief rule 2: do not create packs to raise the count. Code: 16.** Evidence for and against and a recommendation (family bundles plus archetype blocks) are in file 15 section 5; the owner decides | | file 15 |
| C4 | **Owner: three levels. Brief: six.** Recommendation: keep three; variants and specializations at vendor level | | file 15 section 4 |
| C5 | **Owner: no priorities. Brief phase 10 and the final report ask for priorities and a top 20.** The top 20 below are ranked by how much of the system each blocks, not by industry priority | | section B |
| C6 | **Owner: Free sites are information only. Brief phase 6 wants "Call Emergency" for ambulance.** Free pages show the phone as plain text with no tap-to-call, so an emergency service on Free has no call button | V1 K; `p11` tests | file 12 5.4 |
| C7 | **Owner: vendor address only `<name>.get4domain.com`.** V1 found three places that broke it. Commit `aa0d08d` on this branch says the path address now redirects (301) or 404s, links are host-relative and one canonical is built; **I did not re-verify this**, so V1 section M may be partly closed | | not rechecked |
| C8 | Owner: Pro plans are paid only through the Get4Domain payment link. No code read here contradicts it; vendor-to-customer payments use the vendor's own UPI or gateway and are a different flow | `v3-payments`, `plan-billing` | not audited further |
| C9 | The brief names a 48-family list; the owner's master is 45 families. Two checklist families (46, 47) have no master family | | file 15 |
| C10 | The brief's Phase 5 wants a menu per industry; the code has three menus by plan tier (handyman, professional, ecommerce) | `config/nav.ts` | file 01 section 4 |

## B. Top 20 critical gaps

Ranked by the share of the 1,213 categories and of the owner's decisions each one blocks. No industry is ranked above another.

1. **No configurable workflow definition.** Status paths are constants in code; pack "workflows" are stage names; no workflow, step or category mapping table. Blocks every archetype (file 10 row 11).
2. **One category per vendor** (`vendorId` unique). Blocks the owner's multi-category decision (C1).
3. **1126 of 1,213 master categories cannot be registered** (no operational record); only 196 registrable; admin cannot create a category or a pack (`PUT` returns 404 for an unknown key).
4. **No public form per category.** Request fields are fixed (message; service, date, time; service, details, budget). Stove brand, pest type, tile area, ambulance type cannot be captured.
5. **No emergency dispatch at all**, and ambulance and towing sit on logistics and workshop packs.
6. **No site inspection, measurement or BOQ** (capabilities MISSING); quote quantity must be a whole number, so areas, litres and metres do not fit.
7. **Job screen defect:** "Mark done" posts `COMPLETED` (API accepts `DONE`); no actions for book, start or assign; no parts, photos or checklist although the menu text promises them.
8. **Quote acceptance is vendor-recorded;** no customer approval link, no versions; "send" only marks.
9. **Technician and crew assignment is free text:** no person row, availability, crew or route.
10. **No recurring visit scheduling** (AMC, revisits, water-can and tiffin routes, waste pickup, facility contracts); AMC is a note list.
11. **Menus follow the price tier, not the industry** (three menus); pack tabs are generic record lists with no links between records.
12. **12 of 16 packs are CONFIGURED ONLY;** none is COMPLETE; all `DRAFT`; four are hidden behind the counsel switch.
13. **Five category lists and four meanings of "pack";** E1 taxonomy is not read by registration, directory or sample generator.
14. **Duplicated V2 and V3 systems** (jobs, customers, leads, catalogue, stock, invoices, appointments) with no stated owner.
15. **Handyman tier cannot hold appointments or a store;** trades cannot offer a customer-chosen slot.
16. **12 master families have no operational home;** checklist families 46 and 47 and about 27 business groups are absent from the master (file 12).
17. **No warranty, service history link, certificates or hand-over documents per job.**
18. **No branch entity;** staff roles are area switches, not "own jobs only".
19. **Notifications and live providers unverified:** WhatsApp, e-mail and SMS are sandbox or flag-off; no event-driven message per workflow step; payment confirmation is manual.
20. **Regulated categories lack per-category disclaimers and licence fields** (270 of 1,213 carry a keyword flag in file 09); public institutions and policy-sensitive categories (file 11 section 3) have no scope decision.

## C. The totals the brief asks for

| Item | Number |
|---|---|
| Existing industry packs found | **16** V3 industry packs (all `DRAFT`), plus 5 add-on packs; also 24 V2 category packs, 20 V2 industry experiences, 30 kit design packs (4 meanings, file 01 section 5); 95 rows in file 08 |
| Existing families and categories | **21 code families, 196 registrable categories** (live seed); master 45 families, 1,213 unique categories (1,277 links) in the E1 data file |
| Categories fully implemented (COMPLETE) | **0** of 1,213 (0 of 196) |
| Categories partially implemented | **41** of 1,213 (107 of the 196: a dedicated module backs the core step) |
| Categories configuration only | **43** of 1,213 (85 of the 196) |
| Categories missing | **1126** of 1,213 have no operational record; 1 cannot be classified; 2 are matched but on the wrong pack |
| Duplicate or misclassified | master: 29 same-business name sets (about 60 categories) plus 13 overlap groups; existing: 4 on a wrong pack, 18 on a NEAR-fit pack, 13 with a family label that disagrees with the master, 3 doubtful alias matches (file 11) |
| Reusable capabilities found | **35 of the 40 in brief phase 4** (30 PARTIAL, 5 CONFIGURED ONLY); 14 pack-engine capability keys exist as switches; 0 COMPLETE |
| Capabilities missing | **5 of the 40** (site inspection, BOQ, emergency dispatch, supplier portal, multi-branch) plus 7 of the 11 the audit added (workflow definition, multi-category vendor, price approval, recurring visit schedule, item intake, inpatient beds, donation receipts) |
| Workflows (39 archetypes) | **8 PARTIAL**, **26 CONFIGURED ONLY** (17 on a fitting pack, 9 on a NEAR-fit pack), **4 MISSING** (emergency dispatch, nonprofit and donation, scheduled pickup and collection, domestic staff care), 1 listing only, **0 COMPLETE** |
| Recommended master architecture | Family (45, as bundles) to Category (1,213, many-to-many) to Service (vendor catalogue); a **workflow archetype block** per category chooses behaviour; capability set per archetype; family bundle holds names, defaults, disclaimers, sample data; vendor many-to-many categories (file 15 section 5 and file 10 section 4) |
| Recommended implementation order | Stage 2 (not written here, by instruction) |

## D. Open questions for the owner

Each is a decision the audit cannot make from the code.

1. **Which "pack" is meant by 45?** Four things carry the word (file 01 section 5). File 15 assumes the V3 industry pack.
2. **Family bundles plus archetype blocks** (file 15 section 5): accept, or require a workflow per family?
3. **Three taxonomy levels:** confirm; add service variants at vendor level?
4. **Mixed families** (12 families are 80 percent or more one archetype, 10 are under 50 percent): is "dominant archetype as default, listed overrides" acceptable for the mixed ones: Textiles, Clothing & Fashion (33%), Security & Safety (42%), Agriculture & Farming (35%), Electronics & Electrical (39%), Pets & Animal Services (23%), Real Estate & Property (48%), Automobiles & Two Wheelers (32%), Baby, Child & Family Services (35%), Home, Garden & Outdoor (36%), Other Local Businesses (38%)?
5. **Alias table:** who reviews the 74 aliases (3 doubtful) and the 110 unmatched existing categories (104 have candidates)?
6. **Master additions:** add the missing businesses of file 12 (gas stove and LPG stove, mosquito nets, roller shutters, ICU ambulance, patient attendants, escalator, CNC machining, sub-broker, water tanker, bathroom fitter, borewell drilling, key duplication, alteration, lift) and the 24 candidate groups, and checklist families 46 and 47?
7. **Public institutions** (19 in file 11 section 3): customers, or out of scope?
8. **Ambulance and emergency:** counsel gate (health), Free-page tap-to-call exception, response-time expectations, which tier.
9. **Workflow engine:** definitions in the database (data driven) or coded blocks configured by data? This decides file 10 row 11.
10. **Tier model:** should visit-slot booking be allowed on Handyman 499? The DISPATCH cell there is marked ASSUMED_FOR_OWNER_REVIEW.
11. **Duplicated V2 and V3 systems:** which one survives for jobs, customers, leads, catalogue, stock, invoices, appointments; what happens to the four connected client apps?
12. **Counsel switch:** CLINIC, LAB, PHARMACY and PRACTICE_LEGAL_FINANCE are hidden until `gatedPacksOpen`; 270 categories carry a regulatory keyword flag.
13. **Policy-sensitive categories:** lottery shops, psychic and tarot readers, debt recovery agencies, sexologists, overseas job consultants, pesticide dealers.
14. **Quote approval:** vendor-recorded acceptance is today's rule; should the customer approve (link, OTP)?
15. **Canonical job status:** `DONE` or `COMPLETED`? (the app and the API disagree; engineering fix in a later lane).
16. **Was `20270110100000_v3_e1_taxonomy` applied anywhere,** and does the live data equal the seed file? Not checkable here.
17. **Sample data:** per archetype or per category? (Stage 2 input.)

## E. Assumptions made in this audit

1. Archetypes are my classification, not code. Method per row is in file 09 (`archetype_method`: rule on the name 976, hand override 190, family default 47; 19 rows low confidence; 1 INCOMPLETE).
2. For a master category, "MISSING" means no operational category record (a vendor cannot register under it). It does not mean no pack could serve it; `nearest_existing_pack_proposal` says which would.
3. The 74 aliases are taken as E1 wrote them (the file says NEEDS OWNER REVIEW).
4. PARTIAL versus CONFIGURED ONLY: PARTIAL where a dedicated module backs the core step (FIELD_SERVICE jobs and quotes; RETAIL store; CLINIC and MEMBERSHIP_WELLNESS appointments); CONFIGURED ONLY where the pack tabs are generic record lists. Nothing is COMPLETE because nothing was run and all packs are `DRAFT`.
5. I assumed the vendor app shows Jobs and Quotes to the `handyman` track only and bookings to `professional` (read from `config/nav.ts`); I did not run the app.
6. V2 modules (clinic, hotel, gym, construction, travel and others) are counted as existing but not as reachable from the V3 vendor app; that was not verified (NEEDS VALIDATION).
7. Compliance flags in file 09 are keyword hints for counsel review, not legal advice.
8. Counts come from the named branches. The common tab count is 26 in the seed JSON; V1 said 24.
9. Audit V1 findings are cited unchanged except where this audit says otherwise; V1's address-rule findings were not re-checked after `aa0d08d`.
10. The 110 unmatched existing categories carry word-overlap candidates; these are not decisions.

## F. What Stage 2 needs

- Owner answers to questions 1, 2, 4, 6, 7, 9, 10 and 11 above (they change what is built).
- The archetype list (file 01 appendix) reviewed and merged into shared blocks (39 now; about 12 groups expected).
- The alias and unmatched mapping decided so that the 196 move under the master.
- Decision on the counsel switch and on regulated categories before health, finance, legal, pest and waste families get workflows.
- Agreement on which of the duplicated V2 systems stays, before blocks are written against the V3 tables.
- Per-archetype workflow detail (steps, fields, menus, CTAs, reports), which this stage did not write by instruction; the four test cases in file 12 are the worked examples to start from.
