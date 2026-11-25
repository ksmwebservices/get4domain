// Default content pack for a builder or project developer (g4d-pack-content/1). Generic project types, not real projects:
// the vendor replaces names, places, prices and images. Prices are indicative. Nothing here is a testimonial, an award or a licence number.
const v = (...x) => x;
const price = (amount, unit) => ({ amount, unit, currency: 'INR', indicative: true });

const loc = '[[area]], [[town]]';

export default {
  schema: 'g4d-pack-content/1',
  type: 'builder-developer',
  family: 'real-estate-property',
  kitCategories: ['real-estate-agent'],
  language: 'en',
  placeholders: { vendor_name: 'Your company name', owner: 'Owner or managing partner', town: 'Your town', area: 'Main locality', branches: 'Other offices or sites', phone: 'Sales phone number', rera_no: 'RERA registration number of each project', approvals: 'Approving authority and approval numbers' },
  seo: {
    title: v('[[vendor_name]]: builders and developers in [[town]]', 'Apartments, villas and plots in [[town]] by [[vendor_name]]', '[[vendor_name]] | Ongoing and upcoming projects in [[town]]'),
    description: v(
      '[[vendor_name]] builds apartments, villas and plots in [[town]] and [[area]]. See ongoing, upcoming and completed projects with prices and a site visit option.',
      'Looking for a home or plot in [[town]]? [[vendor_name]] lists every project with its status, sizes, indicative price and how to book a site visit.',
      'Projects by [[vendor_name]] in [[area]], [[town]]: apartments, villas, plots and commercial space. Compare projects and send an enquiry.'),
  },
  hero: {
    title: v('[[vendor_name]]: builders and developers building homes in [[town]]', 'Apartments, villas and plots in [[town]] by [[vendor_name]]', '[[vendor_name]] builds quality homes in [[area]], [[town]]'),
    subtitle: v('Ongoing, upcoming and completed projects, with clear sizes, indicative prices and site visits on request.', 'See every project in one place, compare sizes and prices, and book a site visit at a time that suits you.', 'Choose a project, check the details, and talk to our sales team before you decide.'),
    bannerText: v('Homes built with care in [[town]]', 'Your next address in [[area]]', 'Plan, visit and book with confidence'),
    serviceLinks: ['apartments-ongoing', 'villas-ongoing', 'plots-ongoing', 'apartments-upcoming', 'commercial-upcoming'],
  },
  cta: { label: 'Book a site visit', secondary: 'See our projects' },
  about: {
    title: 'About [[vendor_name]]',
    text: v(
      '[[vendor_name]] is a building and development company based in [[town]]. [[owner]] leads the team. We plan, build and hand over apartments, villas, plots and commercial space in [[area]] and nearby areas.\n\nEvery project page shows its status, sizes, planned possession and indicative price, so you can compare before you visit.',
      '[[vendor_name]] develops residential and commercial projects in [[town]]. Under [[owner]], our team looks after planning, construction and handover, and our sales desk answers your questions along the way.\n\nUse the project pages to see what is ongoing, what is launching soon and what has been completed.',
      'We are [[vendor_name]], developers working in [[area]] and across [[town]]. [[owner]] and the team take each project from land to handover.\n\nBrowse the projects, read the details, and send an enquiry for the one that fits your plan and budget.'),
  },
  groups: [
    { slug: 'ongoing-projects', name: 'Ongoing projects' },
    { slug: 'upcoming-projects', name: 'Upcoming projects' },
    { slug: 'completed-projects', name: 'Completed projects' },
  ],
  items: [
    {
      slug: 'apartments-ongoing', name: 'Apartment project (ongoing)', group: 'ongoing-projects', badge: 'Ongoing',
      summary: v('Apartments under construction in [[area]], with the work progress shown as it advances.', 'A residential block being built in [[area]], [[town]], with units you can book now.', 'Homes in a new apartment block in [[area]]: choose a floor and book while units are open.'),
      description: v(
        'This apartment project in [[area]], [[town]] is under construction. Replace this text with the project story: the land, the number of blocks and floors, the unit mix and what makes the location convenient.\n\nThe price shown is indicative. Ask the sales team for the current rate, floor-wise availability and the payment schedule that will appear in your agreement.',
        'An apartment community being built in [[area]]. Describe the blocks, floors, parking, open space and the unit sizes here, and say how far work has reached.\n\nPrices on this page are indicative starting prices. Final price depends on floor, facing and the date of booking, and is confirmed in writing by [[vendor_name]].',
        'Apartments rising in [[area]], close to everyday needs. Use this space to explain the layout, the amenities planned for residents and the construction approach.\n\nThe starting price is a guide only. Send an enquiry or visit the site to get the latest price list from [[vendor_name]].'),
      priceFrom: price(3500000, 'onwards (2 BHK)'),
      highlights: ['Open and covered parking', 'Lift access to every floor', 'Rainwater harvesting and sewage treatment as per approval', 'Children play area and landscaped common space'],
      details: [{ label: 'Project type', value: 'Residential apartments' }, { label: 'Location', value: loc }, { label: 'Configurations', value: '2 BHK and 3 BHK' }, { label: 'Sizes', value: 'Add the carpet and built-up areas' }, { label: 'Possession', value: 'Add the planned possession month and year' }],
      faqs: [
        { q: 'Is the starting price final?', a: v('No. It is an indicative starting price. The final price depends on the floor, facing and booking date, and is confirmed in writing.', 'The price on this page is a guide for comparing projects. Ask the sales team for the current price list before you decide.', 'It is a starting figure, not a quote. [[vendor_name]] will share the exact price for the unit you choose.') },
        { q: 'Can I visit the site before booking?', a: v('Yes. Send an enquiry or call [[phone]] and we will fix a site visit at a time that suits you.', 'Site visits are welcome by appointment. Call [[phone]] or use the enquiry form to choose a time.', 'Please visit before you book. Contact the sales desk on [[phone]] to arrange a walk through the site.') },
        { q: 'Where can I check the project registration?', a: v('The RERA registration number of the project is shown on this page. You can search it on the state RERA website.', 'Ask for the project RERA number and approvals; they are listed under key facts and can be checked on the official RERA website.', 'Registration and approval details appear on this page, and you can verify them on the state RERA portal before you book.') },
      ],
      related: ['villas-ongoing', 'apartments-upcoming'],
    },
    {
      slug: 'villas-ongoing', name: 'Villa community (ongoing)', group: 'ongoing-projects', badge: 'Ongoing',
      summary: v('Independent villas being built in a gated layout in [[area]].', 'A villa community under construction in [[town]], with private plots and shared amenities.', 'Gated villas in [[area]] with space for a garden and parking.'),
      description: v(
        'Villas under construction in [[area]], [[town]]. Describe the plot sizes, the villa designs, the internal roads and the shared amenities, and where the layout stands today.\n\nThe starting price is indicative and depends on plot size and the design chosen.',
        'A gated villa project in [[area]]. Tell buyers about the design options, specifications and approvals, and how the community will be maintained after handover.\n\nFinal prices are confirmed by [[vendor_name]] against the plot and design you select.',
        'These villas are being built in [[town]] within a planned layout. Use this page for the master plan, villa types and the progress of roads and utilities.\n\nAsk the sales team for the current price sheet; the figure shown here is only a starting point.'),
      priceFrom: price(6500000, 'onwards'),
      highlights: ['Private plot with a garden and parking', 'Tarred internal roads and street lighting', 'Underground drainage and water line', 'Compound wall with a gated entrance'],
      details: [{ label: 'Project type', value: 'Residential villas' }, { label: 'Location', value: loc }, { label: 'Configurations', value: '3 BHK and 4 BHK villas' }, { label: 'Sizes', value: 'Add the plot and built-up areas' }, { label: 'Possession', value: 'Add the planned possession month and year' }],
      faqs: [
        { q: 'Can the villa design be changed?', a: v('Some changes may be possible before work reaches that stage. Tell the sales team what you need and they will explain what can be done.', 'Ask us early. Minor changes can often be accommodated before construction reaches that part of the villa.', 'Customisation depends on the stage of the villa. Share your requirements and we will confirm what is possible.') },
        { q: 'Who looks after the community after handover?', a: v('Maintenance arrangements are explained in the agreement. Ask the sales team for the details before you book.', 'The agreement sets out how common areas will be maintained. Request a copy to read with your advisor.', 'Ask for the maintenance plan in writing; it will describe the common areas, the charges and who manages them.') },
      ],
      related: ['plots-ongoing', 'apartments-ongoing'],
    },
    {
      slug: 'plots-ongoing', name: 'Plotted layout (ongoing)', group: 'ongoing-projects', badge: 'Ongoing',
      summary: v('Approved plots in [[area]] with roads and utilities being laid.', 'Residential plots in [[town]] in a planned layout, ready for you to build.', 'Plots with clear boundaries in [[area]], with infrastructure work in progress.'),
      description: v(
        'A plotted layout in [[area]], [[town]]. Describe the plot sizes, road widths, utilities and the approvals, and mention how close the layout is to schools, markets and transport.\n\nThe price per plot is indicative and depends on size, corner position and facing.',
        'Residential plots in a layout being developed by [[vendor_name]]. Explain what is already done (roads, drainage, water, electricity) and what is planned.\n\nAsk the sales team for the plot-wise price list and availability.',
        'Buy a plot in [[area]] and build the way you want. Use this page for the layout plan, plot sizes and the approvals that apply.\n\nThe starting price is a guide; the exact rate depends on the plot you choose.'),
      priceFrom: price(1800000, 'per plot onwards'),
      highlights: ['Plots with clearly marked boundaries', 'Internal roads, drainage and street lights', 'Water and electricity connections planned', 'Close to schools, markets and bus routes'],
      details: [{ label: 'Project type', value: 'Residential plots' }, { label: 'Location', value: loc }, { label: 'Configurations', value: 'Plots of different sizes' }, { label: 'Sizes', value: 'Add the plot sizes in square feet' }, { label: 'Possession', value: 'Add the registration and handover timeline' }],
      faqs: [
        { q: 'Are the plots approved?', a: v('Approval details are listed on this page. Please check them with your lawyer before you pay.', 'The approving authority and approval numbers appear under key facts; verify them before booking.', 'Ask for the layout approval and title documents and have your advisor review them.') },
        { q: 'Can I build on the plot straight away?', a: v('Building depends on the approvals and on utility connections. The sales team will explain the current status of the layout.', 'Ask us about the current status of roads and utilities; it decides when you can start construction.', 'That depends on the layout stage and local rules. Contact the sales desk for the latest position.') },
      ],
      related: ['villas-ongoing', 'apartments-ongoing'],
    },
    {
      slug: 'apartments-upcoming', name: 'Apartment project (upcoming launch)', group: 'upcoming-projects', badge: 'Upcoming',
      summary: v('A new apartment project launching soon in [[area]]: register your interest first.', 'Coming soon in [[town]]: apartments in a planned residential block.', 'Be among the first to hear about our next apartment launch in [[area]].'),
      description: v(
        'This apartment project in [[area]], [[town]] has not launched yet. Use this page to share the plans, the expected unit mix and the launch timeline so buyers can register interest.\n\nThe starting price is indicative and may change at launch.',
        'An upcoming residential project by [[vendor_name]]. Tell visitors what is planned: blocks, floors, sizes, amenities and the expected launch date.\n\nPrices are not final until launch. Send an enquiry to receive the launch price list first.',
        'Planned apartments in [[area]]. Describe the concept, the site and what makes it a good place to live.\n\nIndicative pricing is shown only as a guide; the final launch price will be shared with those who register.'),
      priceFrom: price(3800000, 'onwards (2 BHK)'),
      highlights: ['Planned with parking and lift access', 'Open space and a play area in the plan', 'Register interest to hear the launch price first', 'Site and plan can be discussed before launch'],
      details: [{ label: 'Project type', value: 'Residential apartments (planned)' }, { label: 'Location', value: loc }, { label: 'Configurations', value: '2 BHK and 3 BHK planned' }, { label: 'Sizes', value: 'Add the planned areas' }, { label: 'Possession', value: 'Add the expected timeline' }],
      faqs: [
        { q: 'How do I register my interest?', a: v('Send an enquiry from this page or call [[phone]]. We will keep you informed about the launch.', 'Use the enquiry form and tell us the size you are looking for. We will contact you before the launch.', 'Call [[phone]] or message us on WhatsApp to be added to the launch list.') },
        { q: 'Will the price change at launch?', a: v('It can. The figure shown is only a guide. The launch price list will be shared with those who register.', 'Indicative prices may change when the project launches. Register to receive the confirmed price list.', 'Yes, it may. Treat the number on this page as an estimate until the launch price is published.') },
      ],
      related: ['apartments-ongoing', 'commercial-upcoming'],
    },
    {
      slug: 'commercial-upcoming', name: 'Commercial building (upcoming)', group: 'upcoming-projects', badge: 'Upcoming',
      summary: v('Shops and office space planned on a busy road in [[area]].', 'A commercial building coming to [[town]]: ground-floor shops and upper-floor offices.', 'Plan your business address in [[area]]: commercial units, launching soon.'),
      description: v(
        'A commercial building planned in [[area]], [[town]]. Describe the floors, the shop and office sizes, the parking and the frontage, and the type of businesses the location suits.\n\nPrices are indicative. Ask for the unit-wise price and the payment terms.',
        'Shops and offices in a building being planned by [[vendor_name]]. Share the floor plan, the lift and parking arrangements, and the planned timeline.\n\nThe price here is a starting figure only.',
        'A new commercial address in [[area]]. Use this page to explain the building, the unit sizes and why the road and neighbourhood work for business.\n\nContact the sales desk for the latest rates and availability.'),
      priceFrom: price(4500000, 'onwards (office unit)'),
      highlights: ['Ground-floor shops with road frontage', 'Office floors with lift access', 'Parking planned for customers and staff', 'Power backup planned for common areas'],
      details: [{ label: 'Project type', value: 'Commercial shops and offices' }, { label: 'Location', value: loc }, { label: 'Configurations', value: 'Shops and office units' }, { label: 'Sizes', value: 'Add the unit areas' }, { label: 'Possession', value: 'Add the expected timeline' }],
      faqs: [
        { q: 'Can I buy more than one unit?', a: v('Yes, if units are available. Tell the sales team what you need and they will suggest combinations.', 'You can ask about adjoining units. Availability is confirmed by the sales desk.', 'Please enquire; combining units depends on availability and the plan.') },
        { q: 'Is the price negotiable?', a: v('Prices follow the published list. Ask the sales team about the current terms.', 'The sales desk will explain the current pricing and payment terms for each unit.', 'Please ask for the price list and terms; we will explain them in writing.') },
      ],
      related: ['apartments-upcoming', 'apartments-completed'],
    },
    {
      slug: 'apartments-completed', name: 'Apartment project (completed)', group: 'completed-projects', badge: 'Completed',
      summary: v('A finished apartment project in [[area]]: see what we have built.', 'Completed apartments in [[town]], handed over to their owners.', 'Look at a project we have completed in [[area]] and judge our work yourself.'),
      description: v(
        'A completed apartment project in [[area]], [[town]]. Replace this text with the facts about the project: year of completion, number of homes, amenities and the approvals obtained.\n\nUse the gallery to show the finished building. Ask the sales team if any homes are available to buy or rent.',
        'This project has been handed over. Use this page to describe the blocks, the amenities and how the community is maintained today.\n\nContact [[vendor_name]] to ask about resale or rental support, if offered.',
        'A finished residential building by [[vendor_name]]. Add the number of homes, the completion year and photographs.\n\nVisitors can ask for a visit to the completed project to see the quality of work.'),
      priceFrom: null,
      highlights: ['Handed over to owners', 'Completion and occupancy details available on request', 'Visit the finished project by appointment', 'Photographs of the completed building'],
      details: [{ label: 'Project type', value: 'Residential apartments' }, { label: 'Location', value: loc }, { label: 'Configurations', value: 'Add the unit types' }, { label: 'Sizes', value: 'Add the areas' }, { label: 'Possession', value: 'Completed. Add the year.' }],
      faqs: [
        { q: 'Can I visit a completed project?', a: v('Yes, by appointment. Call [[phone]] to arrange a visit.', 'Visits can be arranged. Send an enquiry and we will confirm a time.', 'Please contact the sales desk on [[phone]] to see the completed building.') },
        { q: 'Are any homes still available here?', a: v('Availability changes. Send an enquiry and we will tell you the current position.', 'Ask the sales team; they will check whether any home is open to buy or rent.', 'Please enquire for the latest availability.') },
      ],
      related: ['villas-completed', 'apartments-ongoing'],
    },
    {
      slug: 'villas-completed', name: 'Villa project (completed)', group: 'completed-projects', badge: 'Completed',
      summary: v('A completed villa community in [[area]], ready to see.', 'Finished villas in [[town]], built and handed over by [[vendor_name]].', 'See our completed villas in [[area]] and the quality of finish.'),
      description: v(
        'A completed villa project in [[area]], [[town]]. Describe the layout, the villa types, the year of completion and the amenities.\n\nUse photographs to let buyers see the finish and the community.',
        'Villas that have been handed over. Add the number of villas, the specifications and any details of the community that help new buyers.\n\nAsk the sales team about visiting the project.',
        'A finished villa layout by [[vendor_name]]. This page is the place for the story of the project and its photographs.\n\nContact us to arrange a visit.'),
      priceFrom: null,
      highlights: ['Handed over to owners', 'Visit by appointment', 'Photographs of the finished villas', 'Details of specifications on request'],
      details: [{ label: 'Project type', value: 'Residential villas' }, { label: 'Location', value: loc }, { label: 'Configurations', value: 'Add the villa types' }, { label: 'Sizes', value: 'Add the plot and built-up areas' }, { label: 'Possession', value: 'Completed. Add the year.' }],
      faqs: [
        { q: 'Can I see a finished villa?', a: v('Yes, by appointment. Call [[phone]] to arrange it.', 'We can arrange a visit. Send an enquiry with your preferred day.', 'Please contact the sales desk to book a visit.') },
        { q: 'Do you build custom villas on my own plot?', a: v('Ask us. Tell the team about your plot and plan and they will explain whether and how they can help.', 'Share your plot details in an enquiry and the team will reply with what is possible.', 'Please enquire with your plot size and location; we will tell you if it is something we take up.') },
      ],
      related: ['apartments-completed', 'villas-ongoing'],
    },
  ],
  blocks: [
    { key: 'listings', title: 'Indicative price list', items: [
      { title: 'Apartments, 2 BHK', detail: 'Ongoing and upcoming projects', price: 'from ₹35 lakh (indicative)' },
      { title: 'Villas, 3 BHK', detail: 'Gated community', price: 'from ₹65 lakh (indicative)' },
      { title: 'Residential plots', detail: 'Approved layout', price: 'from ₹18 lakh (indicative)' },
      { title: 'Commercial units', detail: 'Shops and offices', price: 'from ₹45 lakh (indicative)' } ] },
    { key: 'areas', title: 'Areas we build in', items: [{ title: '[[area]]', detail: 'Main locality', price: '' }, { title: '[[town]]', detail: 'City and nearby areas', price: '' }, { title: '[[branches]]', detail: 'Other sites and offices', price: '' }] },
    { key: 'process', title: 'How buying works', items: [
      { title: '1. Enquire', detail: 'Tell us the size and budget you have in mind.', price: '' },
      { title: '2. Visit the site', detail: 'See the project and the plans with our team.', price: '' },
      { title: '3. Book and sign', detail: 'Pay the booking amount and read the agreement.', price: '' },
      { title: '4. Track and move in', detail: 'Follow the progress and take possession.', price: '' } ] },
  ],
  faqs: [
    { q: 'How do I choose between ongoing, upcoming and completed projects?', a: v('Ongoing projects are being built now and can usually be booked. Upcoming projects have not launched yet. Completed projects are finished and can be visited.', 'Pick ongoing if you want a home soon at a price for a building still in progress, upcoming to register early, and completed to see the finished work.', 'The project groups show where each project stands. Open a project page to see its status, sizes and indicative price.') },
    { q: 'Are the prices on this website final?', a: v('No. Prices are indicative starting prices. The sales team confirms the exact price in writing for the unit you choose.', 'The prices shown help you compare projects. Ask for the current price list before you book.', 'Treat each price as a guide. The final price is confirmed by [[vendor_name]] when you select a unit.') },
    { q: 'How can I verify a project before I book?', a: v('Ask for the RERA registration number and approvals, which appear on each project page, and check them on the official RERA website with your advisor.', 'Check the RERA number and the approval details on the official portal, and have a lawyer read the agreement.', 'Verify the project on the state RERA website and review the documents with a lawyer before paying.') },
    { q: 'Can I visit a project before booking?', a: v('Yes. Call [[phone]] or send an enquiry and we will arrange a visit.', 'Site visits are by appointment. Contact the sales desk on [[phone]].', 'Please visit before you decide; the sales team will take you through the site.') },
    { q: 'Which areas does [[vendor_name]] build in?', a: v('We build in [[area]], [[town]] and nearby places. See the areas section for the full list.', 'Our projects are in [[area]] and around [[town]]. Other sites: [[branches]].', 'Mainly [[area]] and [[town]]. Contact us to ask about other locations.') },
    { q: 'Will I get a written agreement?', a: v('Yes. Every booking is followed by an agreement that states the price, the payment schedule and the planned possession date. Read it with your advisor.', 'Your agreement will set out the price, the payment schedule and possession terms. Ask for a draft before you pay.', 'The terms are put in writing in an agreement. Ask for a copy to review before booking.') },
  ],
  trust: ['Clear price list before you visit', 'Site visits by appointment', 'Payment schedule explained in writing', 'Project documents available to check with your lawyer'],
  steps: [
    { title: 'Enquire and shortlist', desc: 'Tell us your budget and the kind of home or plot you want.' },
    { title: 'Visit the site', desc: 'See the project, the plans and the surroundings with our team.' },
    { title: 'Book and sign the agreement', desc: 'Pay the booking amount and read the agreement with your advisor.' },
    { title: 'Follow progress and take possession', desc: 'Track the construction and receive your home at handover.' },
  ],
  team: [
    { name: '[[owner]]', role: 'Owner or managing partner', note: 'Add a line about experience.' },
    { name: 'Name to be added', role: 'Sales manager', note: '' },
    { name: 'Name to be added', role: 'Site engineer', note: '' },
  ],
  credentials: [
    { title: 'RERA registration', detail: '[[rera_no]]' },
    { title: 'Approvals', detail: '[[approvals]]' },
    { title: 'Office', detail: '[[area]], [[town]]' },
  ],
  areas: ['[[area]]', '[[town]]', '[[branches]]'],
  contact: { hours: 'Monday to Saturday, 9:30 am to 6:30 pm. Sunday by appointment.', areaServed: '[[area]], [[town]] and nearby areas', branches: '[[branches]]' },
  notes: 'Replace the generic project types with the vendor\'s own projects: name, location, status, sizes, planned possession, RERA number, price (or leave the price empty to show "price on request"), banner image and gallery. Highlights are joined with " · " into the item "includes" field by the importer.',
};
