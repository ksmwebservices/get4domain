PROMPT T5: Pro motion kit and industry layout variants (same Bolt themes project; paste after T4)

Using the Theme Kit from T0 and the nine Pro themes from T2, T3 and T4, add an animation kit and industry layout variants so Pro sites look different by industry and feel premium. Free layouts are NOT changed. Do not modify lint rules except where this prompt adds rules. Every theme must still pass lint for every category.

HARD RULES (these keep sites fast and indexable)
- Script-free. All motion is CSS only. Animate only transform and opacity (and clip-path or filter where cheap). No layout-shifting animation.
- The first screen (hero text and main image) is visible on load: never hide it behind a reveal, so LCP and crawlers are not hurt. Reveal effects start below the fold only.
- Honour prefers-reduced-motion: all motion off and content fully visible.
- Progressive enhancement: use @supports for scroll-driven animation (animation-timeline: view()) and cross-document view transitions; the fallback is the static, fully visible layout.
- Motion budget per page: at most 12 animated elements in view at once, total animation CSS under 6 KB, no autoplay video.
- Add these lint rules: hero not hidden at load, reduced-motion block present, no animation of width, height, top or left, motion CSS size under budget.

MOTION KIT (shared CSS file inside each Pro theme, token driven: --g4d-motion-speed, --g4d-motion-ease, --g4d-motion-distance)
1. Scroll reveal: fade and rise for cards and sections; staggered children using nth-child delays.
2. Hero effects: slow image zoom, gradient shimmer on the headline accent word, floating badge, animated underline on the call button.
3. Number counters (years, jobs, rating) using CSS @property counters.
4. Marquee strip for trust badges, brands or client logos (CSS keyframes, pauses on hover and for reduced motion).
5. Card hover: lift, image zoom, accent border sweep; focus states match.
6. Image treatments: soft parallax on banners (CSS only), reveal masks, before and after slider using CSS only (radio inputs).
7. Section dividers: wave, diagonal, curve and notch shapes as inline SVG or clip-path, chosen per variant.
8. Page transitions: @view-transition cross-document fade, with fallback.
9. Sticky mobile bar: slide-up call and WhatsApp bar (CSS only) and a floating action button with a gentle pulse that stops after a few cycles.
10. Menu: mobile menu slide with CSS :target or checkbox, animated hamburger.
Show every effect in the harness on a 'Motion lab' page with a reduced-motion toggle and a performance readout (animated element count, CSS size).

INDUSTRY LAYOUT VARIANTS
Each Pro theme gets a layoutVariant chosen by the category family, so the same theme looks and reads differently. Each variant defines: hero layout, header style, services layout, card shape, divider style, decorative set (original simple SVG shapes, no stock mascots), and default motion intensity.
Hero layouts available: split image and text, full-bleed image with overlay, diagonal cut, card stack, video-poster style still image, centered statement with floating badges.
Services layouts available: icon grid, image cards, tabbed list, price-table list, timeline, bento grid.
Variants by family:
- Home services (plumber, electrician, carpenter, painter, ac-appliance-repair, pest-control, home-cleaning, locksmith, packers-movers, mason-contractor, cctv-security-installer): bold split hero with emergency badge and big phone number, icon grid, price-table, strong accent, medium motion.
- Auto services (auto-mechanic, car-wash-detailing): dark full-bleed hero, bento services, before and after slider, speed-line dividers.
- Healthcare (doctor-clinic, dentist, physiotherapy, diagnostics-lab): calm centered hero, trust strip first, tabbed treatments, soft curves, low motion.
- Legal and finance (lawyer, ca-tax-consultant, insurance-advisor): structured split hero, practice-area list, serif headings, notched dividers, minimal motion.
- Education (coaching-centre, tutor, music-dance-school): colourful card stack hero, batch and fee tables, timeline, playful shapes, medium motion.
- Wellness and beauty (salon-spa, gym-yoga): full-bleed image hero, bento services and price menu, gallery masonry, wave dividers, rich motion.
- Creative and consulting (photographer, interior-designer-architect, event-planner, it-consultant): portfolio-first hero, masonry gallery, case-study timeline, diagonal dividers, rich motion.
- Hospitality and property (restaurant-cafe, hotel-homestay, travel-agency, real-estate-agent): full-bleed image hero with booking slot, image cards, menu or rooms or listings layout, curve dividers, rich motion.
- Fashion and lifestyle, Food and grocery, Electronics and home, Gifts and books (the 8 Ecommerce categories): product-first hero, category tiles, offer strip marquee, product cards with hover swap, bento collections, medium to rich motion.
Also provide a 'Variant picker' in the harness: choose theme, category, variant, motion intensity (Off, Low, Medium, Rich) and see it live on phone, tablet and desktop frames. Vendors can later change only motion intensity and accent colours; the variant is set by the category.

DASHBOARD LINK
In the vendor Website Manager (separate project, later) the Theme tab will show the variant name and a motion intensity control; expose these as theme settings in the contract: layoutVariant (read only), motionIntensity (Off, Low, Medium, Rich).

ACCEPTANCE
All 41 categories pass lint in all nine Pro themes with their variant. Motion lint rules pass. Lighthouse-style readout in the harness shows no layout shift from motion. Reduced-motion toggle shows the full static site. 360, 768 and 1280 px clean. Show the coverage page and the Motion lab. List files.
