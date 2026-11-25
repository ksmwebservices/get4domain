// Default content pack for an interior designer (g4d-pack-content/1). Generic design services, not real projects:
// the vendor replaces places, sizes and prices. Prices are indicative. Nothing here is a testimonial, an award or a licence number.
const v = (...x) => x;
const price = (amount, unit) => ({ amount, unit, currency: 'INR', indicative: true });
const loc = '[[area]], [[town]]';

export default {
  schema: 'g4d-pack-content/1',
  type: 'interior-designer',
  family: 'interior-design-home-decor',
  kitCategories: ['interior-designer-architect'],
  language: 'en',
  placeholders: { vendor_name: 'Your studio name', owner: 'Principal designer', town: 'Your town', area: 'Main locality', branches: 'Other towns you work in', phone: 'Studio phone number', reg_no: 'Membership or registration number, if you have one' },
  seo: {
    title: v('[[vendor_name]]: interior designers in [[town]]', 'Home and office interior design in [[town]] by [[vendor_name]]', '[[vendor_name]] | Modular kitchens, wardrobes and full-home interiors in [[area]], [[town]]'),
    description: v(
      '[[vendor_name]] designs homes, kitchens, offices and shops in [[town]] and [[area]]. See our design services, indicative prices and book a free consultation.',
      'Looking for an interior designer in [[town]]? [[vendor_name]] plans and builds living rooms, bedrooms, modular kitchens and commercial interiors.',
      'Interior design studio in [[area]], [[town]]: design, 3D views, execution and handover. Browse services and send an enquiry.'),
  },
  hero: {
    title: v('[[vendor_name]]: interior designers creating homes and workplaces in [[town]]', 'Beautiful, practical interiors in [[town]] by [[vendor_name]]', '[[vendor_name]]: interior design and execution in [[area]], [[town]]'),
    subtitle: v('From the first sketch to the last cushion: design, 3D views, execution and handover for homes, kitchens, offices and shops.', 'Tell us your space and your budget. We design it, show it in 3D and build it with one team.', 'See what we design, check what is included, and book a free consultation.'),
    bannerText: v('Interiors designed around the way you live', 'Design, build and handover in [[town]]', 'Spaces that feel like yours'),
    serviceLinks: ['living-room-design', 'modular-kitchen', 'bedroom-wardrobe', 'full-home-interiors', 'office-interiors'],
  },
  cta: { label: 'Book a free consultation', secondary: 'See our designs' },
  about: {
    title: 'About [[vendor_name]]',
    text: v(
      '[[vendor_name]] is an interior design studio in [[town]]. [[owner]] leads the design team. We plan living rooms, bedrooms, kitchens, offices and shops in [[area]] and nearby places, and our own crew builds what we design.\n\nEvery service page lists what is included, a typical timeline and an indicative price, so you know what to expect before the consultation.',
      '[[vendor_name]] designs and executes interiors across [[town]]. Under [[owner]], the studio takes a space from the first measurement to the final handover.\n\nBrowse the services, see what each package covers and send an enquiry for the one you need.',
      'We are [[vendor_name]], an interior studio in [[area]]. [[owner]] and the team listen first, draw second and build third.\n\nLook through the services, then book a free consultation to talk about your space.'),
  },
  groups: [
    { slug: 'home-interiors', name: 'Home interiors' },
    { slug: 'commercial-interiors', name: 'Offices and shops' },
    { slug: 'design-services', name: 'Design and renovation' },
  ],
  items: [
    {
      slug: 'living-room-design', name: 'Living room design', group: 'home-interiors', badge: 'Home',
      summary: v('Seating, TV unit, lighting and decor planned as one calm space.', 'A living room designed around how your family sits, talks and entertains.', 'Turn your living room in [[area]] into the heart of the home.'),
      description: v(
        'Living room design in [[area]], [[town]]. Replace this text with how the studio works: the layout, the furniture plan, the lighting, the false ceiling and the finishing touches.\n\nThe price is indicative per room and depends on the size and the materials you choose. A written quote follows the consultation.',
        'We plan the seating, storage, TV wall, lighting and colours so the room feels balanced. Describe your process and how you show the design before work starts.\n\nThe figure on this page is a guide only.',
        'A living room that suits your family. Use this page for the design style you offer, the materials and the time it takes.\n\nAsk [[vendor_name]] for a quote after a free consultation.'),
      priceFrom: price(150000, 'per room onwards'),
      highlights: ['Layout and furniture plan', 'Lighting and false ceiling design', 'TV unit and storage joinery', '3D views before work starts'],
      details: [{ label: 'Service', value: 'Living room interior design' }, { label: 'Location', value: loc }, { label: 'Size', value: 'Add the typical room size' }, { label: 'Configuration', value: 'Design, 3D views, joinery, finishing' }, { label: 'Timeline', value: 'Add the typical duration in weeks' }],
      faqs: [
        { q: 'Is the price on this page final?', a: v('No. It is an indicative starting price. The quote depends on the size, materials and finish, and is given in writing.', 'It is a guide for comparing studios. You receive a written quote after we see the space.', 'The final figure follows the consultation and the design you approve.') },
        { q: 'Can I see the design before work starts?', a: v('Yes. We share 3D views and a material board for your approval.', 'You approve the layout, 3D views and materials before any work begins.', 'Nothing is built until you have seen and approved the design.') },
        { q: 'Can I keep some of my existing furniture?', a: v('Yes. Tell us what you want to keep and we design around it.', 'We often reuse good pieces; share photos in your enquiry.', 'Of course; we plan the new design with your existing pieces in mind.') },
      ],
      related: ['bedroom-wardrobe', 'full-home-interiors'],
    },
    {
      slug: 'modular-kitchen', name: 'Modular kitchen', group: 'home-interiors', badge: 'Home',
      summary: v('Cabinets, counters and storage planned around how you cook.', 'A modular kitchen with smart storage and a clean, easy-to-wipe finish.', 'Design a kitchen in [[area]] that works as well as it looks.'),
      description: v(
        'Modular kitchen design in [[area]], [[town]]. Describe the layouts you offer (straight, L, U, parallel, island), the materials and the hardware.\n\nThe price is indicative per running foot and depends on the materials and fittings.',
        'We plan the work triangle, storage and lighting for your kitchen. Explain the finishes, the hardware brands and the warranty you give.\n\nAsk [[vendor_name]] for a written quote after measuring the space.',
        'A kitchen built to last. Use this page for the layouts, the finishes and the timeline, and add photographs.\n\nThe figure shown is a guide only.'),
      priceFrom: price(9000, 'per running foot onwards'),
      highlights: ['Layout planned around how you cook', 'Soft-close hardware and tall units', 'Moisture-resistant carcass and easy-clean finish', 'Counter, backsplash and lighting coordinated'],
      details: [{ label: 'Service', value: 'Modular kitchen design and installation' }, { label: 'Location', value: loc }, { label: 'Size', value: 'Priced per running foot' }, { label: 'Configuration', value: 'Straight, L, U, parallel or island' }, { label: 'Timeline', value: 'Add the typical duration in weeks' }],
      faqs: [
        { q: 'Which materials do you use?', a: v('We offer a few grades and explain the difference so you can choose within your budget.', 'Options range from basic to premium finishes; we quote each so you can compare.', 'Tell us your budget and we will suggest materials and quote for your choice.') },
        { q: 'How long does a kitchen take?', a: v('After measurements and approval, fabrication and installation usually take a few weeks. Your quote gives the schedule.', 'The job page shows a typical duration; the quote gives the exact schedule.', 'We agree a schedule in writing before work starts.') },
        { q: 'Is there a warranty?', a: v('Warranty terms for the carcass and hardware are written in the quote. Please read them before you confirm.', 'Ask us; the warranty is stated in the agreement.', 'We explain what is covered and for how long in the quote.') },
      ],
      related: ['full-home-interiors', 'living-room-design'],
    },
    {
      slug: 'bedroom-wardrobe', name: 'Bedroom and wardrobe design', group: 'home-interiors', badge: 'Home',
      summary: v('Restful bedrooms with wardrobes that fit your clothes and your wall.', 'Built-in wardrobes, beds and study corners designed for the space you have.', 'Make a bedroom in [[area]] calm, tidy and personal.'),
      description: v(
        'Bedroom and wardrobe design in [[area]], [[town]]. Describe the wardrobe types (sliding, hinged, walk-in), the bed and headboard designs and the lighting.\n\nThe price is indicative per bedroom and depends on the size and finish.',
        'We design the bed wall, the wardrobe and the lighting together. Explain how you plan the storage inside the wardrobe.\n\nAsk [[vendor_name]] for a quote after a consultation.',
        'A bedroom designed for rest. Use this page for the styles you offer and add photographs.\n\nThe figure is a guide.'),
      priceFrom: price(120000, 'per bedroom onwards'),
      highlights: ['Wardrobe planned for your clothes and shoes', 'Bed wall, headboard and bedside lighting', 'Sliding or hinged shutters', 'Study or dressing corner if space allows'],
      details: [{ label: 'Service', value: 'Bedroom and wardrobe design' }, { label: 'Location', value: loc }, { label: 'Size', value: 'Add the typical room size' }, { label: 'Configuration', value: 'Wardrobe, bed wall, lighting' }, { label: 'Timeline', value: 'Add the typical duration in weeks' }],
      faqs: [
        { q: 'Can the wardrobe go up to the ceiling?', a: v('Yes, with a loft above. We plan the height to suit your room.', 'Floor-to-ceiling wardrobes are common; we design the loft storage too.', 'Yes; we plan it with the false ceiling and the lighting.') },
        { q: 'Do you design for small rooms?', a: v('Yes. Small rooms need careful planning, and we plan every inch.', 'We often design compact bedrooms with smart storage.', 'Tell us the size; we will suggest a layout that fits.') },
      ],
      related: ['living-room-design', 'full-home-interiors'],
    },
    {
      slug: 'full-home-interiors', name: 'Full-home interiors', group: 'home-interiors', badge: 'Home',
      summary: v('One studio for the whole home: design, joinery, electrical, painting and handover.', 'Complete interiors for a flat or house in [[town]], delivered by a single team.', 'Move into a finished home in [[area]] without chasing five contractors.'),
      description: v(
        'Full-home interiors in [[area]], [[town]]. Describe the scope: design, joinery, false ceilings, electrical, painting, flooring and furnishing.\n\nThe price is indicative per square foot and depends on the specification.',
        'We take over the whole job: from design to handover. Explain how you coordinate the trades and keep the site on schedule.\n\nAsk [[vendor_name]] for a written quote after a site visit.',
        'A complete home from one team. Use this page for the packages you offer and add before-and-after photographs.\n\nThe figure is a guide only.'),
      priceFrom: price(1400, 'per sq ft onwards'),
      highlights: ['One team from design to handover', 'Fixed scope and written quote', 'Weekly progress updates and photos', 'Final check and snag list before you move in'],
      details: [{ label: 'Service', value: 'Turnkey home interiors' }, { label: 'Location', value: loc }, { label: 'Size', value: 'Priced per square foot' }, { label: 'Configuration', value: 'Design, joinery, electrical, painting, flooring' }, { label: 'Timeline', value: 'Add the typical duration in months' }],
      faqs: [
        { q: 'What does turnkey mean?', a: v('It means we handle the whole job, so you deal with one team.', 'One studio designs, builds and hands over; you do not manage separate contractors.', 'We coordinate every trade and give you a finished home.') },
        { q: 'How do I pay?', a: v('Payments are linked to stages and written in the agreement.', 'We agree a stage-wise schedule before work starts.', 'You pay as the work progresses; the schedule is in your quote.') },
      ],
      related: ['modular-kitchen', 'renovation-turnkey'],
    },
    {
      slug: 'office-interiors', name: 'Office interiors', group: 'commercial-interiors', badge: 'Commercial',
      summary: v('Workspaces that look professional and fit your team.', 'Office interiors in [[town]]: cabins, workstations, meeting rooms and reception.', 'Design an office in [[area]] your team enjoys working in.'),
      description: v(
        'Office interior design in [[area]], [[town]]. Describe the types of offices you do, the layouts, the furniture and the lighting.\n\nThe price is indicative per square foot and depends on the specification.',
        'We plan the workstations, cabins, meeting rooms and reception. Explain how you keep the schedule so the office opens on time.\n\nAsk [[vendor_name]] for a quote after a site visit.',
        'A workplace that supports your business. Use this page for the services and add photographs of finished offices.\n\nThe figure here is a guide.'),
      priceFrom: price(1200, 'per sq ft onwards'),
      highlights: ['Layout planned for your team size', 'Workstations, cabins and meeting rooms', 'Lighting, flooring and false ceiling', 'Schedule planned around your opening date'],
      details: [{ label: 'Service', value: 'Office interior design and fit-out' }, { label: 'Location', value: loc }, { label: 'Size', value: 'Add the typical area' }, { label: 'Configuration', value: 'Workstations, cabins, reception' }, { label: 'Timeline', value: 'Add the typical duration in weeks' }],
      faqs: [
        { q: 'Can you work to a deadline?', a: v('Yes. Tell us the date and we plan the work backwards from it.', 'We plan the schedule around your opening date.', 'Share your deadline in the enquiry; we confirm it in the quote.') },
        { q: 'Do you supply furniture?', a: v('Yes, if you want. We can design and supply workstations and seating.', 'Furniture is optional; we quote with and without it.', 'Ask us; we can include furniture in the package.') },
      ],
      related: ['shop-showroom-interiors', 'full-home-interiors'],
    },
    {
      slug: 'shop-showroom-interiors', name: 'Shop and showroom interiors', group: 'commercial-interiors', badge: 'Commercial',
      summary: v('Shopfronts and displays that bring customers in and show your products well.', 'Retail interiors in [[town]], designed to sell.', 'Fit out a shop in [[area]] with display, lighting and branding that work.'),
      description: v(
        'Shop and showroom interiors in [[area]], [[town]]. Describe the shop types you do: clothing, jewellery, mobile, restaurants, salons.\n\nThe price is indicative per square foot and depends on the fit-out.',
        'We design the shopfront, display units, lighting and counters. Explain how you plan the customer flow.\n\nAsk [[vendor_name]] for a written quote after a site visit.',
        'A shop that sells. Use this page for the types of work you do and add photographs.\n\nThe figure is a guide only.'),
      priceFrom: price(1500, 'per sq ft onwards'),
      highlights: ['Shopfront and signage design', 'Display units and lighting that show your products', 'Counter and storage planned for daily use', 'Branding colours carried into the interior'],
      details: [{ label: 'Service', value: 'Retail interior design and fit-out' }, { label: 'Location', value: loc }, { label: 'Size', value: 'Add the typical area' }, { label: 'Configuration', value: 'Shopfront, display, counter, lighting' }, { label: 'Timeline', value: 'Add the typical duration in weeks' }],
      faqs: [
        { q: 'Can you match my brand colours?', a: v('Yes. Share your logo and colours and we carry them through the design.', 'We design to your brand; send us your guidelines.', 'Branding is part of the design; tell us what you have.') },
        { q: 'Can the shop stay open during work?', a: v('Usually not for a full fit-out; we plan the shortest possible closure.', 'It depends on the job; we plan to minimise the closed period.', 'We tell you after the site visit how long you need to close.') },
      ],
      related: ['office-interiors', 'renovation-turnkey'],
    },
    {
      slug: 'renovation-turnkey', name: 'Renovation and 3D design', group: 'design-services', badge: 'Design',
      summary: v('Redesign an existing space, or just buy the design and 3D views.', 'Renovate a home in [[town]], or take a design-only package with 3D views.', 'Refresh a room or a whole house in [[area]].'),
      description: v(
        'Renovation and design-only packages in [[area]], [[town]]. Describe what you offer: a design consultation, 3D views, working drawings or the full renovation.\n\nPrices are indicative and depend on the scope.',
        'Already have a contractor? Take a design-only package. Need everything? We renovate too. Explain both options.\n\nAsk [[vendor_name]] for a quote.',
        'A design package or a full renovation. Use this page for what each includes and add photographs.\n\nThe price here is a guide.'),
      priceFrom: price(25000, 'for a design consultation onwards'),
      highlights: ['Design-only and full-execution options', '3D views and working drawings', 'Material and colour boards', 'Site visits to check the work'],
      details: [{ label: 'Service', value: 'Design consultation and renovation' }, { label: 'Location', value: loc }, { label: 'Size', value: 'Depends on the space' }, { label: 'Configuration', value: 'Consultation, 3D views, drawings, execution' }, { label: 'Timeline', value: 'Add the typical duration in weeks' }],
      faqs: [
        { q: 'Can I buy only the design?', a: v('Yes. You can take the design and drawings and use your own contractor.', 'Design-only packages are available; we hand over drawings and 3D views.', 'Ask us; we price design separately from execution.') },
        { q: 'Do you renovate old buildings?', a: v('Yes. We visit first to check the condition and then quote.', 'We take renovation jobs after a site visit.', 'Tell us about the building; we will advise after seeing it.') },
      ],
      related: ['full-home-interiors', 'living-room-design'],
    },
  ],
  blocks: [
    { key: 'listings', title: 'Indicative prices', items: [
      { title: 'Living room design', detail: 'Per room', price: 'from ₹1.5 lakh (indicative)' },
      { title: 'Modular kitchen', detail: 'Per running foot', price: 'from ₹9,000 (indicative)' },
      { title: 'Full-home interiors', detail: 'Per square foot', price: 'from ₹1,400 (indicative)' },
      { title: 'Design consultation', detail: 'Design only', price: 'from ₹25,000 (indicative)' } ] },
    { key: 'areas', title: 'Where we work', items: [{ title: '[[area]]', detail: 'Main locality', price: '' }, { title: '[[town]]', detail: 'City and nearby areas', price: '' }, { title: '[[branches]]', detail: 'Other towns', price: '' }] },
    { key: 'process', title: 'How we work', items: [
      { title: '1. Consultation', detail: 'We listen, measure and note your budget.', price: '' },
      { title: '2. Design and 3D', detail: 'You see the layout, materials and 3D views.', price: '' },
      { title: '3. Build', detail: 'Our crew builds with weekly updates.', price: '' },
      { title: '4. Handover', detail: 'A final check and a snag list before you move in.', price: '' } ] },
  ],
  faqs: [
    { q: 'Is the first consultation free?', a: v('Yes. Call [[phone]] or send an enquiry and we will fix a time.', 'We offer a free first consultation in [[town]]. Contact [[vendor_name]] on [[phone]].', 'Please ask; the first meeting to understand your space is free.') },
    { q: 'Are the prices on this website final?', a: v('No. They are indicative. The final price is in the written quote.', 'They help you compare. Your exact job is priced after we see the space.', 'Treat them as a guide; the quote is what counts.') },
    { q: 'Do you build what you design?', a: v('Yes. Our own crew builds the interiors, so you deal with one team.', 'We design and execute; you can also take design only.', 'Both options are possible: design only, or design and build.') },
    { q: 'How long does a project take?', a: v('It depends on the size. The service page shows a typical duration and the quote gives the real one.', 'We agree a schedule in writing before work starts.', 'Small rooms take weeks; full homes take a few months.') },
    { q: 'Which areas do you work in?', a: v('We work in [[area]], [[town]] and nearby places. See the areas section.', 'Mainly [[area]] and across [[town]]. Other towns: [[branches]].', 'Our sites are in [[area]] and around [[town]].') },
    { q: 'Do you give a warranty?', a: v('Warranty terms are written in the quote for each job. Please read them before you confirm.', 'Ask us; any warranty is stated in writing, job by job.', 'We explain what we stand behind in the agreement.') },
  ],
  trust: ['Free first consultation', '3D views before any work starts', 'Written quote and stage-wise payments', 'One team from design to handover'],
  steps: [
    { title: 'Consultation', desc: 'We listen, measure and note your budget.' },
    { title: 'Design and 3D views', desc: 'You approve the layout, materials and 3D views.' },
    { title: 'Build', desc: 'Our crew builds with regular progress updates.' },
    { title: 'Handover', desc: 'A final check and snag list before you move in.' },
  ],
  team: [
    { name: '[[owner]]', role: 'Principal designer', note: 'Add a line about experience.' },
    { name: 'Name to be added', role: 'Designer', note: '' },
    { name: 'Name to be added', role: 'Site supervisor', note: '' },
  ],
  credentials: [
    { title: 'Registration or membership', detail: '[[reg_no]]' },
    { title: 'Studio', detail: '[[area]], [[town]]' },
    { title: 'Areas served', detail: '[[area]], [[town]] and [[branches]]' },
  ],
  areas: ['[[area]]', '[[town]]', '[[branches]]'],
  contact: { hours: 'Monday to Saturday, 10:00 am to 7:00 pm. Site visits by appointment.', areaServed: '[[area]], [[town]] and nearby places', branches: '[[branches]]' },
  terms: { items: 'Design services', itemOne: 'Service', groups: 'What we design' },
  listPageTitle: 'Our designs',
  notes: 'Replace the generic design services with the studio\'s own work: name, place, size, what was included, duration, photographs and an indicative price (or leave the price empty to show "price after consultation"). Add a registration or membership number only if the vendor has given one; never invent one.',
};
