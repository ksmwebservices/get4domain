# Lane E1: category taxonomy (45 families)

Vocabulary: **Family** = top level (45). **Category** = second level (1,213 unique). **Service** = third level (lane E4, not built here).

## What was built
- `backend-api/data/category-master-45.json`: generated from `docs/v3/inputs/REQ_CATEGORY_MASTER_45_FAMILIES.md` by `scripts/gen-category-master-45.js` (`--check` compares). 45 families, 1,277 listed links, 1,213 unique categories, 61 categories in several families (stored once, linked to each). Slugs: lowercase, `&` becomes `and`, deterministic.
- Migration `20270110100000_v3_e1_taxonomy` (additive, RLS on): `g4d_taxonomy_families` (with `plannedPackKey`, `sourceTag`), `g4d_taxonomy_categories`, `g4d_taxonomy_family_categories` (many to many), `g4d_taxonomy_related_families` (symmetric: stored once, CHECK familyAId < familyBId), `g4d_taxonomy_legacy_map` (existing category to new category). `g4d_pack_categories` is not altered (one foreign key points at it from the new map).
- Loader `scripts/seed-v3-taxonomy.js` (dry run by default; `--offline`; `--apply` needs a typed word in a terminal; live through `scripts/live/seed-live.js`, which asks for LIVE). Idempotent, never updates or deletes.
- Planned pack key per family = the family slug in UPPER_SNAKE_CASE (for example `HOME_SERVICES`). It is only a record for lane E3; no foreign key.

## Needs owner review
- `data/category-master-45-related.json`: 114 related pairs with a one-line reason, written by engineering as a first proposal. A vendor may pick categories from its own family and the related ones (rule not enforced anywhere yet: no screen or route in E1).
- `data/category-master-45-aliases.json`: 74 reviewed aliases (same business, different wording).
- The unmatched list below.

## The 196 existing categories
12 matched by exact name, 74 by the alias table, 110 unmatched (nothing changed or deleted; the owner decides: add an alias, map to a family by hand, or add the item to the master).

| existing key | existing name |
|---|---|
| agricultural-machinery-dealer | Agricultural machinery dealer |
| chemical-products-supplier | Chemical products supplier |
| pumps-motors-supplier | Pumps and motors supplier |
| b2b-manufacturer-supplier | B2b manufacturer supplier |
| industrial-supplies-machinery | Industrial supplies machinery |
| wholesale-trader | Wholesale trader |
| books-stationery | Books stationery |
| computer-laptop-store | Computer laptop store |
| computer-mobile-sales-service | Computer and mobile sales and service |
| electronics-mobile | Electronics mobile |
| gaming-products | Gaming products |
| home-appliances-showroom | Home appliances showroom |
| home-furniture | Home furniture |
| lighting-electricals | Lighting electricals |
| toys-kids-store | Toys kids store |
| bags-accessories | Bags and fashion accessories |
| cosmetics-personal-care | Cosmetics personal care |
| fashion-apparel | Fashion apparel |
| gifts-handicrafts | Gifts handicrafts |
| jewellery | Jewellery |
| saree-boutique-textiles | Saree boutique textiles |
| school-uniform-bags | School uniform bags |
| wellness-products-store | Wellness and health products |
| bakery-sweets | Bakery sweets |
| grocery-kirana | Grocery kirana |
| meat-fish-store | Meat, fish and seafood |
| pet-supplies | Pet supplies |
| plants-nursery-agri-inputs | Plants nursery agri inputs |
| supermarket-mini-mart | Supermarket mini mart |
| auto-spare-parts | Auto spare parts |
| bathroom-sanitary-products | Bathroom and sanitary products |
| building-materials | Building materials |
| hardware-paint-shop | Hardware paint shop |
| printing-packaging-supplies | Printing packaging supplies |
| tyres-batteries-dealer | Tyres batteries dealer |
| automobile-dealer | Automobile dealer (new and used, enquiry only) |
| ac-appliance-repair | Ac appliance repair |
| cctv-security-installer | Cctv security installer |
| generator-service | Generator service |
| inverter-battery-service | Inverter battery service |
| laptop-computer-repair | Laptop computer repair |
| lift-elevator-service | Lift elevator service |
| solar-installer | Solar installer |
| commercial-deep-cleaning | Commercial deep cleaning |
| gardening-landscaping | Gardening landscaping |
| home-cleaning | Home cleaning |
| laundry-dry-cleaning | Laundry dry cleaning |
| sofa-carpet-cleaning | Sofa carpet cleaning |
| borewell-drilling | Borewell drilling |
| civil-contractor-builder | Civil contractor builder |
| curtain-blinds-installer | Curtain blinds installer |
| handyman-general-services | Handyman and general services |
| mason-contractor | Mason contractor |
| road-earthwork-contractor | Road and earthwork contractor |
| roofing-sheet-contractor | Roofing sheet contractor |
| tiles-flooring-contractor | Tiles flooring contractor |
| wallpaper-flooring-installer | Wallpaper flooring installer |
| welding-fabrication | Welding fabrication |
| mini-truck-tempo-service | Mini truck tempo service |
| key-duplication | Key duplication |
| sign-board-flex-printing | Sign board flex printing |
| bike-mechanic-two-wheeler | Bike mechanic two wheeler |
| car-mechanic-garage | Car mechanic garage |
| car-wash-detailing | Car wash detailing |
| denting-painting-body-shop | Denting painting body shop |
| towing-roadside-assistance | Towing roadside assistance |
| tyre-puncture-wheel-alignment | Tyre puncture wheel alignment |
| ayurvedic-wellness-centre | Ayurvedic wellness centre |
| gents-salon-barber | Gents salon barber |
| nail-tattoo-studio | Nail tattoo studio |
| yoga-meditation-studio | Yoga meditation studio |
| graphic-design-studio | Graphic design studio |
| hr-recruitment-agency | Hr recruitment agency |
| motivational-speaker | Motivational speaker and trainer |
| translator-typing-services | Translator typing services |
| art-craft-class | Art craft class |
| college-institute | College and institute |
| music-dance-school | Music dance school |
| preschool-daycare | Preschool daycare |
| school-k12 | School (primary to higher secondary) |
| skill-training-institute | Skill training institute |
| ayurveda-homeopathy-clinic | Ayurveda homeopathy clinic |
| child-therapy-centre | Child therapy centre |
| dietitian-nutritionist | Dietitian nutritionist |
| doctor-clinic | Doctor clinic |
| eye-clinic | Eye clinic |
| hospital-nursing-home | Hospital nursing home |
| physiotherapy | Physiotherapy |
| psychologist-counsellor | Psychologist counsellor |
| skin-hair-clinic | Skin hair clinic |
| bike-car-rental | Bike car rental |
| bus-travels | Bus travels |
| caterer | Caterer |
| dj-sound-lighting | Dj sound lighting |
| event-decor-tent-house | Event decor tent house |
| hotel-homestay | Hotel homestay |
| juice-tea-snack-shop | Juice, tea and snack shop |
| resort-farmhouse | Resort farmhouse |
| restaurant-cafe | Restaurant cafe |
| travel-agency | Travel agency |
| ca-tax-consultant | Ca tax consultant |
| company-registration-gst-consultant | Company registration gst consultant |
| financial-planner | Financial planner |
| insurance-advisor | Insurance advisor |
| notary-document-writer | Notary document writer |
| cold-chain-logistics | Cold chain logistics |
| distribution-services | Distribution services |
| civil-engineer-surveyor | Civil engineer surveyor |
| coworking-space | Co-working space |
| property-developer-builder | Property developer builder |
