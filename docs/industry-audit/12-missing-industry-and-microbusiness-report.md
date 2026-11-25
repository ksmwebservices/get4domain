# 12 Missing industries and microbusinesses (Stage 1, lane V2)

"Missing" has three meanings here, kept apart: **(a)** the business is not in the master list at all; **(b)** it is in the master but a vendor cannot register under it (no operational record); **(c)** a vendor can register but the workflow it needs is not built. Section 1 is (a); sections 2 and 3 are (b); section 5 (the four test cases) is (c).

## 1. The brief's own examples against the master list (1,213) and the 196 existing categories

| # | Example from the brief | In the master (1,213) | Among the 196 existing | Result |
|---|---|---|---|---|
| 1 | Gas stove repair and LPG stove service | none (0 hits for stove or LPG) | none (nearest: ac-appliance-repair, handyman-general-services) | MISSING everywhere |
| 2 | Pest control and termite treatment | Pest Control, Termite Control, Pest Management, Pesticide Dealers | pest-control | present |
| 3 | Mosquito mesh and window net fabrication and installation | none | none | MISSING everywhere |
| 4 | Curtain, blinds and roller-shutter installation | Curtain Shops, Blinds Dealers (shops, not installers); roller shutter none | curtain-blinds-installer | roller shutter MISSING everywhere; installer only in the 196 |
| 5 | Tiles and granite laying contractors | Tile Contractors, Granite Contractors, Flooring Contractors | tiles-flooring-contractor (not matched by E1) | present |
| 6 | Marble polishing and flooring | Marble Contractors, Marble Dealers, Flooring Contractors (polishing as a service: none) | wallpaper-flooring-installer | partly |
| 7 | Bathroom fitting and renovation | Bathroom Fittings (a shop), Renovation Contractors, Bathroom Cleaning | bathroom-sanitary-products (a shop) | partly: no bathroom fitter |
| 8 | Waterproofing and leakage repair | Waterproofing, Waterproofing Contractors | waterproofing-contractor | present |
| 9 | Borewell drilling and motor repair | Pump Repair, Electrical Motor Repair; drilling none | borewell-drilling | drilling only in the 196 |
| 10 | Water tanker and drinking-water supply | Water Can Suppliers, Mineral Water Suppliers; tanker none | none | partly: no tanker |
| 11 | Ambulance and patient transport | Ambulance Services, Pet Ambulance; patient transport none | ambulance-service | present but on the wrong pack |
| 12 | ICU and ventilator ambulance | none | none | MISSING everywhere (no ambulance type field either) |
| 13 | Speech therapy and occupational therapy | Speech Therapy Centres, Occupational Therapy | child-therapy-centre | present |
| 14 | Dental, skin, hair and eye clinics | Dental Clinics, Dentists, Skin Clinics, Skin Care Clinics, Hair Transplant Clinics, Eye Specialists, Ophthalmologists | dentist, skin-hair-clinic, eye-clinic | present |
| 15 | CA, GST, tax filing and audit | Chartered Accountants, GST Consultants, Tax Return Filing, Auditors and 19 more (family 18: 23 categories, 0 matched) | ca-tax-consultant, company-registration-gst-consultant | present |
| 16 | Civil, criminal, family, property and patent advocates | Civil, Criminal, Family, Property Lawyers, Patent Consultants | lawyer (one category for all) | present |
| 17 | Stock sub-brokers and financial distributors | Stock Brokers, Share Trading Consultants, Mutual Fund Agents (no "sub-broker") | mutual-fund-distributor | sub-broker MISSING everywhere |
| 18 | Property agents, rental agents, property managers | Real Estate Agents, Rental Management, Property Management | real-estate-agent, property-management | present |
| 19 | Solar panel installation and maintenance | Solar Panel Installation, Solar Equipment Dealers, Solar Energy Companies | solar-installer | present |
| 20 | CCTV, access control and fire safety | CCTV Installation, Access Control Systems, Fire Safety Services, Fire Safety Contractors | cctv-security-installer, fire-safety-installer | present |
| 21 | Locksmith and key duplication | Locksmiths; key duplication none | locksmith, key-duplication | key duplication only in the 196 |
| 22 | Laundry, ironing and dry cleaning | Laundries, Laundry Services, Ironing Services, Dry Cleaners | laundry-dry-cleaning | present |
| 23 | Tailoring, embroidery and alteration | Tailors, Tailoring Services, Embroidery Services; alteration none | tailoring-alterations | alteration only in the 196 |
| 24 | Appliance installation and servicing | Home Appliance Repair, AC Installation, Washing Machine Repair and others; appliance installation as such none | ac-appliance-repair | partly |
| 25 | Lift and escalator maintenance | none | lift-elevator-service | lift only in the 196; escalator nowhere |
| 26 | Welding, fabrication and CNC machining | Fabricators, Steel and Aluminium Fabricators, Welding Equipment Dealers, CNC Machine Dealers (dealers only) | welding-fabrication | CNC machining job shop MISSING everywhere |
| 27 | Signboard, flex printing and advertising fabrication | Sign Board Manufacturers, LED Sign Boards, Flex Printing, Hoarding Advertising | sign-board-flex-printing | present |
| 28 | Domestic workers, cooks and patient attendants | Domestic Help Agencies, Cooks on Hire, Home Cooks, Nannies, Babysitters, Home Nursing Services; maids and patient attendants none | none | partly; patient attendants MISSING everywhere |
| 29 | Packers, movers and local delivery operators | Packers & Movers, Household Shifting, Last Mile Delivery, Delivery Services | packers-movers | present |
| 30 | Event equipment and machinery rentals | Event Equipment Rental, Machinery Rental, Construction Equipment Rental, Crane Rental, JCB Rental | event-decor-tent-house | present |

**Result: 30 examples; 3 are absent from both lists as a business** (gas stove and LPG stove repair, mosquito mesh and window nets, ICU and ventilator ambulance) and further parts are absent: roller shutters, patient attendants, escalator maintenance, CNC machining job shop, stock sub-broker, water tanker, bathroom fitter, marble polishing. **Four exist only among the 196, not in the master**: borewell drilling, key duplication, clothing alteration, lift maintenance. The brief says these must not be overlooked; the owner's master file omits them, so the 1,213 count is not yet the full list.

## 2. Candidate microbusinesses the audit found that neither list has

Found by testing about 45 common Indian local-service terms against the master; **24 groups are absent** (unreviewed; some may be intentionally out of scope; none is an invented business, each is a normal trade):

- driver on call and acting drivers
- auto rickshaw and auto taxi service, bike taxi
- cable TV, DTH and broadband operators; antenna and DTH installation
- LPG gas agency and cylinder delivery (only oxygen and industrial gas exist)
- funeral, cremation, hearse and mortuary freezer box services
- dialysis, IVF and other single-speciality centres
- palliative care, home ICU set-up, physiotherapy at home
- home blood sample collection (exists only as a pack add-on, not a category)
- utensil and catering vessel rental
- grill, gate and railing fabrication; awning, canopy and tensile roof
- wooden, vinyl and laminate flooring; wall painting and murals
- solar water heater
- tractor and harvester hire; crop-spraying drones
- soil and water testing labs
- kennels and pet cremation
- RTO licence and vehicle registration agents; FASTag and challan services
- pottery, terracotta and handicraft makers; home food makers (pickle, papad, home bakers)
- chit funds and pawn brokers (regulated)
- weighbridges
- gaushalas and cow shelters
- mobile recharge and prepaid top-up
- knife and tool sharpening; umbrella and luggage repair
- tent, pandal and shamiana
- AC duct and HVAC cleaning

## 3. Master families where almost nothing is operational

12 of the 45 families have **no matched existing category at all** (so no vendor can register under any of their 285 categories today, and no pack was ever aimed at them):

- 18 Chartered Accountants & Taxation: 23 categories
- 24 Agriculture & Farming: 31 categories
- 28 Rental & Hire Services: 32 categories
- 29 Entertainment & Recreation: 26 categories
- 32 Government & Public Services: 24 categories
- 33 Recruitment & Job Services: 20 categories
- 36 Advertising, Printing & Branding: 30 categories
- 37 Textiles, Clothing & Fashion: 24 categories
- 39 Waste Management & Environment: 20 categories
- 42 Baby, Child & Family Services: 20 categories
- 43 Medical & Home Care Equipment: 15 categories
- 44 Industrial, Commercial & Office Services: 20 categories

Overall: of 1,213 master categories, **1126 have no operational record (MISSING)**, 41 are PARTIAL, 43 CONFIGURED ONLY, 2 matched to the wrong pack, 1 cannot be classified (Miscellaneous Local Services). Zero are COMPLETE. File 09 has the row for every category.

Families missing from the master that the checklist has: Marine, aviation and specialist transport (46); Nonprofits and associations (47); and partly Domestic and family services (39) and Water, energy and environment (41) (file 15).

## 4. What a microbusiness needs that the code does not give yet

A solo technician, a home cook, an ambulance owner with two vehicles or a tutor shares four needs; the code covers some:

| Need | Today |
|---|---|
| A usable page with no staff and no GST number | PARTIAL: Free site (information only, by owner rule); tax profile types the document (tax invoice, bill of supply, bill or fee receipt) so a vendor without GSTIN can still issue a receipt |
| Take a job by phone or WhatsApp and track it | PARTIAL: `POST /v3/me/jobs` ("a request that came by phone or in person") exists; WhatsApp is a sandbox |
| Be paid without a gateway | PARTIAL: UPI pay link and offline record, the vendor confirms from the own bank app |
| One person doing several things | MISSING: one category per vendor (`vendorId` unique) |
| A sole operator who is also the only technician or driver | PARTIAL: assignee is free text; no availability |
| Offline or low-bandwidth use | NOT CHECKED (the vendor app mobile behaviour was not read) |

## 5. The four test cases: exactly what the code can and cannot do today

Method: each step of the brief's workflow is followed through the routes, tables and screens read in this audit. CAN = built and connected as the step needs; PARTLY = something stores or does part of it; CANNOT = no field, table or route. Nothing was executed, so even a CAN is "by reading". The category is judged as a vendor on **Handyman 499** (the tier all four sit on today; its capabilities are SERVICES and DISPATCH only, no appointments, no store).

### 5.1 Gas stove repair

Category: **no category exists** under this name in the master or the 196. A vendor would pick `ac-appliance-repair` ("Ac appliance repair") or `handyman-general-services` (FIELD_SERVICE, A01). The master's nearest, Home Appliance Repair, is MISSING as a registrable category.

| # | Brief step | Verdict | What the code does or lacks |
|---|---|---|---|
| 1 | Customer enquiry | CAN (Pro only) | `POST /v3/public/sites/:host/enquire` and `/requests` write a `V3Request`; a Free site has no form (owner rule) |
| 2 | Select service | PARTLY | starter service names picked at registration; the QUOTE request has a free-text service; no pick-list on the public form |
| 3 | Stove brand, model, issue | CANNOT | request fields are fixed per kind (message, or service/details/budget); nothing varies by category |
| 4 | Choose visit slot | CANNOT (customer) / PARTLY (vendor) | appointments are not available on Handyman; the vendor sets `scheduledAt` on the job |
| 5 | Assign technician | PARTLY | `assignedTo` is free text (`PUT /v3/me/jobs/:id`); generic dispatch tab is a note list |
| 6 | Diagnose | CANNOT | no inspection record; notes field only |
| 7 | Prepare estimate | PARTLY | `V3Quote` lines with GST; quantity must be a whole number |
| 8 | Customer approval | CANNOT | the vendor records "customer accepted" (`POST /v3/me/quotes/:id/accept`); no customer link |
| 9 | Repair and parts | PARTLY | job path to IN_PROGRESS and DONE exists in the API; the app's Mark done sends COMPLETED and fails; parts stock is not tied to the job |
| 10 | Payment | PARTLY | UPI pay request, vendor marks paid, job to PAID |
| 11 | Invoice | PARTLY | receipt or invoice typed from the tax profile |
| 12 | Service history | CANNOT (automatic) | generic `service_history` tab, typed by hand, not filled from jobs |
| 13 | Warranty and repeat service | CANNOT | no warranty period, expiry or reminder |

Tally: 1 CAN, 7 PARTLY, 5 CANNOT. Required fields: usable as free text or fixed fields: problem description, required parts (as quote lines), customer address, visit schedule, technician (text), labour and parts charges (6 of 12). Not possible: stove type and brand, model, burners, gas type, inspection findings, warranty period (6 of 12).

### 5.2 Pest control

Category: `pest-control` exists (Cleaning, pest and garden; FIELD_SERVICE; Handyman 499; matched to the master's Pest Control). Termite Control, Pest Management and Pesticide Dealers are MISSING as registrable categories. Flag: pesticide or pest licence (counsel).

| # | Brief step | Verdict | What the code does or lacks |
|---|---|---|---|
| 1 | Enquiry | CAN (Pro only) | as 5.1 |
| 2 | Select pest problem | CANNOT | free text |
| 3 | Property details (type, size, rooms or floors) | CANNOT | no fields |
| 4 | Inspection booking | CANNOT | no inspection; a job with a date is the only stand-in |
| 5 | Inspection report | CANNOT | none |
| 6 | Treatment proposal | PARTLY | a quote |
| 7 | Customer approval | CANNOT | vendor-recorded |
| 8 | Schedule treatment | PARTLY | one `scheduledAt` |
| 9 | Assign technician | PARTLY | free text |
| 10 | Record chemicals and materials | CANNOT | no materials on `V3Job`; parts stock not tied; quote quantity is a whole number (litres do not fit) |
| 11 | Complete treatment | PARTLY | DONE exists; app button mismatch |
| 12 | Certificate or report | CANNOT | documents are receipts and invoices only |
| 13 | Payment | PARTLY | as 5.1 |
| 14 | Warranty, revisit, AMC | CANNOT | generic `amc_contracts` tab (dates and amount) with no visit schedule or reminder |

Tally: 1 CAN, 5 PARTLY, 8 CANNOT. Required fields: usable: technician (text), treatment date, an AMC note (3 of 12). Not possible: pest type, property type, size, rooms and floors, severity, treatment type, materials and chemicals, safety instructions, revisit date.

### 5.3 Tiles contractor

Category: `tiles-flooring-contractor` exists (Home repair and trades; FIELD_SERVICE; Handyman 499; **no starter services seeded**, not matched by E1 to Tile Contractors, Flooring Contractors, Granite Contractors or Marble Contractors, which are MISSING as registrable categories).

| # | Brief step | Verdict | What the code does or lacks |
|---|---|---|---|
| 1 | Enquiry | CAN (Pro only) | as 5.1 |
| 2 | Site inspection | CANNOT | capability missing |
| 3 | Area measurement | CANNOT | no length, width or area; quote quantity must be a **whole number** (`Number.isSafeInteger` in `buildQuote`), so 112.5 sq ft cannot be entered |
| 4 | Tile and material selection | CANNOT | no catalogue-to-quote link; no tile type or size field |
| 5 | BOQ | CANNOT | no BOQ anywhere in the code |
| 6 | Labour and material estimate | PARTLY | quote lines, free names |
| 7 | Customer approval | CANNOT | vendor-recorded |
| 8 | Work scheduling | PARTLY | one date, no duration or multi-day plan |
| 9 | Labour assignment | PARTLY | one free-text name; no crew |
| 10 | Material tracking | CANNOT | none on the job |
| 11 | Work progress | PARTLY | job states only |
| 12 | Milestone billing | CANNOT | pay requests are manual one at a time; no schedule |
| 13 | Final inspection | CANNOT | none |
| 14 | Completion and payment | PARTLY | DONE then PAID |

Tally: 1 CAN, 5 PARTLY, 8 CANNOT. Required fields usable: site address, labour cost, material cost (as quote lines), assigned worker (text), completion status (5 of 10). Not possible: room or area, length, width and area, tile type and size, quantity and wastage, project milestones (V2 `ConstructionProject`, `ProjectMilestone`, `ProjectMaterial` exist but are not shown to be wired to the V3 app).

### 5.4 Ambulance, judged as emergency dispatch

Category: `ambulance-service` exists in family "Moving and transport", Handyman 499, on the **LOGISTICS pack**, optional capability DISPATCH, **no starter services**. The master has Ambulance Services (Healthcare, matched but MISCLASSIFIED) and Pet Ambulance (MISSING). ICU and ventilator ambulance types exist nowhere. The LOGISTICS pack's public flow is "get a quote, track shipment, services and routes", and its tabs are shipments, trips, vehicles, drivers, tracking and proof of delivery.

| # | Brief step | Verdict | What the code does or lacks |
|---|---|---|---|
| 1 | Emergency or booking request, with priority | CANNOT | no priority or urgency field; request kinds are enquiry, appointment, quote; a Free site shows the phone as plain text (no tap-to-call, owner rule); the logistics pack CTA is "get a quote" |
| 2 | Select ambulance type | CANNOT | no type field, no services seeded |
| 3 | Pickup and destination | CANNOT | the trip tab has from-city and to-city text; the job has one address |
| 4 | Check vehicle availability | CANNOT | the vehicles tab is a free list with no status or availability |
| 5 | Dispatch | CANNOT | the dispatch tab is a note list (job, assignee text, date, note); no state, no nearest-vehicle, no acknowledgement or time stamps |
| 6 | Assign driver and medical staff | CANNOT | free text; no crew, no qualification |
| 7 | Record trip | PARTLY | generic trips list (vehicle, driver, from, to, date) |
| 8 | Handover | CANNOT | none |
| 9 | Billing and payment | PARTLY | pay request and receipt; no distance or time charge |
| 10 | Trip history | PARTLY | the generic trips list |

Tally: 0 CAN, 3 PARTLY, 7 CANNOT. Fields usable: vehicle (text), driver (text), date (3 of 10); not possible: ambulance type, life support level, patient transport requirements, pickup and destination (addresses), emergency priority, medical staff, equipment checklist, distance and charges, handover details.

**Verdict as emergency dispatch: not supported at all.** Treating it as a clinic appointment is also not possible: appointments are not available on Handyman and the appointment path is slot-based with a vendor confirmation that has no time limit (`REQUESTED` stays until the business confirms). Related open points for the owner (file 14): a Free page for an emergency service with no tap-to-call, and whether a health-adjacent service on a pack that is not counsel-gated is acceptable.
