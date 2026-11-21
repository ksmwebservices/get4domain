PROMPT T0: Theme Kit and Preview Harness (new Bolt project)

Build a front-end only project called "Get4Domain Theme Studio". It produces website THEMES for small businesses in India, plus a preview and lint tool to approve them. No backend, no database, no Supabase, mock data only.

WHAT A THEME IS
A theme is a folder of static files under /public/themes/<themeId>/ :
- index.html and other pages (plain HTML5, NOT React)
- theme.css (plain CSS)
- manifest.json
- assets/ (placeholder images as local SVG or CSS patterns; no stock photos)
The React app in /src is only the PREVIEW HARNESS used to review themes. Themes themselves must never depend on React.

A theme only PRESENTS content. The vendor's content lives in a theme-independent data model (below), so the same content must render in any theme. Every editable thing is marked with a binding attribute so the vendor's Website Manager can build an edit form automatically.

THEME RULES (the lint panel enforces these)
1. Script-free: no <script>, no inline on* handlers, no <iframe>, <object>, <embed>, no external CSS or JS, no @import, no !important.
2. CSS-only interactivity: FAQ with <details>/<summary>; mobile menu with a checkbox or :target; carousels with scroll-snap; lightbox with :target. Must stay keyboard accessible.
3. All CSS scoped under the root class .g4d-theme and only in theme.css.
4. Fonts only from this approved list, declared in manifest.fonts: Inter, Poppins, DM Sans, Manrope, Nunito, Work Sans, Montserrat, Playfair Display, Lora, Merriweather. No other font.
5. Semantics: header, nav, main#main, footer; exactly ONE <h1> per page bound to page.h1; headings in order; every img has alt (bound) and width and height attributes; links are real <a>; buttons are links. Do not set lang.
6. SEO is NOT the theme's job: never output <title>, <meta>, <link rel="canonical">, or JSON-LD. The platform injects all of it. The theme provides content structure only.
7. Platform slots: functional pieces a theme cannot script are placeholders the platform fills. Theme styles only the wrapper: <div data-g4d-slot="NAME"></div> with NAME one of enquiry-form, whatsapp-float, map, reviews, booking, cart, product-grid, search, claim-banner, listed-on-badge. In the preview harness draw each slot as a labelled dashed box.
8. Responsive, mobile-first, 360 to 1440 px. Touch targets at least 44 px. Text contrast WCAG AA. Reserve image space to avoid layout shift. Budgets: each HTML page under 100 KB, theme.css under 60 KB.
9. Design tokens as CSS variables on .g4d-theme: --g4d-primary, --g4d-primary-contrast, --g4d-accent, --g4d-bg, --g4d-surface, --g4d-text, --g4d-muted, --g4d-border, --g4d-radius, --g4d-font-heading, --g4d-font-body. The vendor changes only these in Brand settings, so use them everywhere (no hard-coded colours except neutral fallbacks).

BINDING ATTRIBUTES (the editable-field system)
- Text: <h2 data-g4d="about.title">Sample text</h2>
- Rich text: <div data-g4d-rich="about.body">...</div>
- Image: <img data-g4d-img="brand.logo" data-g4d-alt="brand.logoAlt" src="assets/placeholder.svg" alt="Logo" width="160" height="48">
- Link: <a data-g4d-href="cta.primary.href" data-g4d="cta.primary.label">Call now</a>
- Repeat list: <ul data-g4d-repeat="services"><li> ... use item.* keys such as data-g4d="item.title" ...</li></ul> (the first child is the template)
- Conditional: data-g4d-if="faq" shows the block only if the list or value is not empty
- Section wrapper: <section data-g4d-section="hero" data-g4d-label="Hero banner" data-g4d-optional="false"> so a section can be shown, hidden or reordered where allowed
The sample text inside each element is only a default for preview.

CANONICAL CONTENT MODEL (keys every theme may use)
business: name, tagline, description, established, registrationNo
brand: logo, logoAlt, favicon, cover (banner image), coverAlt, poster
page: h1, intro
contact: phone, whatsapp, email, address, city, area, pin, mapLat, mapLng, mapLink
hours: list of {day, open, close, closed}
social: facebook, instagram, youtube, linkedin, googleProfile
cta: primary {label, href}, secondary {label, href}
services: list of {title, description, price, image, link}
gallery: list of {image, alt, caption}
testimonials: list of {name, role, quote, rating, photo}
faq: list of {question, answer}
team: list of {name, role, bio, photo}
areas: list of {name}  (service areas)
credentials: list of {title, detail}
about: title, body, image
Ecommerce only: products list of {title, image, price, comparePrice, badge, link}, categories, shipping, returns
Category blocks (see catalog): any extra lists named in the catalog's "extraBlocks" column

CATEGORY CATALOG (create /src/data/categories.ts; this is a working list)
Fields per category: id, label, track, family, schemaType, ctaPrimary, extraBlocks.
Also give each category plausible Indian-context sample content: business name, tagline, city, 6 services with prices, 4 FAQs, 3 testimonials, hours. Label all as sample.

HANDYMAN track
home-services family:
plumber | Plumber | schema Plumber | Call now | areas, emergency24x7, priceList, beforeAfter, licence
electrician | Electrician | Electrician | Call now | areas, emergency24x7, priceList, safetyCertificates
carpenter | Carpenter | HomeAndConstructionBusiness | Get a quote | portfolio, materials, process
painter | Painter | HousePainter | Get a quote | portfolio, packages, beforeAfter
ac-appliance-repair | AC and appliance repair | HVACBusiness | Book a visit | brandsServiced, amcPlans, sameDay
pest-control | Pest control | HomeAndConstructionBusiness | Book a visit | packages, safetyNote, areaPricing
home-cleaning | Home cleaning | HomeAndConstructionBusiness | Book a visit | packages, areaPricing, checklist
locksmith | Locksmith | Locksmith | Call now | areas, emergency24x7
packers-movers | Packers and movers | MovingCompany | Get a quote | routes, process, pricing
mason-contractor | Mason and contractor | GeneralContractor | Get a quote | portfolio, process, areas
cctv-security-installer | CCTV and security installer | HomeAndConstructionBusiness | Get a quote | packages, brands
auto-services family:
auto-mechanic | Auto mechanic | AutoRepair | Book a visit | servicesMenu, brandsServiced, pickupDrop
car-wash-detailing | Car wash and detailing | AutoRepair | Book a slot | packages, beforeAfter

PROFESSIONAL track
healthcare family:
doctor-clinic | Doctor and clinic | Physician | Book appointment | departments, timings, insuranceAccepted, disclaimer
dentist | Dentist | Dentist | Book appointment | treatments, beforeAfter, disclaimer
physiotherapy | Physiotherapy | MedicalClinic | Book appointment | conditions, packages, disclaimer
diagnostics-lab | Diagnostics lab | MedicalBusiness | Book a test | testList, homeCollection, reportsLink
legal-finance family:
lawyer | Lawyer | LegalService | Book consultation | practiceAreas, barCouncilNo, consultationModes, disclaimer
ca-tax-consultant | CA and tax consultant | AccountingService | Book consultation | services, complianceCalendar, disclaimer
insurance-advisor | Insurance advisor | InsuranceAgency | Get a quote | products, disclaimer
education family:
coaching-centre | Coaching centre | EducationalOrganization | Enquire now | courses, batches, fees, results, faculty
tutor | Tutor | LocalBusiness | Book a demo | subjects, fees, results
music-dance-school | Music and dance school | EducationalOrganization | Book a trial | courses, batches, events
wellness-beauty family:
salon-spa | Salon and spa | BeautySalon | Book a slot | servicesMenu, stylists, packages
gym-yoga | Gym and yoga | ExerciseGym | Book a trial | memberships, classTimetable, trainers
creative-consulting family:
photographer | Photographer | Photographer | Check dates | portfolio, packages, process
interior-designer-architect | Interior designer and architect | ProfessionalService | Get a quote | portfolio, process, packages
event-planner | Event planner | ProfessionalService | Get a quote | portfolio, packages, eventTypes
it-consultant | IT and business consultant | ProfessionalService | Book a call | caseStudies, services, process
hospitality-property family:
restaurant-cafe | Restaurant and cafe | Restaurant | Reserve a table | menu, reservations, deliveryLinks
hotel-homestay | Hotel and homestay | Hotel | Check availability | rooms, amenities, nearby
travel-agency | Travel agency | TravelAgency | Plan my trip | packages, destinations
real-estate-agent | Real estate agent | RealEstateAgent | Enquire now | listings, areas, process

ECOMMERCE track
fashion-lifestyle family:
fashion-apparel | Fashion and apparel | Store | Shop now | sizeGuide, collections, offers
jewellery | Jewellery | JewelryStore | Shop now | collections, purityNote, offers
food-grocery family:
grocery-kirana | Grocery and kirana | GroceryStore | Order now | deliveryPinCheck, categories, offers
bakery-sweets | Bakery and sweets | Bakery | Order now | menu, customOrders, deliveryPinCheck
electronics-home family:
electronics-mobile | Electronics and mobiles | ElectronicsStore | Shop now | warranty, brands, offers
home-furniture | Home and furniture | FurnitureStore | Shop now | collections, deliveryInfo, assemblyInfo
gifts-books family:
gifts-handicrafts | Gifts and handicrafts | Store | Shop now | customOrders, collections, occasions
books-stationery | Books and stationery | BookStore | Shop now | categories, bulkOrders

PREVIEW HARNESS (React + TypeScript + Tailwind, routes below)
/ Theme gallery: cards with name, kind (Free or Pro), track, supported families; filters; search.
/theme/:id Preview page:
- Category switcher (all 41) that fills the theme with that category's sample data; page switcher; device switcher 360 / 768 / 1280.
- Edit mode toggle: outlines every bound element with its key and type (text, rich text, image, link, list). Clicking one opens a side panel showing the key and a form input for it, editing the preview live. This proves the theme is editable.
- Editable Fields panel: tree built by parsing the theme's own HTML (section > fields > type > required), with "Copy manifest.json".
- Content-preserved demo: a "Switch theme" button that swaps the theme while keeping the same content.
- Lint panel with pass or fail for rules 1 to 9 above, listing the exact element for every failure. Include a size budget check and a rough contrast check.
- Platform slots drawn as labelled dashed boxes.
/lint Table of all themes by lint result.
Loading a theme: fetch its HTML, apply bindings with a small preview-only function in the harness (this logic is NOT part of the theme).

SAMPLE THEMES FOR THIS STEP
Create ONE small sample Free theme "sample-service" only to prove the kit works (hero, services, about, contact, FAQ, footer) and make it pass lint.

Deliver: the harness, categories.ts, sample theme, lint rules as a reusable module in /src/lib/lint.ts. At the end list the files and confirm the sample theme passes every lint rule.

ADDITIONAL REQUIREMENTS (apply to the Theme Kit, the harness, the lint and EVERY Free and Pro layout built in later prompts)

1. GOOGLE BUSINESS PROFILE FIELD SUPPORT (all Free and Pro sites)
The canonical content model gets a 'profile' block that mirrors the fields of a Google Business Profile so site and profile can be kept in sync: business name; primary category and up to 9 additional categories; address (storefront) or service areas; primary and additional phone numbers; website address; regular hours, special hours and holiday hours; business description (respect Google's character limits, for example 750 characters); opening date; attributes (for example online appointments, wheelchair accessible, Wi-Fi, women-led); services with optional price and description; products with photo, price and link; photos by type (logo, cover, interior, exterior, at work, team, product); appointment, menu and order links; map coordinates and a Google Maps link; social profile links. Every field has a binding, a required flag per category, a 'syncable to Google' flag and a 'last changed from' marker (Site, Google). Show these fields in the harness field tree and in the lint (missing required profile fields block 'ready to publish').

2. REVIEWS AND TESTIMONIALS SLOT (all Free and Pro sites)
A platform slot 'reviews' renders two clearly labelled kinds of items: 'Google reviews' (read from the connected Business Profile, shown exactly as received, with reviewer name, rating, text, date, owner reply and a 'View on Google' link) and 'Customer testimonials' (collected by the vendor with the customer's permission: name, text, optional photo, optional link). The theme only styles the wrapper (summary header, list, card, carousel without script using scroll-snap, empty state, 'Write a review on Google' button). The platform never creates or edits Google reviews, never shows invented reviews, never filters out negative Google reviews, and does not add review structured data for the vendor's own business (display only). Harness shows the slot with 0, 1, 5 and 40 items, long text, owner replies, and both kinds mixed.

3. MAP SLOT: map with pin, address, directions button, Get4Domain-provided embed wrapper styled by the theme, plus service-area chips when the business has no storefront.

4. SOCIAL LINKS SLOT (all Free and Pro sites): up to 8 profile links as plain anchors with icons (Facebook, Instagram, YouTube, LinkedIn, X, WhatsApp channel, Pinterest, Telegram), shown in the footer and contact block, rel set by the platform. Links only; no feeds or widgets in the theme.

5. VIDEO SLOT (Pro sites, and the Get4Domain main site): a platform slot 'video' that shows up to 6 videos from YouTube or Vimeo links as a click-to-load facade (poster, title, duration), with optional chapters and a transcript block under each video. The theme styles the wrapper and grid; Free layouts show this slot as locked 'Videos come with Pro' in the harness only, never on a Free site. The platform adds video structured data and uses privacy-enhanced embeds. Themes contain no iframes or scripts.

6. ADD TO THE SLOT LIST AND LINT: slots now are enquiry-form, whatsapp-float, map, reviews, social-links, video (Pro), booking, cart, product-grid, search, claim-banner, listed-on-badge. Lint rules: every layout includes reviews, map and social-links slots; every Pro theme includes the video slot; slots must reserve space to avoid layout shift; no iframe, script or external widget in a theme.

7. HARNESS ADDITIONS: a 'Profile sync preview' panel showing which fields would flow to or from a Google Business Profile for the selected category, with sample 'changed in both places' conflicts; a Reviews state switcher; a Videos state switcher (0, 1, 6 videos).
