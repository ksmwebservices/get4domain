# 15 Taxonomy reconciliation (Stage 1, lane V2)

Three lists claim to describe the industries: the **48-family checklist** (brief phase 2 and `INDUSTRY_CHECKLIST_48_FAMILIES.txt`, same 48 names), the **45-family master** (owner file, 1,213 unique categories, loaded as data by lane E1) and the **code's 21 families** (the 196 registrable categories). A fourth, the 53-category directory with 12 parents, and a fifth, the 24 V2 category packs, are not families of the same kind (V1 section A.1).

Note: the checklist `.txt` begins in the middle of a sentence ("is to create one master India-wide ..."); the preface before it is missing, the 48 rows are complete.

## 1. Checklist (48) against master (45)

Relation words: EXACT (same scope), MERGED (several checklist families sit in one master family), SPLIT (one checklist family spread over several master families), ADDED (master family the checklist does not have), MISSING (checklist family with no master family).

| # | Checklist family | Master family or families | Relation | Code family (21) | Note |
|---|---|---|---|---|---|
| 1 | Home repair and maintenance | 01 Home Services, 27 Repairs & Technical Services | SPLIT | Home repair and trades; Appliance, electronics and security | Gas stove and LPG stove repair: in neither list of categories |
| 2 | Home installation and improvement | 01, 11 Interior Design & Home Decor, 40 Home, Garden & Outdoor | SPLIT | Home repair and trades | Mosquito nets and roller shutters: no category |
| 3 | Cleaning and pest management | 01 (cleaning, pest, termite), 34 Housekeeping & Facility Management | SPLIT | Cleaning, pest and garden | |
| 4 | Construction and civil works | 10 Construction & Building | EXACT | Home repair and trades; Hardware, building and auto parts | |
| 5 | Interior and architecture | 11 Interior Design (architects sit in 10) | SPLIT | Property and design | |
| 6 | Healthcare | 02 Healthcare & Medical | MERGED with 7, 8 | Healthcare | |
| 7 | Hospitals and emergency care | 02 (hospitals, ambulance, home nursing, old age care) | MERGED into 02 | Healthcare; Moving and transport (ambulance) | Ambulance is filed under transport in code, healthcare in the master |
| 8 | Diagnostics and medical | 02 (labs, scans), 43 Medical & Home Care Equipment | SPLIT | Healthcare; Food and daily needs (medical-store) | |
| 9 | Veterinary and animal care | 25 Pets & Animal Services (also 02 Veterinary Doctors, 24 Veterinary Services) | SPLIT | Healthcare (veterinary-clinic); Food and daily needs (pet-supplies) | |
| 10 | Beauty and personal care | 03 Beauty, Salon & Personal Care | EXACT | Beauty and wellness | |
| 11 | Fitness and wellness | 30 Sports & Fitness, 38 Beauty, Health & Wellness Products | SPLIT | Beauty and wellness (gym) | |
| 12 | Education and institutions | 05 Education & Training | MERGED with 13 | Education and training | |
| 13 | Coaching and training | 05 | MERGED into 05 | Education and training | |
| 14 | Professional finance (CA, CS, CMA) | 18 Chartered Accountants & Taxation | EXACT | Legal and finance | 0 of 23 categories matched to an existing one |
| 15 | Legal services | 19 Legal & Professional Services | EXACT | Legal and finance | |
| 16 | Finance and investment | 17 Finance, Banking & Insurance | EXACT | Legal and finance | |
| 17 | Real estate | 09 Real Estate & Property | EXACT | Property and design | |
| 18 | Retail and shops | 07 Grocery, 08 Shopping & Retail, 22 Electronics (shops), 37 (shops), 38, 40 | SPLIT | Electronics and home; Fashion and lifestyle; Food and daily needs; Hardware, building and auto parts | |
| 19 | Wholesale and distribution | 23 Industrial (dealers), 44 Industrial, Commercial & Office Services, 35 (importers) | SPLIT | B2B suppliers and manufacturers | Dealers are scattered over many master families |
| 20 | Food and beverage | 06 Restaurants & Food | EXACT | Hospitality, travel and events; Food and daily needs | |
| 21 | Agriculture and rural business | 24 Agriculture & Farming | EXACT | none (one B2B category) | 0 of 31 matched |
| 22 | Automobile and mobility | 04 Automobiles & Two Wheelers | EXACT | Vehicle services; Vehicles and dealers | |
| 23 | Transport and travel | 12 Travel & Tourism, 13 Transportation & Logistics (passenger part) | SPLIT | Moving and transport; Hospitality, travel and events | |
| 24 | Logistics and delivery | 13, 35 Shipping, Export & Import | SPLIT | Logistics and freight | |
| 25 | Rental and leasing | 28 Rental & Hire Services | EXACT | none (2 categories on RENTAL_FLEET) | 0 of 32 matched |
| 26 | Events and weddings | 15 Weddings & Events | EXACT | Hospitality, travel and events; Consulting and creative (planners) | |
| 27 | Photography and media | 16 Photography & Media | EXACT | Consulting and creative | |
| 28 | Advertising and marketing | 36 Advertising, Printing & Branding, 20 | SPLIT | Consulting and creative | |
| 29 | IT and technology | 21 IT, Software & Digital Services | EXACT | Consulting and creative | |
| 30 | Electronics and electrical | 22 Electronics & Electrical | EXACT | Appliance, electronics and security; Electronics and home | |
| 31 | Industrial and engineering | 23 Industrial & Manufacturing | MERGED with 32 | B2B suppliers and manufacturers | |
| 32 | Manufacturing | 23 | MERGED into 23 | B2B suppliers and manufacturers | |
| 33 | Textile, garment and fashion | 37 Textiles, Clothing & Fashion | EXACT | Fashion and lifestyle; Other local services | 0 of 24 matched |
| 34 | Printing and packaging | 36, 16 (printing studios) | SPLIT | Other local services (sign-board); Hardware (packaging supplies) | |
| 35 | Security and safety | 26 Security & Safety | EXACT | Appliance, electronics and security | |
| 36 | Recruitment and staffing | 33 Recruitment & Job Services | EXACT | Consulting and creative (one category) | |
| 37 | Facility management | 34 Housekeeping & Facility Management | EXACT | Cleaning, pest and garden | |
| 38 | Government and citizen services | 32 Government & Public Services | EXACT | none (notary only) | Master lists 13 public bodies that are institutions, not businesses |
| 39 | Domestic and family services | 42 Baby, Child & Family Services; cooks in 06; home nursing in 02; domestic help in 33 | SPLIT, no family of its own | none | Maids, cooks on call and patient attendants: only Domestic Help Agencies, Cooks on Hire, Home Nursing Services exist; patient attendants missing |
| 40 | Pets, gardening and outdoor | 25 Pets, 40 Home, Garden & Outdoor | SPLIT | Cleaning, pest and garden | |
| 41 | Water, energy and environment | 39 Waste Management & Environment (solar, water treatment); borewell and tanker are not there | PARTIAL | Field service categories: solar-installer, borewell-drilling, water-purifier-ro-service | Water tankers: only Water Can Suppliers and Mineral Water Suppliers; borewell drilling not in the master |
| 42 | Entertainment and recreation | 29 Entertainment & Recreation | EXACT | none | 0 of 26 matched |
| 43 | Sports and activities | 30 Sports & Fitness | EXACT | Education (sports-academy); Beauty and wellness (gym) | |
| 44 | Spiritual and traditional services | 31 Astrology & Spiritual Services | EXACT | Consulting and creative (astrologer, vastu) | |
| 45 | Personal and miscellaneous services | 41 Professional & Personal Services, 45 Other Local Businesses | MERGED | Other local services | |
| 46 | Marine, aviation and specialist transport | none (cruise and houseboat booking sit in 12; shipping and cargo in 35) | **MISSING** | none | Boat services, port services, aviation training: nothing |
| 47 | Nonprofits and associations | none (temples, churches, mosques, gurudwaras, religious organisations in 31; animal shelters in 25) | **MISSING** | none | NGOs, trusts, trade associations, clubs as a family: no |
| 48 | Other and emerging businesses | 45 Other Local Businesses (21 categories) | EXACT by name | Other local services (4) | The checklist asks for an admin-controlled category creation process: **MISSING in code** (no create route for a category, see file 01 section 4) |

**Checklist families with no master family: 2** (46 Marine, aviation and specialist transport; 47 Nonprofits and associations), **plus 2 only partly covered** (39 Domestic and family services, 41 Water, energy and environment).

**Master families the checklist does not have as families: 9** (07 Grocery & Daily Needs, 14 Hotels & Accommodation, 35 Shipping, Export & Import, 38 Beauty, Health & Wellness Products, 40 Home, Garden & Outdoor, 41 Professional & Personal Services, 42 Baby, Child & Family Services, 43 Medical & Home Care Equipment, 44 Industrial, Commercial & Office Services). The checklist reaches them through merges (retail, logistics, wholesale).

**Merges** (checklist 48 to master 45): 6, 7 and 8 into Healthcare; 12 and 13 into Education; 31 and 32 into Industrial & Manufacturing. **Splits**: retail (18), wholesale (19), home repair (1), home installation (2), cleaning (3), transport (23), logistics (24), advertising (28), printing (34), fitness (11), diagnostics (8), animal care (9), domestic (39).

**Owner decision needed:** the master is the agreed source (45 families, 1,213 categories). Two checklist families (46, 47) and the borewell, tanker, gas stove, mosquito net, roller shutter, ICU ambulance, patient attendant and similar items need adding to the master or an explicit "not in scope" (file 12 lists them).

## 2. Master (45) against the code's 21 families

| # | Master family | Categories | Matched to an existing category | Dominant archetype (share) | Archetypes with 3 or more categories | Existing packs used by the matches | Planned pack key (E1) |
|---|---|---|---|---|---|---|---|
| 1 | Home Services | 39 | 17 | A01 FIELD_SERVICE_VISIT (59%) | 4 | FIELD_SERVICE x15, AGENCY_CONSULTING x1, LOGISTICS x1 | HOME_SERVICES |
| 2 | Healthcare & Medical | 55 | 5 | A04 CLINICAL_APPOINTMENT (64%) | 3 | LOGISTICS x1, CLINIC x1, LAB x1, PHARMACY x2 | HEALTHCARE_AND_MEDICAL |
| 3 | Beauty, Salon & Personal Care | 29 | 5 | A25 PERSONAL_APPOINTMENT_STAFF (86%) | 2 | MEMBERSHIP_WELLNESS x5 | BEAUTY_SALON_AND_PERSONAL_CARE |
| 4 | Automobiles & Two Wheelers | 40 | 4 | A19 VEHICLE_WORKSHOP_JOBCARD (32%) | 4 | LOGISTICS x1, VEHICLE_SERVICE x2, EDUCATION x1 | AUTOMOBILES_AND_TWO_WHEELERS |
| 5 | Education & Training | 52 | 5 | A21 COURSE_ADMISSION (100%) | 1 | EDUCATION x5 | EDUCATION_AND_TRAINING |
| 6 | Restaurants & Food | 41 | 3 | A11 FOOD_ORDER_RESERVATION (78%) | 2 | FOOD_SERVICE x3 | RESTAURANTS_AND_FOOD |
| 7 | Grocery & Daily Needs | 29 | 2 | A09 RETAIL_CATALOGUE_ORDER (76%) | 2 | RETAIL x2 | GROCERY_AND_DAILY_NEEDS |
| 8 | Shopping & Retail | 46 | 8 | A09 RETAIL_CATALOGUE_ORDER (93%) | 1 | RETAIL x8 | SHOPPING_AND_RETAIL |
| 9 | Real Estate & Property | 25 | 3 | A24 LISTING_VISIT_ENQUIRY (48%) | 4 | HOSPITALITY_EVENTS x1, PROPERTY x2 | REAL_ESTATE_AND_PROPERTY |
| 10 | Construction & Building | 42 | 2 | A02 SITE_PROJECT_BOQ (57%) | 5 | FIELD_SERVICE x2 | CONSTRUCTION_AND_BUILDING |
| 11 | Interior Design & Home Decor | 23 | 3 | A23 CREATIVE_PROJECT_AGENCY (52%) | 2 | RETAIL x1, AGENCY_CONSULTING x2 | INTERIOR_DESIGN_AND_HOME_DECOR |
| 12 | Travel & Tourism | 28 | 2 | A15 TRIP_PACKAGE_ITINERARY (71%) | 1 | HOSPITALITY_EVENTS x2 | TRAVEL_AND_TOURISM |
| 13 | Transportation & Logistics | 30 | 4 | A17 FREIGHT_COURIER_MOVE (97%) | 1 | LOGISTICS x4 | TRANSPORTATION_AND_LOGISTICS |
| 14 | Hotels & Accommodation | 28 | 1 | A14 STAY_RESERVATION (100%) | 1 | HOSPITALITY_EVENTS x1 | HOTELS_AND_ACCOMMODATION |
| 15 | Weddings & Events | 32 | 4 | A13 EVENT_BOOKING_QUOTE (69%) | 2 | HOSPITALITY_EVENTS x3, MEMBERSHIP_WELLNESS x1 | WEDDINGS_AND_EVENTS |
| 16 | Photography & Media | 32 | 4 | A23 CREATIVE_PROJECT_AGENCY (72%) | 3 | AGENCY_CONSULTING x4 | PHOTOGRAPHY_AND_MEDIA |
| 17 | Finance, Banking & Insurance | 31 | 2 | A22 PROFESSIONAL_ENGAGEMENT (84%) | 2 | PRACTICE_LEGAL_FINANCE x2 | FINANCE_BANKING_AND_INSURANCE |
| 18 | Chartered Accountants & Taxation | 23 | 0 | A22 PROFESSIONAL_ENGAGEMENT (100%) | 1 | none | CHARTERED_ACCOUNTANTS_AND_TAXATION |
| 19 | Legal & Professional Services | 25 | 1 | A22 PROFESSIONAL_ENGAGEMENT (80%) | 2 | PRACTICE_LEGAL_FINANCE x1 | LEGAL_AND_PROFESSIONAL_SERVICES |
| 20 | Business & Management Consultants | 24 | 2 | A23 CREATIVE_PROJECT_AGENCY (96%) | 1 | AGENCY_CONSULTING x2 | BUSINESS_AND_MANAGEMENT_CONSULTANTS |
| 21 | IT, Software & Digital Services | 31 | 1 | A23 CREATIVE_PROJECT_AGENCY (77%) | 2 | AGENCY_CONSULTING x1 | IT_SOFTWARE_AND_DIGITAL_SERVICES |
| 22 | Electronics & Electrical | 28 | 1 | A10 WHOLESALE_B2B_QUOTE (39%) | 3 | RETAIL x1 | ELECTRONICS_AND_ELECTRICAL |
| 23 | Industrial & Manufacturing | 29 | 1 | A39 MANUFACTURER_PRODUCTION_B2B (62%) | 2 | B2B_DEALER x1 | INDUSTRIAL_AND_MANUFACTURING |
| 24 | Agriculture & Farming | 31 | 0 | A32 AGRI_PRODUCE_INPUT_TRADE (35%) | 2 | none | AGRICULTURE_AND_FARMING |
| 25 | Pets & Animal Services | 22 | 1 | A09 RETAIL_CATALOGUE_ORDER (23%) | 3 | CLINIC x1 | PETS_AND_ANIMAL_SERVICES |
| 26 | Security & Safety | 24 | 1 | A37 EQUIPMENT_SALE_INSTALL (42%) | 3 | FIELD_SERVICE x1 | SECURITY_AND_SAFETY |
| 27 | Repairs & Technical Services | 29 | 6 | A27 ITEM_INTAKE_PROCESSING (62%) | 2 | FIELD_SERVICE x6 | REPAIRS_AND_TECHNICAL_SERVICES |
| 28 | Rental & Hire Services | 32 | 0 | A18 RENTAL_ASSET_BOOKING (84%) | 2 | none | RENTAL_AND_HIRE_SERVICES |
| 29 | Entertainment & Recreation | 26 | 0 | A31 VENUE_SLOT_TICKET (81%) | 2 | none | ENTERTAINMENT_AND_RECREATION |
| 30 | Sports & Fitness | 26 | 3 | A20 MEMBERSHIP_RECURRING (50%) | 4 | MEMBERSHIP_WELLNESS x1, EDUCATION x1, RETAIL x1 | SPORTS_AND_FITNESS |
| 31 | Astrology & Spiritual Services | 23 | 2 | A30 CONSULT_OR_CEREMONY_BOOKING (57%) | 2 | AGENCY_CONSULTING x2 | ASTROLOGY_AND_SPIRITUAL_SERVICES |
| 32 | Government & Public Services | 24 | 0 | A40 INFORMATION_LISTING_ONLY (54%) | 2 | none | GOVERNMENT_AND_PUBLIC_SERVICES |
| 33 | Recruitment & Job Services | 20 | 0 | A28 MANPOWER_PLACEMENT (75%) | 2 | none | RECRUITMENT_AND_JOB_SERVICES |
| 34 | Housekeeping & Facility Management | 22 | 1 | A33 SITE_CONTRACT_SERVICE (55%) | 3 | FIELD_SERVICE x1 | HOUSEKEEPING_AND_FACILITY_MANAGEMENT |
| 35 | Shipping, Export & Import | 22 | 4 | A17 FREIGHT_COURIER_MOVE (59%) | 2 | LOGISTICS x3, AGENCY_CONSULTING x1 | SHIPPING_EXPORT_AND_IMPORT |
| 36 | Advertising, Printing & Branding | 30 | 0 | A23 CREATIVE_PROJECT_AGENCY (57%) | 2 | none | ADVERTISING_PRINTING_AND_BRANDING |
| 37 | Textiles, Clothing & Fashion | 24 | 0 | A26 MADE_TO_ORDER_FABRICATION (33%) | 4 | none | TEXTILES_CLOTHING_AND_FASHION |
| 38 | Beauty, Health & Wellness Products | 18 | 1 | A09 RETAIL_CATALOGUE_ORDER (56%) | 3 | MEMBERSHIP_WELLNESS x1 | BEAUTY_HEALTH_AND_WELLNESS_PRODUCTS |
| 39 | Waste Management & Environment | 20 | 0 | A35 SCHEDULED_PICKUP_COLLECTION (60%) | 2 | none | WASTE_MANAGEMENT_AND_ENVIRONMENT |
| 40 | Home, Garden & Outdoor | 22 | 1 | A09 RETAIL_CATALOGUE_ORDER (36%) | 3 | RETAIL x1 | HOME_GARDEN_AND_OUTDOOR |
| 41 | Professional & Personal Services | 24 | 2 | A27 ITEM_INTAKE_PROCESSING (50%) | 3 | EDUCATION x1, FIELD_SERVICE x1 | PROFESSIONAL_AND_PERSONAL_SERVICES |
| 42 | Baby, Child & Family Services | 20 | 0 | A21 COURSE_ADMISSION (35%) | 3 | none | BABY_CHILD_AND_FAMILY_SERVICES |
| 43 | Medical & Home Care Equipment | 15 | 0 | A10 WHOLESALE_B2B_QUOTE (67%) | 2 | none | MEDICAL_AND_HOME_CARE_EQUIPMENT |
| 44 | Industrial, Commercial & Office Services | 20 | 0 | A10 WHOLESALE_B2B_QUOTE (85%) | 1 | none | INDUSTRIAL_COMMERCIAL_AND_OFFICE_SERVICES |
| 45 | Other Local Businesses | 21 | 1 | A09 RETAIL_CATALOGUE_ORDER (38%) | 3 | RETAIL x1 | OTHER_LOCAL_BUSINESSES |

Reading the table: 12 master families are 80 percent or more one archetype (a family pack can be a single workflow block there: for example Education 100 percent A21, Hotels 100 percent A14, Chartered Accountants 100 percent A22); 10 families are under 50 percent one archetype (a family pack would have to carry several workflows: Automobiles & Two Wheelers (32%), Real Estate & Property (48%), Electronics & Electrical (39%), Agriculture & Farming (35%), Pets & Animal Services (23%), Security & Safety (42%), Textiles, Clothing & Fashion (33%), Home, Garden & Outdoor (36%), Baby, Child & Family Services (35%), Other Local Businesses (38%); see file 14 question 4).

## 3. The code's 21 families

| Code family (g4d_pack_categories.family) | Categories | Packs used | Matched to master families (count of categories) |
|---|---|---|---|
| B2B suppliers and manufacturers (enquiry only) | 4 | B2B_DEALER x4 | Industrial & Manufacturing (1) |
| B2B suppliers and manufacturers (optional family, enquiry only) | 3 | B2B_DEALER x3 | none matched |
| Electronics and home | 15 | RETAIL x15 | Shopping & Retail (4), Electronics & Electrical (1), Interior Design & Home Decor (1), Home, Garden & Outdoor (1), Sports & Fitness (1) |
| Fashion and lifestyle | 12 | RETAIL x12 | Shopping & Retail (4), Other Local Businesses (1) |
| Food and daily needs | 9 | RETAIL x8, PHARMACY x1 | Grocery & Daily Needs (2), Healthcare & Medical (1) |
| Hardware, building and auto parts | 6 | RETAIL x6 | none matched |
| Vehicles and dealers | 1 | B2B_DEALER x1 | none matched |
| Appliance, electronics and security | 15 | FIELD_SERVICE x15 | Repairs & Technical Services (6), Home Services (5), Construction & Building (1) |
| Cleaning, pest and garden | 7 | FIELD_SERVICE x7 | Home Services (2), Housekeeping & Facility Management (1) |
| Home repair and trades | 18 | FIELD_SERVICE x18 | Home Services (7), Construction & Building (1) |
| Moving and transport | 4 | LOGISTICS x4 | Healthcare & Medical (1), Home Services (1), Transportation & Logistics (1), Automobiles & Two Wheelers (1) |
| Other local services | 4 | FIELD_SERVICE x4 | Home Services (1), Security & Safety (1), Professional & Personal Services (1) |
| Vehicle services | 8 | VEHICLE_SERVICE x8 | Automobiles & Two Wheelers (2) |
| Beauty and wellness | 11 | MEMBERSHIP_WELLNESS x11 | Beauty, Salon & Personal Care (5), Weddings & Events (1), Sports & Fitness (1), Beauty, Health & Wellness Products (1) |
| Consulting and creative | 15 | AGENCY_CONSULTING x13, HOSPITALITY_EVENTS x2 | Photography & Media (4), Business & Management Consultants (2), Weddings & Events (2), Astrology & Spiritual Services (1), Shipping, Export & Import (1), IT, Software & Digital Services (1) |
| Education and training | 12 | EDUCATION x12 | Education & Training (5), Automobiles & Two Wheelers (1), Sports & Fitness (1), Professional & Personal Services (1) |
| Healthcare (disclaimer) | 13 | CLINIC x11, LAB x1, PHARMACY x1 | Healthcare & Medical (3), Pets & Animal Services (1) |
| Hospitality, travel and events | 18 | HOSPITALITY_EVENTS x11, RENTAL_FLEET x1, FOOD_SERVICE x6 | Restaurants & Food (3), Travel & Tourism (2), Weddings & Events (1), Real Estate & Property (1), Hotels & Accommodation (1) |
| Legal and finance (disclaimer) | 8 | PRACTICE_LEGAL_FINANCE x8 | Finance, Banking & Insurance (2), Legal & Professional Services (1) |
| Logistics and freight | 6 | LOGISTICS x6 | Transportation & Logistics (3), Shipping, Export & Import (3) |
| Property and design | 7 | AGENCY_CONSULTING x3, RENTAL_FLEET x1, PROPERTY x3 | Interior Design & Home Decor (2), Real Estate & Property (2), Home Services (1), Astrology & Spiritual Services (1) |

What this shows:

- **No code family equals a master family.** The code families group trades, shops and professions by pack and tier, not by industry.
- **Merged**: Consulting and creative holds photography, IT, advertising, consultants, astrology and event planners (master families 16, 19 to 21, 31, 15). Legal and finance holds master families 17, 18, 19. Hospitality, travel and events holds 12, 14, 15 and part of 06 and 28.
- **Split**: master Retail (08) sits across Electronics and home, Fashion and lifestyle, Food and daily needs, Hardware, building and auto parts; master Home Services (01) sits across Home repair and trades, Cleaning, pest and garden, Appliance, electronics and security.
- **Missing as a family in code**: agriculture, pets, rental, entertainment, government, recruitment, advertising and printing, textiles, waste and environment, baby and child, medical equipment, industrial office services (12 master families have no code family; their categories match 0 or 1 existing records each).
- **Misfiled in code**: ambulance-service (Moving and transport), medical-store (Food and daily needs), coworking-space (Property and design), gym-fitness-centre (Beauty and wellness), event-planner and wedding-planner (Consulting and creative).

## 4. Is the three-level hierarchy enough? (the brief proposes six)

Owner decision: Family, Category, Service. The brief proposes Family, Category, Subcategory, Specialization, Service, Variant.

Evidence that the extra taxonomy levels are **not** needed:

1. The master's second level is already specific: Cardiologists, Civil Lawyers, Termite Control, Tile Contractors are what the brief calls subcategories. Its "Business Category" level has no counterpart in the master; the family plays that role.
2. Specializations in the master are sibling categories (Pest Control and Termite Control; Civil, Criminal, Family, Property Lawyers). Putting them under a parent would force a many-to-many on top of the 61 categories that already sit in several families.
3. The code already has per-vendor places for the finer detail: `V3CategoryProfileField` and `V3VendorProfileValue` (specialities as profile fields), `V3StoreVariant` (size, colour, pack), `V3ApptService` (length, price).

Evidence that something extra is needed, at vendor level only:

1. Service variants with their own price (pest treatment by 1 BHK, 2 BHK, 3 BHK; tile laying by sq ft and tile type). `V3StoreVariant` exists for products only; services have none.
2. A vendor-chosen specialization needs a controlled list per category when search or SEO uses it (admin-defined limits, brief phase 7).

**Recommendation:** keep three taxonomy levels; treat specialization as an admin-defined option list per category and variant as a vendor service option; add neither as taxonomy tables now. The workflow archetype is a separate dimension (a property of a category), not a fourth level. The owner decides.

## 5. One pack key per family (45 packs): evidence for and against

The brief says not to create packs to raise the count. The owner decided one pack key per family, built on shared workflow blocks. E1 already stores the key per family (`plannedPackKey`, no foreign key).

**For**

- A family is where the vendor-facing name, default tab order, disclaimers (health, legal and finance, wellness), sample data, theme and landing defaults, SEO templates and the 45 review lanes naturally sit (V1 sections A, D, 14).
- Twelve master families have no pack home today (file 12); a family pack gives each one a menu without a new engine.
- A pack is data (tabs, field sets, capability rules, defaults), so a pack per family is cheap if it only references shared blocks, as the 16 do now.
- Counsel gating is per family (health, legal and finance), not per today's 16 packs.

**Against**

- 10 families are mixed: a family default would force the wrong workflow on minorities. That is the failure that exists now: ambulance sits on the logistics flow ("get a quote", "track shipment"). Under a Healthcare family pack defaulting to the clinic flow, ambulance would get appointments.
- 12 families are one archetype, so their pack is the block with a new name: no new behaviour, only a new name to maintain.
- A category in two or three families (61) has two or three candidate packs; the tab menu merge rule is undefined, and today `V3VendorPack.vendorId` is unique.
- 45 menus, 45 field-set groups, 45 sample sets and 45 QA lanes have a standing cost; the shared blocks (39 archetypes, about 12 groups after merging) are where the behaviour lives.

**Recommendation (owner decides):** adopt the 45 pack keys as **family bundles** (name, default tab order, disclaimers, sample data, landing and SEO defaults) and bind behaviour through **archetype blocks at category level**: a category inherits its family bundle's menu unless its archetype differs, in which case a per-category override names the block. This meets the owner's decision and avoids the ambulance failure. Where a family is under 50 percent one archetype, list the overrides in the bundle. Count to build in Stage 2: 45 bundles, about 39 archetype blocks (merging to about 12 groups).
