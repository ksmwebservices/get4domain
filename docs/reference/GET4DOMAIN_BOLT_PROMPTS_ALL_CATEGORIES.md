# Get4Domain — Bolt Prompts, All Industries & Subcategories

One ready-to-paste Bolt prompt per real industry and per real subcategory, generated from the actual codebase (`get4domain_mvp/src/config/industry-experience.ts` for the 20-industry Operation Registry, `get4domain_mvp/src/data/demo-site.ts`'s `getSubcategories()` for real subcategory names, `backend-api/src/config/industries/*.ts` for the correct listing-page noun per industry). Scroll to any `###` heading and copy just that one fenced prompt.

## A note on scope, read before using this file

The repo actually has **two different "industry" lists**, and this file resolves the conflict explicitly rather than picking one silently:

- `industry-experience.ts` — exactly **20** industries, each with a defined `primaryOperation` (the Operation Registry the dispatch asked me to use as the source of truth for listing/action pages).
- `industry-content.ts` (which drives the `/demo/[category]` marketplace) — **30** industries. Ten of those thirty (`petcare`, `movers`, `astrology`, `pestcontrol`, `interior`, `homeservices`, `rentalservices`, `printing`, `recruitment`, `government`) have real, curated subcategories in `demo-site.ts` but **no entry in the 20-industry Operation Registry** — they fall back to a generic `enquiry` operation with no industry-specific primary CTA.

This file covers the **20 industries in the Operation Registry**, since that's the list the dispatch named as authoritative for the listing/action-page decision. The 10 registry-less industries above are out of scope here — flagging them so they aren't silently dropped; a follow-up file could cover them once/if they get a real `primaryOperation`.

Within those 20, **9 have a real, curated, multi-item subcategory list** in `demo-site.ts` (clinic, salon, gym, education, professional, travel, restaurant, retail, realestate). The other **11 have no curated subcategories at all** — `getSubcategories()` itself falls back to a single `{ id: 'general', name: <industry name> }` entry for them (coaching, finance, diagnostics, photography, hotel, events, agriculture, automobile, construction, technology, logistics). That fallback **is** the real, live subcategory for those industries — not an invented one — so each gets exactly one H3 (`General`) below rather than a fabricated split.

**Total: 20 industries, 56 subcategory prompts** (see the full count and flags in the report at the end of the dispatch response, not duplicated here).

---

## Clinic & Healthcare

Primary operation: **Appointment** (`Book Appointment`). Listing page: **Services** — except Hospital, which realistically lists doctors/departments rather than a flat service list.

### Clinic (General)

```
Design a modern, professional business website for Clinic — specifically for the general Clinic segment within Clinic & Healthcare. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a calm deep-teal accent (#0F766E) against warm off-white, a humanist sans-serif (Inter or Manrope) for a clean, trustworthy clinical feel, and a spacious, grid-based layout that reads as reassuring rather than clinical-cold.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Services, Book Appointment, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a neighbourhood clinic, value props like same-day slots and experienced doctors, featured services, realistic sample trust-signal stats — years in practice, patients served, average rating), Services (browse the clinic's services), Book Appointment (choose a service, pick a doctor, select a date/time slot, enter patient details), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Clinic (a name that reads as a genuine neighbourhood practice, tone-matched to Get4Domain's existing /industries/clinic marketing copy, not copied verbatim), 8-12 realistic sample services with names/prices/descriptions/images genuinely fitting a general clinic — for example, "General Consultation", "Full Body Health Checkup", "Vaccination" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

### Dental

```
Design a modern, professional business website for Dental — specifically for the Dental segment within Clinic & Healthcare. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a fresh mint-and-white accent (#14B8A6 on white), a rounded, friendly sans-serif (Poppins or Nunito) that softens the usual dental-clinic sterility, and a bright, airy layout with generous whitespace.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Services, Book Appointment, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a modern dental practice, value props like painless treatment and modern equipment, featured services, realistic sample trust-signal stats — smiles treated, years of experience, patient rating), Services (browse dental treatments), Book Appointment (choose a treatment, pick a dentist, select a date/time slot, enter patient details), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Dental clinic (tone-matched to Get4Domain's existing /industries/clinic marketing copy, not copied verbatim), 8-12 realistic sample services with names/prices/descriptions/images genuinely fitting a dental clinic — for example, "Root Canal Treatment", "Teeth Whitening", "Braces & Aligners" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

### Skin & Hair Clinic (Dermatology)

```
Design a modern, professional business website for Skin & Hair Clinic — specifically for the Dermatology segment within Clinic & Healthcare. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a soft rose-gold accent (#D4A574) on a warm ivory background, an elegant serif for headings (Playfair Display) paired with a clean sans body font, and a spa-like, calm layout that feels more skincare boutique than hospital.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Services, Book Appointment, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a skin & hair clinic, value props like dermatologist-led care and advanced technology, featured services, realistic sample trust-signal stats — treatments completed, dermatologists on staff, patient rating), Services (browse skin and hair treatments), Book Appointment (choose a treatment, pick a dermatologist, select a date/time slot, enter patient details), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Skin & Hair Clinic (tone-matched to Get4Domain's existing /industries/clinic marketing copy, not copied verbatim), 8-12 realistic sample services with names/prices/descriptions/images genuinely fitting a dermatology clinic — for example, "Acne Treatment", "Laser Hair Reduction", "PRP Hair Therapy" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

### Orthopaedic Clinic

```
Design a modern, professional business website for Orthopaedic Clinic — specifically for the Orthopaedic segment within Clinic & Healthcare. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a strong steel-blue/navy accent (#1E3A5F), a confident, slightly condensed sans-serif (Barlow or Archivo) for a clinical-but-athletic feel, and a structured layout with clear visual hierarchy suited to a specialist practice.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Services, Book Appointment, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to an orthopaedic practice, value props like specialist surgeons and modern diagnostics, featured services, realistic sample trust-signal stats — surgeries performed, years of experience, patient rating), Services (browse orthopaedic services), Book Appointment (choose a service, pick a doctor, select a date/time slot, enter patient details), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Orthopaedic Clinic (tone-matched to Get4Domain's existing /industries/clinic marketing copy, not copied verbatim), 8-12 realistic sample services with names/prices/descriptions/images genuinely fitting an orthopaedic practice — for example, "Knee Replacement Consultation", "Sports Injury Treatment", "Physiotherapy-Linked Recovery Plan" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

### Physiotherapy

```
Design a modern, professional business website for Physiotherapy — specifically for the Physiotherapy segment within Clinic & Healthcare. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: an energetic teal-green accent (#0D9488) on white, a dynamic rounded sans-serif (Outfit or Sora), and a layout built around movement — angled section dividers, active-body imagery placeholders — rather than a static clinical grid.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Services, Book Appointment, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a physiotherapy practice, value props like personalised recovery plans and home-visit options, featured services, realistic sample trust-signal stats — patients recovered, years of experience, patient rating), Services (browse physiotherapy programs), Book Appointment (choose a program, pick a physiotherapist, select a date/time slot, enter patient details), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Physiotherapy centre (tone-matched to Get4Domain's existing /industries/clinic marketing copy, not copied verbatim), 8-12 realistic sample services with names/prices/descriptions/images genuinely fitting a physiotherapy practice — for example, "Post-Surgery Rehab", "Sports Physiotherapy", "Home Visit Session" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

### General Physician

```
Design a modern, professional business website for General Physician — specifically for the General Physician segment within Clinic & Healthcare. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a warm approachable sky-blue accent (#3B82F6) on soft white, a friendly rounded sans-serif (Nunito or Quicksand), and a family-clinic layout that feels welcoming rather than institutional.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Services, Book Appointment, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a family general-physician practice, value props like walk-in slots and family care continuity, featured services, realistic sample trust-signal stats — families served, years in practice, patient rating), Services (browse general consultation and health services), Book Appointment (choose a service, pick a doctor, select a date/time slot, enter patient details), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this General Physician practice (tone-matched to Get4Domain's existing /industries/clinic marketing copy, not copied verbatim), 8-12 realistic sample services with names/prices/descriptions/images genuinely fitting a general-physician clinic — for example, "General Consultation", "Fever & Infection Care", "Diabetes Management" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

### Hospital

```
Design a modern, professional business website for Hospital — specifically for the Hospital segment within Clinic & Healthcare. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: an authoritative deep-maroon accent (#7F1D1D) against clean white, a serious serif for headings (Merriweather) paired with a neutral sans body, and a structured, multi-department layout that conveys scale and credibility.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Doctors & Departments, Book Appointment, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a multi-department hospital, value props like 24/7 emergency care and specialist doctors, featured departments, realistic sample trust-signal stats — beds, doctors, patients treated), Doctors & Departments (browse departments and the doctors within each — the realistic listing concept for a hospital, rather than a flat service list), Book Appointment (choose a department/doctor, select a date/time slot, enter patient details), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Hospital (tone-matched to Get4Domain's existing /industries/clinic marketing copy, not copied verbatim), 8-12 realistic sample departments/doctors with names/specialities/descriptions/images genuinely fitting a multi-speciality hospital — for example, "Dr. — Cardiology", "Dr. — Orthopaedics", "Emergency & Trauma Care" — believable INR consultation pricing.

Keep HTML structure clean and semantic for later backend integration.
```

---

## Salon & Beauty

Primary operation: **Appointment** (`Book Appointment`). Listing page: **Services**.

### Salon (General)

```
Design a modern, professional business website for Salon — specifically for the general Salon segment within Salon & Beauty. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a rich blush-and-gold accent (#C9A876 on #FDF2F8), an elegant sans-serif with a touch of glamour (Cormorant for headings, Jost for body), and a boutique-salon layout with strong imagery focus.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Services, Book Appointment, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a modern salon, value props like expert stylists and premium products, featured services, realistic sample trust-signal stats — clients served, stylists on staff, average rating), Services (browse salon services), Book Appointment (choose a service, pick a stylist, select a date/time slot, enter customer details), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Salon (tone-matched to Get4Domain's existing /industries/salon marketing copy, not copied verbatim), 8-12 realistic sample services with names/prices/descriptions/images genuinely fitting a general salon — for example, "Haircut & Styling", "Hair Colour", "Classic Manicure" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

### Spa

```
Design a modern, professional business website for Spa — specifically for the Spa segment within Salon & Beauty. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a tranquil sage-green and sand accent (#8B9D83 on #F5F0E8), a calm serif/sans pairing (Cormorant Garamond + Karla), and a slow, breathing layout with lots of negative space to evoke relaxation.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Services, Book Appointment, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a wellness spa, value props like therapeutic treatments and a calming environment, featured services, realistic sample trust-signal stats — sessions delivered, therapists on staff, average rating), Services (browse spa treatments), Book Appointment (choose a treatment, pick a therapist, select a date/time slot, enter customer details), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Spa (tone-matched to Get4Domain's existing /industries/salon marketing copy, not copied verbatim), 8-12 realistic sample services with names/prices/descriptions/images genuinely fitting a spa — for example, "Swedish Full Body Massage", "Aromatherapy Session", "Couples Spa Package" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

### Nail Studio

```
Design a modern, professional business website for Nail Studio — specifically for the Nail Studio segment within Salon & Beauty. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a playful coral-and-cream accent (#FF6B81 on #FFF8F5), a bold rounded display font for headings (Fredoka) with a clean sans body, and a colourful, grid-of-cards layout that shows off nail art visually.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Services, Book Appointment, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a nail studio, value props like hygienic tools and trending nail art, featured services, realistic sample trust-signal stats — clients served, nail artists on staff, average rating), Services (browse nail services and art styles), Book Appointment (choose a service, pick a nail artist, select a date/time slot, enter customer details), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Nail Studio (tone-matched to Get4Domain's existing /industries/salon marketing copy, not copied verbatim), 8-12 realistic sample services with names/prices/descriptions/images genuinely fitting a nail studio — for example, "Gel Manicure", "Nail Art (per nail)", "Acrylic Extensions" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

### Bridal & Makeup

```
Design a modern, professional business website for Bridal & Makeup — specifically for the Bridal & Makeup segment within Salon & Beauty. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a luxurious maroon-and-gold accent (#7A1F3D on #FFF9F0), a dramatic serif display font for headings (Playfair Display) with an elegant sans body, and a portfolio-forward, full-bleed-imagery layout befitting a bridal brand.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Services, Book Appointment, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a bridal makeup artist/studio, value props like HD makeup and destination-wedding availability, featured packages, realistic sample trust-signal stats — brides styled, years of experience, average rating), Services (browse bridal and party makeup packages), Book Appointment (choose a package, pick a date, enter event and customer details), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Bridal & Makeup studio (tone-matched to Get4Domain's existing /industries/salon marketing copy, not copied verbatim), 8-12 realistic sample services/packages with names/prices/descriptions/images genuinely fitting bridal makeup — for example, "Bridal HD Makeup", "Engagement Look", "Family Function Package" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

### Men's Grooming

```
Design a modern, professional business website for Men's Grooming — specifically for the Men's Grooming segment within Salon & Beauty. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a sharp charcoal-and-amber accent (#F59E0B on #1F2937), a strong condensed sans-serif (Bebas Neue for headings, Work Sans for body), and a masculine, barbershop-inspired layout with bold blocks.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Services, Book Appointment, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a men's grooming lounge, value props like skilled barbers and a premium grooming experience, featured services, realistic sample trust-signal stats — clients served, barbers on staff, average rating), Services (browse grooming services), Book Appointment (choose a service, pick a barber, select a date/time slot, enter customer details), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Men's Grooming lounge (tone-matched to Get4Domain's existing /industries/salon marketing copy, not copied verbatim), 8-12 realistic sample services with names/prices/descriptions/images genuinely fitting men's grooming — for example, "Classic Haircut", "Beard Styling & Shave", "Hair Spa for Men" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

---

## Gym & Fitness

Primary operation: **Membership** (`Join Now`). Listing page: **Membership Plans**.

### Gym (General)

```
Design a modern, professional business website for Gym — specifically for the general Gym segment within Gym & Fitness. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a high-energy black-and-lime accent (#A3E635 on #111111), a bold industrial display font (Anton for headings, Roboto Condensed for body), and a dark, high-contrast layout with strong diagonal motion cues.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Membership Plans, Join Now, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a modern gym, value props like certified trainers and modern equipment, featured plans, realistic sample trust-signal stats — members, trainers, years running), Membership Plans (browse membership tiers), Join Now (choose a plan, select duration, enter member details, proceed to payment), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Gym (tone-matched to Get4Domain's existing /industries/gym marketing copy, not copied verbatim), 8-12 realistic sample membership plans with names/prices/descriptions/images genuinely fitting a gym — for example, "1-Month Access", "6-Month Gym + Cardio", "Annual Premium Membership" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

### Yoga Studio

```
Design a modern, professional business website for Yoga Studio — specifically for the Yoga segment within Gym & Fitness. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a serene terracotta-and-cream accent (#C08552 on #FAF6F0), a calm organic sans-serif (Josefin Sans for headings, Lato for body), and a breathable, slow-scroll layout with earthy, natural-texture cues.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Membership Plans, Join Now, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a yoga studio, value props like certified instructors and mindful practice, featured plans, realistic sample trust-signal stats — practitioners, classes held, average rating), Membership Plans (browse class packs and membership tiers), Join Now (choose a plan, select preferred class timings, enter member details, proceed to payment), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Yoga Studio (tone-matched to Get4Domain's existing /industries/gym marketing copy, not copied verbatim), 8-12 realistic sample plans/classes with names/prices/descriptions/images genuinely fitting a yoga studio — for example, "Hatha Yoga — Monthly", "Prenatal Yoga Pack", "Meditation & Pranayama" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

### CrossFit

```
Design a modern, professional business website for CrossFit — specifically for the CrossFit segment within Gym & Fitness. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a raw concrete-grey and safety-orange accent (#FF5A1F on #2B2B2B), a rugged industrial font (Oswald for headings, Barlow for body), and a gritty, box-gym layout with bold blocky sections.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Membership Plans, Join Now, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a CrossFit box, value props like community-driven WODs and certified coaches, featured plans, realistic sample trust-signal stats — athletes, coaches, years running), Membership Plans (browse membership tiers), Join Now (choose a plan, select preferred WOD timings, enter member details, proceed to payment), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this CrossFit box (tone-matched to Get4Domain's existing /industries/gym marketing copy, not copied verbatim), 8-12 realistic sample plans with names/prices/descriptions/images genuinely fitting a CrossFit box — for example, "Unlimited WOD — Monthly", "Foundations Course (New Athletes)", "Open Gym Access" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

### Personal Training

```
Design a modern, professional business website for Personal Training — specifically for the Personal Training segment within Gym & Fitness. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a sleek graphite-and-electric-blue accent (#2563EB on #18181B), a precise modern sans (Sora for headings, Inter for body), and a results-focused layout with progress-metric visual motifs.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Membership Plans, Join Now, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a personal training practice, value props like one-on-one coaching and custom nutrition plans, featured plans, realistic sample trust-signal stats — clients transformed, years of experience, average rating), Membership Plans (browse training packages), Join Now (choose a package, select preferred session timings, enter member details, proceed to payment), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Personal Training practice (tone-matched to Get4Domain's existing /industries/gym marketing copy, not copied verbatim), 8-12 realistic sample packages with names/prices/descriptions/images genuinely fitting personal training — for example, "1-on-1 Training — 12 Sessions", "Weight Loss Program (3 Months)", "Online Coaching + Diet Plan" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

### Zumba & Dance Fitness

```
Design a modern, professional business website for Zumba & Dance Fitness — specifically for the Dance Fitness segment within Gym & Fitness. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a vibrant magenta-and-yellow accent (#EC4899 with #FDE047 highlights on white), a fun bouncy display font (Baloo 2 for headings, Nunito for body), and an energetic, music-video-inspired layout with dynamic diagonal crops.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Membership Plans, Join Now, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a Zumba/dance fitness studio, value props like fun group classes and high-energy instructors, featured plans, realistic sample trust-signal stats — dancers, classes run weekly, average rating), Membership Plans (browse class packs and membership tiers), Join Now (choose a plan, select preferred class timings, enter member details, proceed to payment), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Zumba & Dance Fitness studio (tone-matched to Get4Domain's existing /industries/gym marketing copy, not copied verbatim), 8-12 realistic sample plans/classes with names/prices/descriptions/images genuinely fitting dance fitness — for example, "Zumba — Monthly Unlimited", "Bollywood Dance Fitness Pack", "Kids Dance Batch" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

---

## Coaching & Training

Primary operation: **Enquiry** (`Book a Call`). Listing page: **Courses**. `demo-site.ts` has no curated subcategory split for this top-level industry — `getSubcategories()` returns only the single `general` fallback, so there is exactly one prompt.

### Coaching & Training (General)

```
Design a modern, professional business website for Coaching & Training — specifically for the general Coaching & Training business. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a driven indigo-and-amber accent (#4F46E5 with #F59E0B highlights on white), a confident modern sans (Sora for headings, Inter for body), and a results/testimonial-forward layout that builds credibility fast.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Courses, Book a Call, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a coaching/training practice, value props like proven methodology and expert mentors, featured courses, realistic sample trust-signal stats — students coached, success rate, average rating), Courses (browse coaching programs and courses), Book a Call (a lead-capture form — name, contact, course of interest, preferred callback time), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this coaching/training practice (tone-matched to Get4Domain's existing /industries/coaching marketing copy, not copied verbatim), 8-12 realistic sample courses/programs with names/prices/descriptions/images genuinely fitting a coaching business — for example, "Career Coaching — 1-on-1", "Public Speaking Bootcamp", "Interview Preparation Program" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

---

## Education & Schools

Primary operation: **Enquiry** (`Admission Enquiry`). Listing page: **Courses**.

### School (General)

```
Design a modern, professional business website for School — specifically for the general School segment within Education & Schools. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a trustworthy royal-blue and gold accent (#1E40AF with #FBBF24 highlights on white), a classic-but-modern sans (Merriweather for headings, Source Sans Pro for body), and a warm, campus-photography-forward layout.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Courses, Admission Enquiry, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a school, value props like experienced faculty and holistic development, featured programs, realistic sample trust-signal stats — students enrolled, years established, board results), Courses (browse grades/programs offered), Admission Enquiry (a lead-capture form — student details, grade applying for, parent contact, preferred callback time), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this School (tone-matched to Get4Domain's existing /industries/education marketing copy, not copied verbatim), 8-12 realistic sample programs/grades with names/descriptions/images genuinely fitting a school — for example, "Primary Wing (Grades 1-5)", "Secondary Wing (Grades 6-10)", "After-School Activity Programs" — believable INR fee ranges.

Keep HTML structure clean and semantic for later backend integration.
```

### Coaching Centre

```
Design a modern, professional business website for Coaching Centre — specifically for the Coaching Centre segment within Education & Schools. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a sharp crimson-and-charcoal accent (#DC2626 on #1F2937), a bold exam-prep-appropriate sans (Rubik for headings, Inter for body), and a results-and-rank-focused layout with strong stat callouts.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Courses, Admission Enquiry, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to an exam-coaching centre, value props like top-rank faculty and proven results, featured courses, realistic sample trust-signal stats — students coached, top ranks achieved, success rate), Courses (browse exam-prep courses), Admission Enquiry (a lead-capture form — student details, course of interest, parent contact, preferred callback time), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Coaching Centre (tone-matched to Get4Domain's existing /industries/education marketing copy, not copied verbatim), 8-12 realistic sample courses with names/prices/descriptions/images genuinely fitting exam coaching — for example, "JEE Foundation Course", "NEET Crash Course", "Class 10 Board Exam Batch" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

### College

```
Design a modern, professional business website for College — specifically for the College segment within Education & Schools. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a mature maroon-and-stone accent (#7C2D2D on #F5F5F4), an academic serif for headings (Lora) with a clean sans body (Source Sans Pro), and a spacious, campus-and-department-forward layout.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Courses, Admission Enquiry, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a college, value props like accredited programs and placement support, featured courses, realistic sample trust-signal stats — students enrolled, placement rate, years established), Courses (browse degree programs/departments), Admission Enquiry (a lead-capture form — applicant details, program of interest, contact, preferred callback time), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this College (tone-matched to Get4Domain's existing /industries/education marketing copy, not copied verbatim), 8-12 realistic sample programs/departments with names/descriptions/images genuinely fitting a college — for example, "B.Com — Commerce", "BCA — Computer Applications", "B.A. — Mass Communication" — believable INR fee ranges.

Keep HTML structure clean and semantic for later backend integration.
```

---

## Professional Services

Primary operation: **Enquiry** (`Book a Consultation`). Listing page: **Services**.

### Professional Services (General)

```
Design a modern, professional business website for Professional Services — specifically for the general Professional Services segment. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a composed slate-and-copper accent (#B45309 on #1E293B), a precise corporate sans (IBM Plex Sans for headings and body), and a structured, credibility-first layout with clean data-table-style sections.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Services, Book a Consultation, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a professional services firm, value props like experienced consultants and end-to-end handling, featured services, realistic sample trust-signal stats — clients served, years in practice, average rating), Services (browse professional service offerings), Book a Consultation (a lead-capture form — name, contact, service of interest, preferred callback time), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Professional Services firm (tone-matched to Get4Domain's existing /industries/professional marketing copy, not copied verbatim), 8-12 realistic sample services with names/prices/descriptions/images genuinely fitting a general professional-services firm — for example, "Business Advisory Session", "Documentation & Compliance Support", "Contract Review" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

### CA & Accounting

```
Design a modern, professional business website for CA & Accounting — specifically for the CA & Accounting segment within Professional Services. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a trustworthy forest-green and gold accent (#166534 with #CA8A04 highlights on white), a precise, numbers-friendly sans (IBM Plex Sans for headings and body), and a clean, ledger-inspired layout with strong tabular sections.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Services, Book a Consultation, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a CA & accounting firm, value props like qualified chartered accountants and timely filings, featured services, realistic sample trust-signal stats — clients served, years in practice, filings completed), Services (browse accounting and tax services), Book a Consultation (a lead-capture form — name, contact, service of interest, preferred callback time), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this CA & Accounting firm (tone-matched to Get4Domain's existing /industries/professional marketing copy, not copied verbatim), 8-12 realistic sample services with names/prices/descriptions/images genuinely fitting a CA firm — for example, "Income Tax Filing", "GST Registration & Filing", "Bookkeeping — Monthly" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

### Legal & Advocates

```
Design a modern, professional business website for Legal & Advocates — specifically for the Legal segment within Professional Services. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: an authoritative navy-and-brass accent (#1E293B with #B8860B highlights on ivory), a formal serif for headings (Playfair Display) with a clean sans body (Source Sans Pro), and a dignified, low-clutter layout.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Services, Book a Consultation, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a law practice, value props like experienced advocates and confidential handling, featured practice areas, realistic sample trust-signal stats — cases handled, years of practice, client rating), Services (browse practice areas), Book a Consultation (a lead-capture form — name, contact, matter type, preferred callback time), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Legal practice (tone-matched to Get4Domain's existing /industries/professional marketing copy, not copied verbatim), 8-12 realistic sample practice areas/services with names/prices/descriptions/images genuinely fitting a law firm — for example, "Property Dispute Consultation", "Contract Drafting", "Family Law Matters" — believable INR consultation pricing.

Keep HTML structure clean and semantic for later backend integration.
```

### Company Registration

```
Design a modern, professional business website for Company Registration — specifically for the Company Registration segment within Professional Services. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a startup-friendly electric-blue and white accent (#2563EB), a modern geometric sans (Sora for headings, Inter for body), and a clean, process-step-forward layout (registration in N easy steps).

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Services, Book a Consultation, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a company registration service, value props like fast turnaround and end-to-end compliance support, featured packages, realistic sample trust-signal stats — companies registered, average turnaround time, client rating), Services (browse registration packages), Book a Consultation (a lead-capture form — name, contact, entity type, preferred callback time), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Company Registration service (tone-matched to Get4Domain's existing /industries/professional marketing copy, not copied verbatim), 8-12 realistic sample packages with names/prices/descriptions/images genuinely fitting company registration — for example, "Private Limited Company Registration", "LLP Registration", "MSME/Udyam Registration" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

### Insurance Advisory

```
Design a modern, professional business website for Insurance Advisory — specifically for the Insurance Advisory segment within Professional Services. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a reassuring teal-and-navy accent (#0891B2 on #0F172A), a clean trustworthy sans (Inter throughout), and a calm, protection-focused layout with clear plan-comparison sections.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Services, Book a Consultation, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to an insurance advisory practice, value props like unbiased plan comparison and claims support, featured plan categories, realistic sample trust-signal stats — clients advised, claims assisted, years in practice), Services (browse insurance categories advised on), Book a Consultation (a lead-capture form — name, contact, insurance type of interest, preferred callback time), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Insurance Advisory practice (tone-matched to Get4Domain's existing /industries/professional marketing copy, not copied verbatim), 8-12 realistic sample advisory categories with names/descriptions/images genuinely fitting insurance advisory — for example, "Health Insurance Advisory", "Term Life Insurance Planning", "Vehicle Insurance Renewal" — believable INR premium ranges.

Keep HTML structure clean and semantic for later backend integration.
```

---

## Finance & Advisory

Primary operation: **Lead** (`Get a Quote`). Listing page: **Services**. `demo-site.ts` has no curated subcategory split — `getSubcategories()` returns only `general`, so there is exactly one prompt.

### Finance & Advisory (General)

```
Design a modern, professional business website for Finance & Advisory — specifically for the general Finance & Advisory business. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a confident forest-green and charcoal accent (#15803D on #1F2937), a precise financial sans (IBM Plex Sans throughout), and a data-forward layout with clean chart/stat callouts.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Services, Get a Quote, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a finance advisory practice, value props like personalised financial planning and trusted advisors, featured services, realistic sample trust-signal stats — clients advised, assets guided, years in practice), Services (browse financial advisory services), Get a Quote (a lead-capture form — name, contact, service/product of interest, preferred callback time), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Finance & Advisory practice (tone-matched to Get4Domain's existing /industries/finance marketing copy, not copied verbatim), 8-12 realistic sample services with names/descriptions/images genuinely fitting a finance advisory business — for example, "Mutual Fund Advisory", "Retirement Planning", "Loan Advisory & Comparison" — believable INR fee/commission framing.

Keep HTML structure clean and semantic for later backend integration.
```

---

## Diagnostics & Labs

Primary operation: **Booking** (`Book a Test`). Listing page: **Tests**. No curated subcategory split — one prompt.

### Diagnostics & Labs (General)

```
Design a modern, professional business website for Diagnostics & Labs — specifically for the general Diagnostics & Labs business. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a clinical-but-approachable cyan-and-white accent (#0891B2), a clean modern sans (Inter throughout), and a precise, test-catalogue-style layout with clear turnaround-time badges.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Tests, Book a Test, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a diagnostic lab, value props like accurate results and home sample collection, featured tests, realistic sample trust-signal stats — tests conducted, report turnaround time, collection centres), Tests (browse individual tests and health-checkup packages), Book a Test (choose test(s), select home-collection or walk-in, pick a date/time slot, enter patient details), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Diagnostics & Labs business (tone-matched to Get4Domain's existing /industries/diagnostics marketing copy, not copied verbatim), 8-12 realistic sample tests/packages with names/prices/descriptions/images genuinely fitting a diagnostic lab — for example, "Complete Blood Count (CBC)", "Full Body Health Checkup", "Thyroid Profile" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

---

## Photography & Studio

Primary operation: **Enquiry** (`Check Availability`). Listing page: **Packages**. No curated subcategory split — one prompt.

### Photography & Studio (General)

```
Design a modern, professional business website for Photography & Studio — specifically for the general Photography & Studio business. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a moody black-and-gold accent (#D4AF37 on #0A0A0A), an editorial serif for headings (Playfair Display) with a minimal sans body (Inter), and a full-bleed, portfolio-first layout that lets photography breathe.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Packages, Check Availability, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a photography studio, value props like a distinctive style and full-day coverage, featured packages, realistic sample trust-signal stats — shoots delivered, years of experience, average rating), Packages (browse shoot packages — wedding, portrait, events), Check Availability (a lead-capture/booking form — event date, package of interest, contact details), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Photography Studio (tone-matched to Get4Domain's existing /industries/photography marketing copy, not copied verbatim), 8-12 realistic sample packages with names/prices/descriptions/images genuinely fitting a photography studio — for example, "Wedding Photography — Full Day", "Pre-Wedding Shoot", "Corporate Event Coverage" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

---

## Hotel & Hospitality

Primary operation: **Booking** (`Check Availability`). Listing page: **Room Types**. No curated subcategory split — one prompt.

### Hotel & Hospitality (General)

```
Design a modern, professional business website for Hotel & Hospitality — specifically for the general Hotel & Hospitality business. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a warm burgundy-and-cream accent (#7F1D1D on #FDF8F0), an elegant serif for headings (Cormorant Garamond) with a clean sans body (Lato), and a spacious, hospitality-brand layout with generous room-photography sections.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Room Types, Check Availability, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a hotel, value props like prime location and modern amenities, featured room types, realistic sample trust-signal stats — rooms, years operating, guest rating), Room Types (browse room categories), Check Availability (choose room type, check-in/check-out dates, guest count, proceed to booking), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Hotel (tone-matched to Get4Domain's existing /industries/hotel marketing copy, not copied verbatim), 8-12 realistic sample room types/packages with names/prices/descriptions/images genuinely fitting a hotel — for example, "Deluxe Room", "Executive Suite", "Weekend Getaway Package" — believable INR per-night pricing.

Keep HTML structure clean and semantic for later backend integration.
```

---

## Events & Venues

Primary operation: **Enquiry** (`Check Your Date`). Listing page: **Packages**. No curated subcategory split — one prompt.

### Events & Venues (General)

```
Design a modern, professional business website for Events & Venues — specifically for the general Events & Venues business. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a celebratory plum-and-gold accent (#6B21A8 with #EAB308 highlights on white), a festive display serif for headings (Playfair Display) with a clean sans body (Inter), and an energetic, gallery-forward layout showcasing past events.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Packages, Check Your Date, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to an events & venue business, value props like a flexible venue and full-service event management, featured packages, realistic sample trust-signal stats — events hosted, guest capacity, average rating), Packages (browse event/venue packages), Check Your Date (a lead-capture/booking form — event date, event type, guest count, contact details), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Events & Venues business (tone-matched to Get4Domain's existing /industries/events marketing copy, not copied verbatim), 8-12 realistic sample packages with names/prices/descriptions/images genuinely fitting an events business — for example, "Wedding Venue — Full Day", "Corporate Event Package", "Birthday Party Package" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

---

## Travel & Tours

Primary operation: **Enquiry** (`Plan My Trip`). Listing page: **Packages**.

### Travel Agency (General)

```
Design a modern, professional business website for Travel Agency — specifically for the general Travel Agency segment within Travel & Tours. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: an adventurous sky-blue and sunset-orange accent (#0EA5E9 with #F97316 highlights on white), a friendly modern sans (Poppins for headings, Inter for body), and a destination-photography-forward layout with map-inspired section dividers.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Packages, Plan My Trip, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a travel agency, value props like curated itineraries and 24/7 trip support, featured packages, realistic sample trust-signal stats — travellers served, destinations covered, average rating), Packages (browse tour packages), Plan My Trip (a lead-capture/enquiry form — destination, travel dates, number of travellers, contact details), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Travel Agency (tone-matched to Get4Domain's existing /industries/travel marketing copy, not copied verbatim), 8-12 realistic sample tour packages with names/prices/descriptions/images genuinely fitting a general travel agency — for example, "Goa 4N/5D Beach Package", "Kerala Backwaters Tour", "Manali-Shimla Hill Package" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

### Holiday Packages

```
Design a modern, professional business website for Holiday Packages — specifically for the Holiday Packages segment within Travel & Tours. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a joyful turquoise-and-coral accent (#14B8A6 with #FB7185 highlights on white), a cheerful rounded sans (Quicksand for headings, Inter for body), and a card-based, browse-by-destination layout.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Packages, Plan My Trip, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a holiday-packages specialist, value props like all-inclusive pricing and handpicked stays, featured packages, realistic sample trust-signal stats — holidays booked, destinations covered, average rating), Packages (browse holiday packages by destination), Plan My Trip (a lead-capture/enquiry form — destination, travel dates, number of travellers, contact details), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Holiday Packages business (tone-matched to Get4Domain's existing /industries/travel marketing copy, not copied verbatim), 8-12 realistic sample packages with names/prices/descriptions/images genuinely fitting holiday packages — for example, "Andaman 5N/6D All-Inclusive", "Ooty-Coorg Hill Escape", "Rajasthan Heritage Tour" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

### Cab & Car Rental

```
Design a modern, professional business website for Cab & Car Rental — specifically for the Cab & Car Rental segment within Travel & Tours. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a reliable navy-and-yellow accent (#1E3A8A with #FACC15 highlights on white, taxi-inspired without being literal), a clean utilitarian sans (Roboto throughout), and a functional, fleet-listing layout.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Packages, Plan My Trip, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a cab & car rental service, value props like verified drivers and transparent pricing, featured vehicle/route packages, realistic sample trust-signal stats — trips completed, vehicles in fleet, average rating), Packages (browse cab packages/outstation routes and rental vehicles), Plan My Trip (a lead-capture/enquiry form — pickup/drop location, travel date, vehicle preference, contact details), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Cab & Car Rental service (tone-matched to Get4Domain's existing /industries/travel marketing copy, not copied verbatim), 8-12 realistic sample packages/vehicles with names/prices/descriptions/images genuinely fitting cab and car rental — for example, "Sedan — Local (8hr/80km)", "Outstation One-Way — SUV", "Airport Transfer" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

### Visa & Ticketing

```
Design a modern, professional business website for Visa & Ticketing — specifically for the Visa & Ticketing segment within Travel & Tours. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a precise cobalt-and-white accent (#1D4ED8), a clean documentation-appropriate sans (Inter throughout), and a process-clarity layout (step-by-step visa process, document checklists).

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Packages, Plan My Trip, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a visa & ticketing agency, value props like high approval rates and document assistance, featured services, realistic sample trust-signal stats — visas processed, countries covered, average rating), Packages (browse visa services by country and ticketing services), Plan My Trip (a lead-capture/enquiry form — destination country, travel date, visa type, contact details), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Visa & Ticketing agency (tone-matched to Get4Domain's existing /industries/travel marketing copy, not copied verbatim), 8-12 realistic sample services with names/prices/descriptions/images genuinely fitting visa and ticketing — for example, "Schengen Visa Assistance", "UAE Tourist Visa", "International Flight Ticketing" — believable INR service-fee pricing.

Keep HTML structure clean and semantic for later backend integration.
```

### Pilgrimage Tours

```
Design a modern, professional business website for Pilgrimage Tours — specifically for the Pilgrimage Tours segment within Travel & Tours. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a reverent saffron-and-maroon accent (#EA580C with #7C2D2D highlights on warm ivory), a dignified serif for headings (Lora) with a clean sans body (Noto Sans), and a calm, temple-and-pilgrimage-photography layout.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Packages, Plan My Trip, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a pilgrimage tour operator, value props like well-organised darshan arrangements and comfortable stays, featured packages, realistic sample trust-signal stats — pilgrims served, temples covered, average rating), Packages (browse pilgrimage tour packages), Plan My Trip (a lead-capture/enquiry form — destination, travel dates, number of pilgrims, contact details), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Pilgrimage Tours operator (tone-matched to Get4Domain's existing /industries/travel marketing copy, not copied verbatim), 8-12 realistic sample packages with names/prices/descriptions/images genuinely fitting pilgrimage tours — for example, "Char Dham Yatra Package", "Tirupati Darshan — 2 Days", "Varanasi-Ayodhya Pilgrimage Tour" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

---

## Restaurant & Cafe

Primary operation: **Order** (`Order Now`, cart-based). Listing page: **Menu**.

### Restaurant (General)

```
Design a modern, professional business website for Restaurant — specifically for the general Restaurant segment within Restaurant & Cafe. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a warm terracotta-and-charcoal accent (#C2410C on #1C1917), an appetite-friendly serif for headings (Playfair Display) with a clean sans body (Inter), and a food-photography-forward layout with generous imagery.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Menu, Cart, Order Now, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a restaurant, value props like fresh ingredients and quick service, featured dishes, realistic sample trust-signal stats — orders served, years running, average rating), Menu (browse the food menu by category, add items to cart), Cart / Order Now (review cart, choose dine-in/delivery/pickup, enter details, proceed to payment), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Restaurant (tone-matched to Get4Domain's existing /industries/restaurant marketing copy, not copied verbatim), 8-12 realistic sample menu items with names/prices/descriptions/images genuinely fitting a general restaurant — for example, "Butter Chicken", "Paneer Tikka", "Veg Biryani" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

### Cafe

```
Design a modern, professional business website for Cafe — specifically for the Cafe segment within Restaurant & Cafe. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a cozy coffee-brown and cream accent (#78350F on #FEF3E2), a warm handwritten-style display font for accents (Caveat) paired with a clean sans (Nunito), and a relaxed, chalkboard-menu-inspired layout.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Menu, Cart, Order Now, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a cafe, value props like specialty coffee and a cozy ambience, featured menu items, realistic sample trust-signal stats — cups served, years running, average rating), Menu (browse coffee, food and dessert menu, add items to cart), Cart / Order Now (review cart, choose dine-in/takeaway, enter details, proceed to payment), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Cafe (tone-matched to Get4Domain's existing /industries/restaurant marketing copy, not copied verbatim), 8-12 realistic sample menu items with names/prices/descriptions/images genuinely fitting a cafe — for example, "Cappuccino", "Cold Brew", "Chocolate Croissant" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

### Cloud Kitchen

```
Design a modern, professional business website for Cloud Kitchen — specifically for the Cloud Kitchen segment within Restaurant & Cafe. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a bold delivery-app-inspired red-and-black accent (#DC2626 on #171717), a punchy geometric sans (Poppins for headings, Inter for body), and a fast, delivery-first layout optimised for quick ordering.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Menu, Cart, Order Now, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a cloud/delivery-only kitchen, value props like fast delivery and consistent quality, featured menu items, realistic sample trust-signal stats — orders delivered, average delivery time, average rating), Menu (browse the delivery menu by category, add items to cart), Cart / Order Now (review cart, enter delivery address, choose payment method, place order), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Cloud Kitchen (tone-matched to Get4Domain's existing /industries/restaurant marketing copy, not copied verbatim), 8-12 realistic sample menu items with names/prices/descriptions/images genuinely fitting a delivery-focused cloud kitchen — for example, "Chicken Biryani (Family Pack)", "Loaded Fries", "Combo Meal — Burger + Fries + Drink" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

### Bakery

```
Design a modern, professional business website for Bakery — specifically for the Bakery segment within Restaurant & Cafe. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a sweet blush-pink and butter-cream accent (#F472B6 on #FFFBEB), a playful bakery-appropriate display font (Pacifico for accents) with a clean sans body (Quicksand), and a warm, pastry-photography-forward layout.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Menu, Cart, Order Now, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a bakery, value props like fresh-baked daily and custom cake orders, featured items, realistic sample trust-signal stats — cakes delivered, years baking, average rating), Menu (browse cakes, pastries and baked goods, add items to cart), Cart / Order Now (review cart, choose delivery/pickup, enter custom-order notes if applicable, proceed to payment), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Bakery (tone-matched to Get4Domain's existing /industries/restaurant marketing copy, not copied verbatim), 8-12 realistic sample items with names/prices/descriptions/images genuinely fitting a bakery — for example, "Chocolate Truffle Cake (1kg)", "Red Velvet Cupcakes (Box of 6)", "Custom Birthday Cake" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

### Fine Dining

```
Design a modern, professional business website for Fine Dining — specifically for the Fine Dining segment within Restaurant & Cafe. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a sophisticated black-and-gold accent (#D4AF37 on #0A0A0A), an elegant serif for headings (Cormorant Garamond) with a minimal sans body (Jost), and a slow, full-bleed, reservation-first layout with dramatic imagery.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Menu, Cart, Order Now, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a fine-dining restaurant, value props like a chef-curated menu and an exceptional ambience, featured dishes, realistic sample trust-signal stats — years established, awards/recognitions, average rating), Menu (browse the curated tasting/à la carte menu, add items to cart), Cart / Order Now (review cart/reservation details, choose dine-in reservation or takeaway order, proceed to confirmation/payment), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Fine Dining restaurant (tone-matched to Get4Domain's existing /industries/restaurant marketing copy, not copied verbatim), 8-12 realistic sample menu items with names/prices/descriptions/images genuinely fitting a fine-dining establishment — for example, "Truffle Risotto", "Tandoori Lamb Chops", "Chef's Tasting Menu" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

---

## Retail & Shopping

Primary operation: **Order** (`Shop Now`, cart-based). Listing page: **Shop** (Products).

### Store (General)

```
Design a modern, professional business website for Store — specifically for the general Store segment within Retail & Shopping. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a confident indigo-and-white accent (#4338CA), a clean commerce-ready sans (Inter throughout), and a product-grid-forward layout with clear category navigation.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Shop, Cart, Shop Now, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a general store, value props like quality products and reliable delivery, featured products, realistic sample trust-signal stats — products sold, customers served, average rating), Shop (browse products by category, add to cart), Cart / Shop Now (review cart, enter delivery address, choose payment method, place order), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Store (tone-matched to Get4Domain's existing /industries/retail marketing copy, not copied verbatim), 8-12 realistic sample products with names/prices/descriptions/images genuinely fitting a general store — for example, "Basmati Rice 5kg", "Cotton Bedsheet Set", "Steel Water Bottle 1L" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

### Fashion & Clothing

```
Design a modern, professional business website for Fashion & Clothing — specifically for the Fashion & Clothing segment within Retail & Shopping. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a bold monochrome-with-accent look (black/white with a single #E11D48 accent), a high-fashion sans (Helvetica Now/Archivo for headings, Inter for body), and an editorial, lookbook-style grid layout.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Shop, Cart, Shop Now, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a fashion & clothing brand, value props like trend-forward designs and quality fabric, featured collections, realistic sample trust-signal stats — pieces sold, customers styled, average rating), Shop (browse products by category with size/colour variants, add to cart), Cart / Shop Now (review cart, enter delivery address, choose payment method, place order), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Fashion & Clothing store (tone-matched to Get4Domain's existing /industries/retail marketing copy, not copied verbatim), 8-12 realistic sample products with names/prices/descriptions/images/size-colour-variants genuinely fitting a fashion store — for example, "Cotton Kurta — Women's", "Slim Fit Denim Jeans", "Printed Casual Shirt" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

### Electronics & Mobiles

```
Design a modern, professional business website for Electronics & Mobiles — specifically for the Electronics & Mobiles segment within Retail & Shopping. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a tech-forward electric-blue and graphite accent (#2563EB on #111827), a clean technical sans (Roboto for headings and body), and a spec-forward, comparison-friendly product grid.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Shop, Cart, Shop Now, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to an electronics & mobiles store, value props like genuine warranty and competitive pricing, featured products, realistic sample trust-signal stats — units sold, brands stocked, average rating), Shop (browse products by category with spec highlights, add to cart), Cart / Shop Now (review cart, enter delivery address, choose payment method, place order), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Electronics & Mobiles store (tone-matched to Get4Domain's existing /industries/retail marketing copy, not copied verbatim), 8-12 realistic sample products with names/prices/descriptions/images genuinely fitting an electronics store — for example, "Smartphone — 128GB", "Wireless Earbuds", "Smart LED TV 43-inch" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

### Grocery & Supermarket

```
Design a modern, professional business website for Grocery & Supermarket — specifically for the Grocery & Supermarket segment within Retail & Shopping. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a fresh green-and-orange accent (#16A34A with #F97316 highlights on white), a friendly rounded sans (Nunito throughout), and a dense, category-driven grid layout optimised for fast repeat shopping.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Shop, Cart, Shop Now, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a grocery/supermarket store, value props like fresh daily stock and fast local delivery, featured products, realistic sample trust-signal stats — orders delivered, products stocked, average rating), Shop (browse products by category — grocery, fresh produce, daily essentials, add to cart), Cart / Shop Now (review cart, enter delivery address, choose delivery slot, proceed to payment), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Grocery & Supermarket store (tone-matched to Get4Domain's existing /industries/retail marketing copy, not copied verbatim), 8-12 realistic sample products with names/prices/descriptions/images genuinely fitting a grocery store — for example, "Toor Dal 1kg", "Fresh Tomatoes 1kg", "Sunflower Oil 1L" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

### Jewellery

```
Design a modern, professional business website for Jewellery — specifically for the Jewellery segment within Retail & Shopping. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a luxurious deep-maroon and 22k-gold accent (#7A1F3D with #D4AF37 highlights on ivory), an opulent serif for headings (Cormorant) with a refined sans body (Jost), and a slow, jewel-photography-forward layout with generous close-up imagery.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Shop, Cart, Shop Now, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a jewellery store, value props like certified purity and traditional craftsmanship, featured collections, realistic sample trust-signal stats — years in business, customers served, average rating), Shop (browse jewellery by category — gold, diamond, bridal collections, add to cart), Cart / Shop Now (review cart, enter delivery/pickup details, choose payment method, place order), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Jewellery store (tone-matched to Get4Domain's existing /industries/retail marketing copy, not copied verbatim), 8-12 realistic sample products with names/prices/descriptions/images genuinely fitting a jewellery store — for example, "22K Gold Necklace Set", "Diamond Stud Earrings", "Bridal Polki Set" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

### Footwear & Sportswear

```
Design a modern, professional business website for Footwear & Sportswear — specifically for the Footwear & Sportswear segment within Retail & Shopping. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: an energetic electric-blue and white accent (#2563EB), a bold athletic sans (Barlow Condensed for headings, Roboto for body), and a dynamic, action-photography grid layout.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Shop, Cart, Shop Now, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a footwear & sportswear store, value props like premium comfort and performance gear, featured products, realistic sample trust-signal stats — pairs sold, customers served, average rating), Shop (browse products by category with size/colour variants, add to cart), Cart / Shop Now (review cart, enter delivery address, choose payment method, place order), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Footwear & Sportswear store (tone-matched to Get4Domain's existing /industries/retail marketing copy, not copied verbatim), 8-12 realistic sample products with names/prices/descriptions/images/size-colour-variants genuinely fitting a footwear/sportswear store — for example, "Running Sneakers", "Formal Leather Shoes", "Sports Hoodie" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

---

## Agriculture

Primary operation: **Enquiry** (`Enquire / Order`). Listing page: **Produce**. No curated subcategory split — one prompt.

### Agriculture (General)

```
Design a modern, professional business website for Agriculture — specifically for the general Agriculture business. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: an earthy olive-and-wheat accent (#4D7C0F with #D4A853 highlights on cream), a grounded natural sans (Karla throughout), and a wholesome, farm-photography-forward layout.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Produce, Enquire / Order, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to an agriculture/produce business, value props like farm-fresh quality and bulk-order support, featured produce, realistic sample trust-signal stats — acres farmed, buyers served, years in operation), Produce (browse produce categories with per-unit pricing, add to cart), Enquire / Order (a hybrid form — quantity needed, delivery location, contact details, submit enquiry or place a bulk order), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Agriculture/produce business (tone-matched to Get4Domain's existing /industries/agriculture marketing copy, not copied verbatim), 8-12 realistic sample produce items with names/prices/descriptions/images genuinely fitting an agriculture business — for example, "Organic Wheat — per 50kg bag", "Fresh Onions — per kg (bulk)", "Basmati Rice — per 25kg bag" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

---

## Automobile Services

Primary operation: **Service Request** (`Book a Service`). Listing page: **Services**. No curated subcategory split — one prompt.

### Automobile Services (General)

```
Design a modern, professional business website for Automobile Services — specifically for the general Automobile Services business. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a garage-inspired charcoal-and-racing-red accent (#DC2626 on #18181B), a bold mechanical sans (Oswald for headings, Roboto for body), and a functional, service-checklist-style layout.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Services, Book a Service, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to an automobile service centre, value props like certified mechanics and genuine parts, featured services, realistic sample trust-signal stats — vehicles serviced, years in operation, average rating), Services (browse service packages — general service, repairs, detailing), Book a Service (choose service type, enter vehicle details, pick a date/time slot, enter contact details), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Automobile Services centre (tone-matched to Get4Domain's existing /industries/automobile marketing copy, not copied verbatim), 8-12 realistic sample services with names/prices/descriptions/images genuinely fitting an automobile service centre — for example, "General Car Service", "Wheel Alignment & Balancing", "Car Detailing & Polish" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

---

## Construction & Interior

Primary operation: **Enquiry** (`Request a Quote`). Listing page: **Services**. No curated subcategory split — one prompt.

### Construction & Interior (General)

```
Design a modern, professional business website for Construction & Interior — specifically for the general Construction & Interior business. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a solid concrete-grey and safety-amber accent (#F59E0B on #292524), a strong structural sans (Archivo for headings, Inter for body), and a project-portfolio-forward layout with before/after-style sections.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Services, Request a Quote, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a construction/interior business, value props like end-to-end project management and quality craftsmanship, featured services, realistic sample trust-signal stats — projects completed, years in operation, average rating), Services (browse service categories — construction, renovation, interior design), Request a Quote (a lead-capture form — project type, approximate area/budget, location, contact details), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Construction & Interior business (tone-matched to Get4Domain's existing /industries/construction marketing copy, not copied verbatim), 8-12 realistic sample services with names/prices/descriptions/images genuinely fitting a construction/interior business — for example, "Full Home Construction", "Modular Kitchen Design", "Home Renovation" — believable INR pricing/starting-from ranges.

Keep HTML structure clean and semantic for later backend integration.
```

---

## Technology & IT

Primary operation: **Enquiry** (`Book a Discovery Call`). Listing page: **Services**. No curated subcategory split — one prompt.

### Technology & IT (General)

```
Design a modern, professional business website for Technology & IT — specifically for the general Technology & IT business. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a sleek deep-violet and cyan accent (#7C3AED with #06B6D4 highlights on near-black #0B0B12), a modern technical sans (Space Grotesk for headings, Inter for body), and a product-led, dark-mode-first layout with subtle grid/glow motifs.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Services, Book a Discovery Call, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a technology/IT services business, value props like experienced engineers and end-to-end delivery, featured services, realistic sample trust-signal stats — projects delivered, clients served, years in operation), Services (browse service categories — web/app development, cloud, IT support), Book a Discovery Call (a lead-capture form — project type, budget range, timeline, contact details), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Technology & IT business (tone-matched to Get4Domain's existing /industries/technology marketing copy, not copied verbatim), 8-12 realistic sample services with names/prices/descriptions/images genuinely fitting an IT services business — for example, "Website Development", "Mobile App Development", "Cloud Migration & Support" — believable INR starting-from pricing.

Keep HTML structure clean and semantic for later backend integration.
```

---

## Logistics & Transport

Primary operation: **Enquiry** (`Get a Quote`). Listing page: **Services**. No curated subcategory split — one prompt.

### Logistics & Transport (General)

```
Design a modern, professional business website for Logistics & Transport — specifically for the general Logistics & Transport business. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a dependable navy-and-safety-yellow accent (#FACC15 on #1E3A5F), a strong utilitarian sans (Barlow throughout), and a route/tracking-inspired layout with clear map/network motifs.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Services, Get a Quote, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a logistics/transport business, value props like reliable on-time delivery and real-time tracking, featured services, realistic sample trust-signal stats — shipments delivered, cities covered, on-time rate), Services (browse service categories — freight, courier, warehousing), Get a Quote (a lead-capture form — shipment type, origin/destination, approximate weight/volume, contact details), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Logistics & Transport business (tone-matched to Get4Domain's existing /industries/logistics marketing copy, not copied verbatim), 8-12 realistic sample services with names/prices/descriptions/images genuinely fitting a logistics business — for example, "Intercity Freight Transport", "Same-Day Courier", "Warehousing & Fulfilment" — believable INR starting-from pricing.

Keep HTML structure clean and semantic for later backend integration.
```

---

## Real Estate

Primary operation: **Site Visit** (`Book Site Visit`). Listing page: **Properties**.

### Real Estate (General)

```
Design a modern, professional business website for Real Estate — specifically for the general Real Estate segment. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a premium slate-and-bronze accent (#B45309 on #1E293B), a confident modern serif for headings (Fraunces) with a clean sans body (Inter), and a spacious, property-photography-forward layout with strong listing cards.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Properties, Book Site Visit, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to a real estate business, value props like verified listings and end-to-end deal support, featured properties, realistic sample trust-signal stats — properties listed, deals closed, years in business), Properties (browse property listings with filters — type, budget, location), Book Site Visit (choose a property, pick a preferred date/time, enter contact details), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Real Estate business (tone-matched to Get4Domain's existing /industries/realestate marketing copy, not copied verbatim), 8-12 realistic sample property listings with names/prices/descriptions/images genuinely fitting a general real-estate business — for example, "2BHK Apartment — Prime Locality", "3BHK Independent Villa", "Commercial Office Space" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

### Residential

```
Design a modern, professional business website for Residential — specifically for the Residential segment within Real Estate. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a warm sandstone-and-sage accent (#A16207 with #65825A highlights on cream), an inviting modern serif for headings (Fraunces) with a clean sans body (Inter), and a homey, lifestyle-photography-forward layout.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Properties, Book Site Visit, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to residential real estate, value props like family-friendly communities and verified builders, featured properties, realistic sample trust-signal stats — homes sold, projects delivered, years in business), Properties (browse residential listings with filters — BHK, budget, locality), Book Site Visit (choose a property, pick a preferred date/time, enter contact details), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Residential real estate business (tone-matched to Get4Domain's existing /industries/realestate marketing copy, not copied verbatim), 8-12 realistic sample property listings with names/prices/descriptions/images genuinely fitting residential real estate — for example, "2BHK Apartment — Ready to Move", "3BHK Gated Community Flat", "Independent Villa with Garden" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

### Commercial

```
Design a modern, professional business website for Commercial — specifically for the Commercial segment within Real Estate. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a corporate steel-blue and charcoal accent (#1E40AF on #1F2937), a sharp modern sans (Archivo for headings, Inter for body), and a data-forward, spec-sheet-style layout (area, floor, footfall).

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Properties, Book Site Visit, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to commercial real estate, value props like prime business locations and flexible leasing, featured properties, realistic sample trust-signal stats — properties leased, sq.ft transacted, years in business), Properties (browse commercial listings with filters — type, area, location), Book Site Visit (choose a property, pick a preferred date/time, enter contact details), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Commercial real estate business (tone-matched to Get4Domain's existing /industries/realestate marketing copy, not copied verbatim), 8-12 realistic sample property listings with names/prices/descriptions/images genuinely fitting commercial real estate — for example, "Grade-A Office Space — 5,000 sqft", "Retail Shop — High Street", "Warehouse Space — Industrial Zone" — believable INR pricing.

Keep HTML structure clean and semantic for later backend integration.
```

### Rentals

```
Design a modern, professional business website for Rentals — specifically for the Rentals segment within Real Estate. This must NOT look like a generic AI-template site — give it a genuinely distinct visual identity: a fresh teal-and-white accent (#0D9488), a clean approachable sans (Inter throughout), and a fast-browse, filter-forward layout suited to quick rental search.

TECHNICAL REQUIREMENT: Build as Next.js (App Router), TypeScript, Tailwind CSS — a real production app, not static export. Fully mobile-responsive with a proper app-style BOTTOM NAVIGATION bar on mobile — 4-5 icons for the most important actions in this business type (Home, Properties, Book Site Visit, About, Contact). Configure as an installable PWA (manifest.json, app icons, theme-color).

PAGES: Home (hero banner relevant to rental real estate, value props like verified tenants/landlords and quick move-in, featured properties, realistic sample trust-signal stats — properties rented, tenants placed, years in business), Properties (browse rental listings with filters — BHK, budget, locality, furnishing), Book Site Visit (choose a property, pick a preferred date/time, enter contact details), About, Contact.

CONTENT: Write realistic sample content — a real-sounding Indian business name for this Rentals real estate business (tone-matched to Get4Domain's existing /industries/realestate marketing copy, not copied verbatim), 8-12 realistic sample property listings with names/prices/descriptions/images genuinely fitting rental real estate — for example, "1BHK Fully Furnished Flat — Rent", "2BHK Semi-Furnished Apartment — Rent", "PG Accommodation — Single Sharing" — believable INR monthly-rent pricing.

Keep HTML structure clean and semantic for later backend integration.
```
