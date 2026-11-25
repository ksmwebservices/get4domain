// Default content pack for a door-step carpenter (g4d-pack-content/1). Generic job types, not real jobs:
// the vendor replaces places, sizes and prices. Prices are indicative. Nothing here is a testimonial, an award or a licence number.
const v = (...x) => x;
const price = (amount, unit) => ({ amount, unit, currency: 'INR', indicative: true });
const loc = '[[area]], [[town]]';

export default {
  schema: 'g4d-pack-content/1',
  type: 'carpenter',
  family: 'home-services',
  kitCategories: ['carpenter'],
  language: 'en',
  placeholders: { vendor_name: 'Your name or workshop name', owner: 'Your name', town: 'Your town', area: 'Main area', branches: 'Other areas you visit', phone: 'Your mobile number' },
  seo: {
    title: v('[[vendor_name]]: carpenter in [[town]]', 'Furniture, wardrobes and door repairs in [[town]] by [[vendor_name]]', '[[vendor_name]] | Carpenter at your door in [[area]], [[town]]'),
    description: v(
      '[[vendor_name]] is a carpenter in [[town]] and [[area]]. Wardrobes, doors, windows, kitchen cabinets, furniture making and repairs. Call for a quick quote.',
      'Need a carpenter in [[town]]? [[vendor_name]] comes to your door for custom furniture, fitting and repairs. See the jobs and call for a quote.',
      'Door-step carpentry in [[area]], [[town]]: new furniture, fittings and repairs. Check indicative prices and call [[vendor_name]].'),
  },
  hero: {
    title: v('[[vendor_name]]: carpenter in [[town]] for furniture, doors and repairs', 'Door-step carpentry in [[town]] by [[vendor_name]]', '[[vendor_name]]: wardrobes, doors and furniture in [[area]], [[town]]'),
    subtitle: v('Call, tell me the job, and get a quick quote. I come to your door in [[area]] and nearby areas.', 'New furniture, fitting and repairs, done at your home. Call or WhatsApp a photo for a quick quote.', 'Good wood, clean work and a fair price. Call me for a visit.'),
    bannerText: v('Carpenter at your door in [[town]]', 'Call for a quick quote', 'Made to measure, fitted at home'),
    serviceLinks: ['custom-furniture', 'wardrobes-cupboards', 'doors-windows', 'kitchen-cabinets', 'furniture-repair-polish'],
  },
  cta: { label: 'Call for a quick quote', secondary: 'See the jobs' },
  about: {
    title: 'About [[vendor_name]]',
    text: v(
      '[[vendor_name]] is a carpenter working in [[town]]. [[owner]] makes, fits and repairs furniture, doors, windows and cabinets at your home in [[area]] and nearby areas.\n\nCall first. Describe the job or send a photo on WhatsApp, and you will get a quick quote before any visit.',
      'I am [[owner]], a carpenter in [[town]]. I take jobs in [[area]] and the areas around it: new furniture, fittings and repairs.\n\nThe job pages show what each job includes and an indicative price, so you know what to expect.',
      '[[vendor_name]] brings the workshop to your door in [[area]]. [[owner]] measures at your home, makes to size and fits it cleanly.\n\nCall or send a message to book a visit.'),
  },
  groups: [
    { slug: 'make-new', name: 'Make new' },
    { slug: 'fit-install', name: 'Fit and install' },
    { slug: 'repair-polish', name: 'Repair and polish' },
  ],
  items: [
    {
      slug: 'custom-furniture', name: 'Custom furniture: beds, tables, sofas', group: 'make-new', badge: 'New',
      summary: v('Beds, dining tables, study tables and sofa frames made to your size.', 'Furniture made to measure in [[town]], in the wood and finish you pick.', 'Get the exact piece you want, built for your room in [[area]].'),
      description: v(
        'Custom furniture in [[area]], [[town]]. Replace this text with the pieces you make, the woods you work with and how long a piece takes.\n\nThe price is indicative and depends on the size, the wood and the finish. A quick quote follows a call or a photo.',
        'I make beds, tables, shelves and frames to your measurements. Describe your process: measuring, design sketch, making and fitting.\n\nThe figure here is only a guide.',
        'Tell me the size and the wood you like and I will make it. Use this page for the pieces you build and add photographs.\n\nCall for a quote.'),
      priceFrom: price(12000, 'for a table or bed onwards'),
      highlights: ['Made to your measurements', 'Choice of woods and finishes', 'Design sketch before work starts', 'Delivery and fitting at your home'],
      details: [{ label: 'Job type', value: 'Custom furniture making' }, { label: 'Location', value: loc }, { label: 'Size', value: 'Made to your size' }, { label: 'Configuration', value: 'Teak, rosewood, plywood or as you choose' }, { label: 'Timeline', value: 'Add the usual time in days' }],
      faqs: [
        { q: 'Is the price final?', a: v('No. It is an indicative starting price. The quote depends on the size, wood and finish.', 'It is a guide. Call me with the size and the wood and I will quote.', 'The final price follows a call or a photo of what you want.') },
        { q: 'Can I give my own design?', a: v('Yes. Send a photo or a sketch and I will make it.', 'Bring a picture; I will tell you what is possible and the price.', 'Of course. Share a photo on WhatsApp.') },
        { q: 'Do you deliver and fit?', a: v('Yes, at your home in [[area]] and nearby areas.', 'Delivery and fitting are included within the areas I serve.', 'I deliver and fit it; ask about distant areas.') },
      ],
      related: ['wardrobes-cupboards', 'kitchen-cabinets'],
    },
    {
      slug: 'wardrobes-cupboards', name: 'Wardrobes and cupboards', group: 'make-new', badge: 'New',
      summary: v('Built-in and free-standing wardrobes, with shelves and drawers planned for you.', 'Wardrobes made to fit your wall in [[town]].', 'Clean, strong cupboards for your bedroom in [[area]].'),
      description: v(
        'Wardrobes and cupboards in [[area]], [[town]]. Describe the types you make: sliding, hinged, loft, shoe racks and the materials.\n\nThe price is indicative per square foot and depends on the material and fittings.',
        'I measure your wall and plan shelves, hanging space and drawers. Explain the boards and the hardware you use.\n\nCall for a quick quote.',
        'A wardrobe made to fit your room. Use this page for the options and add photographs.\n\nThe figure is a guide.'),
      priceFrom: price(1100, 'per sq ft onwards'),
      highlights: ['Measured at your wall', 'Shelves, hanging rail and drawers planned', 'Sliding or hinged shutters', 'Laminate or polish finish'],
      details: [{ label: 'Job type', value: 'Wardrobe and cupboard making' }, { label: 'Location', value: loc }, { label: 'Size', value: 'Priced per square foot' }, { label: 'Configuration', value: 'Plywood, laminate, hinges or sliders' }, { label: 'Timeline', value: 'Add the usual time in days' }],
      faqs: [
        { q: 'Which board do you use?', a: v('I offer a few grades and explain the difference so you can choose for your budget.', 'Options range from basic to premium boards; I quote each.', 'Tell me your budget and I will suggest a board.') },
        { q: 'Can you make a loft?', a: v('Yes, up to the ceiling if the wall allows.', 'A loft above the wardrobe is common; I include it if you want.', 'Yes; I plan the height when I measure.') },
      ],
      related: ['custom-furniture', 'kitchen-cabinets'],
    },
    {
      slug: 'kitchen-cabinets', name: 'Kitchen cabinets', group: 'make-new', badge: 'New',
      summary: v('Under-counter and wall cabinets with proper drawers and shelves.', 'Kitchen cabinets built on site in [[town]].', 'Give your kitchen in [[area]] storage that works.'),
      description: v(
        'Kitchen cabinets in [[area]], [[town]]. Describe the layouts you build, the boards used for damp areas and the hardware.\n\nThe price is indicative per running foot.',
        'I build kitchen cabinets on site to fit your counter. Explain how you handle water-prone areas.\n\nCall for a quick quote.',
        'Cabinets that fit your kitchen exactly. Use this page for the options and add photographs.\n\nThe figure is a guide.'),
      priceFrom: price(3500, 'per running foot onwards'),
      highlights: ['Built on site to fit your counter', 'Moisture-resistant boards for sink areas', 'Drawers, shelves and corner units', 'Soft-close hardware on request'],
      details: [{ label: 'Job type', value: 'Kitchen cabinets' }, { label: 'Location', value: loc }, { label: 'Size', value: 'Priced per running foot' }, { label: 'Configuration', value: 'Base and wall cabinets, drawers' }, { label: 'Timeline', value: 'Add the usual time in days' }],
      faqs: [
        { q: 'Do you do the counter and tiles?', a: v('No, those are separate trades. I can work with your mason or tile fitter.', 'I fit the cabinets after the counter is ready; I can suggest people for the rest.', 'Cabinets only; I coordinate with the other trades.') },
        { q: 'Can you replace only the doors?', a: v('Yes. Replacing shutters is a quick, cheaper job.', 'Door replacement is possible if the boxes are sound.', 'Tell me what you have; I will advise after a look.') },
      ],
      related: ['wardrobes-cupboards', 'custom-furniture'],
    },
    {
      slug: 'doors-windows', name: 'Doors, windows and frames', group: 'fit-install', badge: 'Fitting',
      summary: v('New door and window frames, shutters and locks fitted straight and tight.', 'Doors and windows made and fitted in [[town]].', 'Replace a rotten frame or fit a new door in [[area]].'),
      description: v(
        'Doors, windows and frames in [[area]], [[town]]. Describe the woods you use, the door types and the fittings.\n\nThe price is indicative per door or window and depends on the wood and size.',
        'I make and fit frames and shutters and fix doors that stick or sag. Explain how you measure and fit.\n\nCall for a quick quote.',
        'A door that closes properly. Use this page for what you fit and add photographs.\n\nThe figure is a guide.'),
      priceFrom: price(6500, 'per door onwards'),
      highlights: ['Frame and shutter made to size', 'Fitted straight with proper hinges', 'Locks, latches and handles fitted', 'Old frame removal if needed'],
      details: [{ label: 'Job type', value: 'Door and window making and fitting' }, { label: 'Location', value: loc }, { label: 'Size', value: 'Made to the opening' }, { label: 'Configuration', value: 'Teak, country wood or plywood flush door' }, { label: 'Timeline', value: 'Add the usual time in days' }],
      faqs: [
        { q: 'Can you fix a door that will not close?', a: v('Usually yes, on the same visit. Call me and describe the problem.', 'Sticking or sagging doors are quick jobs; send a photo.', 'Yes. Often it needs only planing or new hinges.') },
        { q: 'Do you supply the wood?', a: v('Yes. I quote with the wood, or labour only if you have your own.', 'Both ways are possible; tell me which you prefer.', 'I can supply or you can; I quote for each.') },
      ],
      related: ['furniture-repair-polish', 'home-repairs-visit'],
    },
    {
      slug: 'wooden-flooring-panelling', name: 'Wooden flooring and wall panelling', group: 'fit-install', badge: 'Fitting',
      summary: v('Wooden or laminate flooring, wall panels and partitions, neatly fitted.', 'Panels and flooring fitted at your home in [[town]].', 'Give a room in [[area]] a warm wooden finish.'),
      description: v(
        'Wooden flooring and wall panelling in [[area]], [[town]]. Describe the flooring types you fit, the panel styles and the room preparation.\n\nThe price is indicative per square foot.',
        'I fit flooring, wall panels and light partitions. Explain how you prepare the surface and finish the edges.\n\nCall for a quick quote.',
        'Warm wood for your walls and floors. Use this page for the options and add photographs.\n\nThe figure is a guide.'),
      priceFrom: price(180, 'per sq ft onwards (labour)'),
      highlights: ['Surface checked and levelled first', 'Neat joints and skirting', 'Panels and partitions to your design', 'Clean-up after the job'],
      details: [{ label: 'Job type', value: 'Flooring and panelling' }, { label: 'Location', value: loc }, { label: 'Size', value: 'Priced per square foot' }, { label: 'Configuration', value: 'Wood, laminate or plywood panels' }, { label: 'Timeline', value: 'Add the usual time in days' }],
      faqs: [
        { q: 'Is the material included?', a: v('The price shown is mainly for labour. Material is quoted separately, or I can supply it.', 'Material depends on the type you choose; I quote both.', 'Tell me the material; I will give one clear figure.') },
        { q: 'Can you fit it over old flooring?', a: v('Sometimes. I check the surface on a visit.', 'It depends on the floor; I will tell you after a look.', 'Send a photo; I will say whether it can go over.') },
      ],
      related: ['doors-windows', 'custom-furniture'],
    },
    {
      slug: 'furniture-repair-polish', name: 'Furniture repair and polish', group: 'repair-polish', badge: 'Repair',
      summary: v('Loose joints, broken legs, torn rexine and tired polish, fixed at home.', 'Furniture repair in [[town]], often on the same visit.', 'Give your old furniture in [[area]] a new life.'),
      description: v(
        'Furniture repair and polish in [[area]], [[town]]. Describe the repairs you do: chairs, beds, sofas, tables, almirahs and polish.\n\nThe price is indicative and depends on the damage.',
        'I repair and polish furniture at your home. Explain the common problems you fix and how you match the colour.\n\nCall for a quick quote.',
        'Do not throw it out. Use this page for the repairs you offer and add before-and-after photographs.\n\nThe figure is a guide.'),
      priceFrom: price(500, 'per repair onwards'),
      highlights: ['Loose joints tightened and glued', 'Broken legs and frames repaired', 'Polish matched to the old colour', 'Most small jobs done on the same visit'],
      details: [{ label: 'Job type', value: 'Furniture repair and polish' }, { label: 'Location', value: loc }, { label: 'Size', value: 'Any piece' }, { label: 'Configuration', value: 'Joints, frames, polish, upholstery' }, { label: 'Timeline', value: 'Same day for small jobs' }],
      faqs: [
        { q: 'Can you repair a sofa?', a: v('Frames and joints, yes. Upholstery is quoted separately.', 'I repair frames and can arrange new covers.', 'Send a photo and I will tell you what is possible.') },
        { q: 'Will the polish match?', a: v('I match it as closely as I can; a small difference can remain on old wood.', 'Matching is usually close; I show you a sample first.', 'I test a patch before polishing the whole piece.') },
      ],
      related: ['home-repairs-visit', 'doors-windows'],
    },
    {
      slug: 'home-repairs-visit', name: 'Small repairs and home visit', group: 'repair-polish', badge: 'Repair',
      summary: v('Hinges, handles, shelves, curtain rods and other small jobs in one visit.', 'A carpenter at your door in [[town]] for the small jobs.', 'Book one visit for all the little jobs around your home in [[area]].'),
      description: v(
        'Small carpentry repairs in [[area]], [[town]]. List the small jobs you do: hinges, handles, shelves, curtain rods, cot assembly and similar.\n\nThe visit charge is indicative and covers the first hour.',
        'Collect your small jobs and I do them in one visit. Explain how you charge for time and materials.\n\nCall to book.',
        'No job is too small. Use this page for the visit charge and what it covers.\n\nThe figure is a guide.'),
      priceFrom: price(400, 'per visit onwards'),
      highlights: ['Several small jobs in one visit', 'Tools and common fittings carried along', 'Fair charge for time and material', 'Quick booking by phone'],
      details: [{ label: 'Job type', value: 'Small repairs and assembly' }, { label: 'Location', value: loc }, { label: 'Size', value: 'Any' }, { label: 'Configuration', value: 'Hinges, handles, shelves, assembly' }, { label: 'Timeline', value: 'Usually within a day or two' }],
      faqs: [
        { q: 'How soon can you come?', a: v('Usually within a day or two. Call [[phone]] to fix a time.', 'Call [[phone]]; I will tell you the earliest slot.', 'Often the same or next day, depending on the area.') },
        { q: 'Do you charge for the visit?', a: v('A small visit charge applies; it is adjusted if you give me the job.', 'The charge is told on the phone before I come.', 'Ask when you call; I tell you the charge up front.') },
      ],
      related: ['furniture-repair-polish', 'doors-windows'],
    },
  ],
  blocks: [
    { key: 'listings', title: 'Indicative prices', items: [
      { title: 'Wardrobes and cupboards', detail: 'Per square foot', price: 'from ₹1,100 (indicative)' },
      { title: 'Kitchen cabinets', detail: 'Per running foot', price: 'from ₹3,500 (indicative)' },
      { title: 'Doors', detail: 'Per door', price: 'from ₹6,500 (indicative)' },
      { title: 'Small repairs', detail: 'Per visit', price: 'from ₹400 (indicative)' } ] },
    { key: 'areas', title: 'Areas I serve', items: [{ title: '[[area]]', detail: 'Main area', price: '' }, { title: '[[town]]', detail: 'Town and nearby areas', price: '' }, { title: '[[branches]]', detail: 'Other areas I visit', price: '' }] },
    { key: 'process', title: 'How a job works', items: [
      { title: '1. Call or message', detail: 'Tell me the job or send a photo.', price: '' },
      { title: '2. Quick quote', detail: 'You get a price before I come.', price: '' },
      { title: '3. Visit and measure', detail: 'I come to your door and measure.', price: '' },
      { title: '4. Make, fit, clean up', detail: 'The work is done and the place left tidy.', price: '' } ] },
  ],
  faqs: [
    { q: 'How do I get a quick quote?', a: v('Call [[phone]] or send a photo and the size on WhatsApp. I reply with a price.', 'Describe the job on the phone. For most jobs I can give a rough price straight away.', 'Message a photo; I will quote and, if you agree, visit to confirm.') },
    { q: 'Are the prices on this website final?', a: v('No. They are indicative. The final price is told to you before the work starts.', 'They help you compare. Your exact job is priced after I know the details.', 'Treat them as a guide; the quote is what counts.') },
    { q: 'Which areas do you visit?', a: v('I visit [[area]], [[town]] and nearby places. See the areas section.', 'Mainly [[area]] and across [[town]]. Other areas: [[branches]].', 'Jobs in [[area]] and around [[town]]; ask about other places.') },
    { q: 'Do you supply the wood and fittings?', a: v('Yes, or you can supply them. I quote for each.', 'Both ways work; tell me which you prefer.', 'I can bring everything, or work with what you have.') },
    { q: 'How long does a job take?', a: v('Small jobs take an hour or two. Furniture takes days. I tell you before I start.', 'The job page shows a typical time; I confirm it in the quote.', 'I give you a time with the price, so you can plan.') },
    { q: 'How do I pay?', a: v('For bigger jobs an advance buys the wood and the balance is paid on completion.', 'Small jobs are paid when done. Larger jobs have an advance, agreed beforehand.', 'I tell you the payment plan with the quote.') },
  ],
  trust: ['Call first, quick quote', 'I come to your door', 'Made to your measurements', 'Tidy work and clean-up'],
  steps: [
    { title: 'Call or message', desc: 'Tell me the job or send a photo.' },
    { title: 'Quick quote', desc: 'You get a price before I come.' },
    { title: 'Visit and measure', desc: 'I come to your door and measure.' },
    { title: 'Make, fit, clean up', desc: 'The work is done and the place left tidy.' },
  ],
  team: [],
  credentials: [],
  areas: ['[[area]]', '[[town]]', '[[branches]]'],
  contact: { hours: 'Monday to Saturday, 8:00 am to 7:00 pm. Call first for a visit.', areaServed: '[[area]], [[town]] and nearby areas', branches: '[[branches]]' },
  terms: { items: 'Our jobs', itemOne: 'Job', groups: 'What we do' },
  listPageTitle: 'Our work',
  notes: 'Replace the generic jobs with the carpenter\'s own: the pieces and fittings they make, sizes, woods, time taken, photographs and an indicative price (or leave it empty to show "price after a quick look"). This is a door-step individual: keep the phone number prominent and list the areas they actually visit.',
};
