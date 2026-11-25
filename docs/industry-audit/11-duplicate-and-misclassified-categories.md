# 11 Duplicate and misclassified categories (Stage 1, lane V2)

Counts here are on the master (1,213), the 196 existing categories, and the code. Full per-row evidence is in file 09 (`issues` and `status_basis` columns). Nothing was changed.

## 1. Master list: same business under two or more names

A script grouped the 1,213 names by word stem after removing filler words (services, shops, stores, dealers, centres and similar): 71 groups of two or more names. I read each group. **29 groups are the same business with different wording** (about 59 categories); a further 13 groups overlap and need an owner decision; the remaining groups are false positives.

### 1.1 Same business, different wording (merge into one category, or keep one and make the other an alias)

| # | Names | Strength |
|---|---|---|
| 1 | AC Repair / AC Repair & Services | same business |
| 2 | Animal Feed Dealers / Animal Feed Suppliers | same business |
| 3 | Bicycle Repair / Bicycle Repair Shops | same business |
| 4 | CCTV Dealers / CCTV Suppliers | same business |
| 5 | Electronics Shops / Electronics Stores | same business |
| 6 | False Ceiling / False Ceiling Contractors | same business |
| 7 | Fire Safety Contractors / Fire Safety Services | near duplicate |
| 8 | Forex Dealers / Forex Services | same business |
| 9 | Furniture Shops / Furniture Stores | same business |
| 10 | Hardware Shops / Hardware Stores | same business |
| 11 | Home Decor Shops / Home Decor Stores | same business |
| 12 | Home Loan Consultants / Home Loans | same business |
| 13 | HR Agencies / HR Consultants | same business |
| 14 | Kids Clothing / Kids Clothing Shops | same business |
| 15 | Kitchenware Shops / Kitchenware Stores | same business |
| 16 | Laundries / Laundry Services | same business |
| 17 | Medical Equipment Dealers / Medical Equipment Suppliers | same business |
| 18 | Modular Kitchen / Modular Kitchen Dealers | near duplicate |
| 19 | Paint Dealers / Paint Shops | same business |
| 20 | Pet Food Shops / Pet Food Stores | same business |
| 21 | Photocopy Centres / Photocopy Shops / Xerox Shops | same business |
| 22 | Readymade Garment Shops / Readymade Garments | same business |
| 23 | Recruitment Agencies / Recruitment Consultants | near duplicate |
| 24 | Sanitaryware Dealers / Sanitaryware Shops | same business |
| 25 | SEO Agencies / SEO Services | same business |
| 26 | Tailoring Services / Tailoring Shops | same business |
| 27 | Virtual Assistant Services / Virtual Assistants | same business |
| 28 | Waste Management / Waste Management Companies | same business |
| 29 | Waterproofing / Waterproofing Contractors | same business |

Why it matters: E1 stores each exact name once, so these are separate rows, separate pack slots and separate SEO pages for one business. A vendor would see "Hardware Shops" and "Hardware Stores" as two choices.

### 1.2 Overlapping, owner decides

- Taxi Services / Cab Services / Taxi Rental (all A16, in families 04, 12, 13, 28)
- Gyms / Fitness Centres (family 30)
- Transporters / Goods Transport / Road Transport (family 13)
- Warehouse Services / Warehousing (families 13 and 35)
- Veterinary Doctors (02) / Veterinary Clinics (25) / Veterinary Services (24) / Pet Hospitals / Veterinary Hospitals
- Property Consultants / Property Dealers / Real Estate Agents
- Auditors / Company Auditors / Internal Auditors
- Marketing Agencies / Marketing Consultants / Marketing Consultants
- Cooks on Hire / Home Cooks / Personal Chefs
- General Physicians / Family Doctors
- Courier Services / Parcel Services / Domestic Courier / International Courier
- Photographers / Commercial Photographers / Event Photographers (siblings by specialization, not duplicates; keep as specialization options if the owner wants fewer rows)
- Software Companies / IT Companies / Software Developers / Web Developers / Website Developers / Website Designers

### 1.3 Word groups that are *not* duplicates (kept)

Accounting Services / Accounting Training; Auto Rickshaw Dealers / Auto Rickshaw Repair; Battery Dealers / Battery Repair; Bike Dealers / Bike Repair & Services; Car Dealers / Car Repair & Services; Computer Dealers / Computer Repair / Computer Shops; Cosmetic Clinics / Cosmetic Shops; Dance Classes / Dance Studios; Digital Marketing Agencies / Digital Marketing Training; Electrical Contractors / Electrical Shops; Furniture Repair / Furniture Shops; Generator Dealers / Generator Repair; Hardware Shops / Hardware Training; Industrial Machinery Dealers / Industrial Machinery Repair; Interior Designers / Office Interior Designers; Music Classes / Music Studios; Pet Shops / Pet Training; Software Companies / Software Training; Swimming Pool Contractors / Swimming Pools; Watch Repair / Watch Shops (dealer and repairer are different businesses).

## 2. Master list: categories stored once but placed in several families

61 categories sit in two or three families (confirmed against E1: 1,277 links, 1,213 unique). That is deliberate and fine under the owner rule "a category may sit in several families". They are listed so Stage 2 can check that each one picks a single archetype and a consistent pack default: Advertising Agencies (2); Bike Rental (2); Birthday Party Organisers (2); Bridal Makeup Artists (2); Car Rental (3); CCTV Dealers (2); CCTV Installation (2); Cold Storage (2); Computer Repair (2); Construction Companies (2); Courier Services (2); Crane Rental (2); Curtain Shops (2); Data Entry Services (2); Deep Cleaning (2); Digital Printing (2); Driving Schools (2); Electrical Contractors (3); Fashion Designers (2); Flex Printing (2); Florists (2); Flour Mills (2); Freight Forwarders (2); Furniture Repair (3); Garbage Collection (2); Gardening Services (2); Garment Manufacturers (2); Geyser Repair (2); Gift Shops (2); Home Decor Shops (2); Home Tutors (2); Hostels (2); Interior Designers (2); JCB Rental (2); Landscape Designers (2); Laptop Repair (2); Locksmiths (2); Mattress Shops (2); Meditation Centres (2); Microwave Repair (2); Mobile Phone Dealers (2); Offset Printing (2); Packers & Movers (2); Plant Nurseries (2); Plumbing Contractors (2); Printer Dealers (2); Refrigerator Repair (2); Resorts (2); Secretarial Services (2); Sportswear Shops (2); Tax Consultants (2); Taxi Services (2); Toy Shops (2); Tractor Dealers (2); Truck Rental (2); Vastu Consultants (2); Washing Machine Repair (2); Watch Shops (2); Water Purifier Repair (2); Water Tank Cleaning (2); Wedding Photographers (2).

Examples where the families disagree on workflow: Car Rental (A18) in Automobiles, Travel and Rental; Cold Storage (A17) in Transportation and Agriculture; Hostels (A14) in Real Estate and Hotels; Resorts (A14) in Hotels and Entertainment; Driving Schools (A21) in Automobiles and Education. The archetype is set per category, so these resolve to one block; the family bundle only supplies the name and defaults.

## 3. Master list: items that are not ordinary vendor businesses (owner scope decision)

- **19 public institutions** classified A40 (listing only): Government Offices, Municipal Offices, Corporation Offices, Panchayat Offices, RTO Offices, Passport Offices, Post Offices, Government Hospitals, Government Schools, Public Libraries, Police Stations, Fire Stations, Courts, Employment Exchanges, Banks, Private Banks, Public Sector Banks, Cooperative Banks, ATM Centres. They are listed as businesses in families 17 and 32. Are they customers?
- **Religious bodies** (Temples, Churches, Mosques, Gurudwaras, Religious Organisations) are in family 31 beside astrologers: a nonprofit and donation workflow (A34), no code exists.
- **Regulated or policy-sensitive**: Lottery Shops, Psychic Readers, Tarot Readers, Sexologists, Debt Recovery Agencies, Stock Brokers, Forex Dealers, Money Transfer Services, Overseas Job Consultants, Pesticide Dealers, Biomedical Waste Disposal. File 09 column `compliance_flags` marks 270 of 1,213 categories with at least one keyword flag for counsel review (not legal advice).

## 4. The 196 existing categories

### 4.1 On a pack whose flow does not fit (MISCLASSIFIED, 4)

| Existing category | Pack today | Family / tier today | What the category is | Why it does not fit |
|---|---|---|---|---|
| ambulance-service | LOGISTICS | Moving and transport / Handyman 499 | Emergency dispatch (A05) | The pack's public flow is "get a quote, track shipment"; tabs are shipments and trips; no priority, no crew, no hand-over; category has no services seeded |
| towing-roadside-assistance | VEHICLE_SERVICE | Vehicle services / Handyman 499 | Emergency dispatch (A05) | Pack is workshop job cards; the DISPATCH capability is a generic list |
| bus-travels | HOSPITALITY_EVENTS | Hospitality, travel and events / Professional | Passenger transport fleet (A16) | Pack is rooms, halls and packages |
| distribution-services | LOGISTICS | Logistics and freight / Professional | Distributor (A10, with delivery) | Wholesale distribution, not freight |

### 4.2 On a NEAR-fit pack (flow differs, 18 categories)

b2b-manufacturer-supplier (B2B_DEALER, wanted MANUFACTURER_PRODUCTION_B2B); laptop-computer-repair (FIELD_SERVICE, wanted ITEM_INTAKE_PROCESSING); lift-elevator-service (FIELD_SERVICE, wanted SITE_CONTRACT_SERVICE); mobile-repair (FIELD_SERVICE, wanted ITEM_INTAKE_PROCESSING); printer-repair (FIELD_SERVICE, wanted ITEM_INTAKE_PROCESSING); laundry-dry-cleaning (FIELD_SERVICE, wanted ITEM_INTAKE_PROCESSING); glass-aluminium-fabrication (FIELD_SERVICE, wanted MADE_TO_ORDER_FABRICATION); welding-fabrication (FIELD_SERVICE, wanted MADE_TO_ORDER_FABRICATION); taxi-cab-service (LOGISTICS, wanted PASSENGER_TRANSPORT_FLEET); key-duplication (FIELD_SERVICE, wanted ITEM_INTAKE_PROCESSING); sign-board-flex-printing (FIELD_SERVICE, wanted MADE_TO_ORDER_FABRICATION); tailoring-alterations (FIELD_SERVICE, wanted MADE_TO_ORDER_FABRICATION); hr-recruitment-agency (AGENCY_CONSULTING, wanted MANPOWER_PLACEMENT); translator-typing-services (AGENCY_CONSULTING, wanted ITEM_INTAKE_PROCESSING); hospital-nursing-home (CLINIC, wanted INPATIENT_FACILITY); tourist-guide (HOSPITALITY_EVENTS, wanted CONSULT_OR_CEREMONY_BOOKING); notary-document-writer (PRACTICE_LEGAL_FINANCE, wanted CITIZEN_DOCUMENT_ASSISTANCE); property-management (PROPERTY, wanted SITE_CONTRACT_SERVICE).

### 4.3 Family label and pack disagree (the pack is right, the family string is wrong or odd)

ambulance-service (Moving and transport; the master files ambulance under Healthcare), medical-store (Food and daily needs), coworking-space (Property and design), gym-fitness-centre (Beauty and wellness; master: Sports and Fitness), event-planner and wedding-planner (Consulting and creative; master: Weddings and Events), hr-recruitment-agency (Consulting and creative), plants-nursery-agri-inputs and pet-supplies (Food and daily needs), veterinary-clinic (Healthcare; master also files vets under Pets), vastu-consultant and astrologer (Consulting; master: Astrology and Spiritual), lift-elevator-service (Appliance, electronics and security).

### 4.4 Overlaps inside the 196

- Computers and mobiles: computer-laptop-store, computer-mobile-sales-service, electronics-mobile, mobile-accessories.
- Salons: unisex-salon, gents-salon-barber, ladies-beauty-parlour (one flow; audience could be an attribute).
- Food outlets: restaurant-cafe, cloud-kitchen, food-delivery-service, juice-tea-snack-shop.
- B2B: wholesale-trader, distribution-services, b2b-manufacturer-supplier, industrial-supplies-machinery.
- Contractors: mason-contractor, civil-contractor-builder, property-developer-builder, handyman-general-services (the last one overlaps electrician, plumber, carpenter and painter by definition).
- Cleaning: home-cleaning, commercial-deep-cleaning, sofa-carpet-cleaning.
- Creative: photographer, videographer; web-design-agency, software-development-company, graphic-design-studio.
- Home goods shops: home-decor-furnishing, home-furniture, mattress-bedding, kitchenware-utensils.

### 4.5 Matching quality (E1 alias table)

E1 matched 86 of the 196 (12 exact, 74 alias) and left 110 unmatched. Of the 110, a word-overlap check found at least one candidate master name for 104 (listed, unreviewed, in file 09 `issues`); most are visibly the same business (grocery-kirana and Kirana Stores, hotel-homestay and Hotels or Homestays, tiles-flooring-contractor and Tile Contractors or Flooring Contractors). **Six have no candidate**: lift-elevator-service, home-cleaning, borewell-drilling, handyman-general-services, key-duplication, distribution-services. Three of the 86 alias matches pair categories of different archetype and should be reviewed before use: audio-equipment-store (shop) to Audio Equipment Dealers (dealer), fire-safety-installer (installer) to Fire Safety Contractors (project contractor), car-accessories-fitting (workshop fitting) to Car Accessories (shop). The alias file itself says NEEDS OWNER REVIEW.

## 5. Duplication in the code (the larger problem)

| Thing | How many times | Where |
|---|---|---|
| Category lists | 5 | `g4d_pack_categories` (196), `g4d_taxonomy_categories` (1,213), `g4d_directory_categories` (53), `g4d_category_packs` (24, V2), frontend `industry-content.ts` main categories; plus `g4d_categories` (unrelated product categories) |
| Meanings of "pack" | 4 | file 01 section 5 |
| Job or work-order systems | 2 (plus generic tabs) | `g4d_jobs` (V3, field service) and `g4d_service_jobs` + `g4d_job_lines` (V2, vehicles) |
| Customer stores | 2 to 3 | `g4d_customers`, V2 `g4d_contacts`, V2 `g4d_leads` |
| Lead paths | 3 | `V3Request`, V2 `engine.enquiry` lead, LeadSpace |
| Service catalogue stores | 4 | starter JSON, `g4d_items`, `g4d_appt_services`, V2 `VendorProduct` |
| Product and stock stores | 3 and 4 | `g4d_store_products`, V2 `RetailProduct`, `CatalogItem`; V3 stock, BOS stock, `PartStock`, `ProduceStock` |
| Invoice systems | 3 to 4 | V3 documents, BOS documents, domainapp invoices, V2 `GenericInvoice` |
| Appointment-like tables | 5 | `g4d_appt_bookings`, `g4d_appointments`, `g4d_clinic_appointments`, `g4d_salon_appointments`, `g4d_room_bookings` |
| Education models | 2 sets | V2 `Batch`, `StudentEnrollment`, `CoachingBatch`, `CoachingEnrollment`, `CoachingSession` against V3 generic batches, admissions tabs |
| Site renderers | 3 | kit renderer, backend theme renderer, engine designs (V1 E) |

Recommendation: do not add a sixth or seventh in Stage 2. Choose one owner per row and retire or wrap the rest (file 14 Q11).
