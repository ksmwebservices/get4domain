// Default content pack for a property agent or portal (g4d-pack-content/1). Generic listing types, not real listings:
// the vendor replaces localities, sizes and prices. Prices are indicative. Nothing here is a testimonial, an award or a licence number.
const v = (...x) => x;
const price = (amount, unit) => ({ amount, unit, currency: 'INR', indicative: true });
const loc = '[[area]], [[town]]';

export default {
  schema: 'g4d-pack-content/1',
  type: 'property-agent',
  family: 'real-estate-property',
  kitCategories: ['real-estate-agent'],
  language: 'en',
  placeholders: { vendor_name: 'Your agency name', owner: 'Owner or principal agent', town: 'Your town', area: 'Main locality', branches: 'Other localities or offices', phone: 'Office phone number', rera_no: 'RERA agent registration number, if applicable', approvals: 'Other registrations you want to show' },
  seo: {
    title: v('[[vendor_name]]: property agents in [[town]]', 'Buy, rent or lease property in [[town]] with [[vendor_name]]', '[[vendor_name]] | Homes, plots and shops in [[area]], [[town]]'),
    description: v(
      '[[vendor_name]] helps you buy, sell, rent and lease homes, plots and shops in [[town]] and [[area]]. Browse listings with indicative prices and book a visit.',
      'Looking for a property in [[town]]? [[vendor_name]] lists apartments, houses, plots and commercial space for sale, rent and lease, with local advice.',
      'Property listings by [[vendor_name]] in [[area]], [[town]]: sale, rent and lease. Compare options and send an enquiry.'),
  },
  hero: {
    title: v('[[vendor_name]]: property agents helping you buy, rent and lease in [[town]]', 'Find your next home or shop in [[town]] with [[vendor_name]]', '[[vendor_name]]: local property advice in [[area]], [[town]]'),
    subtitle: v('Homes, plots and shops for sale, rent and lease, with indicative prices and a site visit arranged for you.', 'Tell us what you need and your budget. We shortlist properties in [[area]] and arrange visits.', 'Browse listings by type, check the details, and talk to a local agent before you decide.'),
    bannerText: v('Local property advice in [[town]]', 'Your next address in [[area]]', 'Buy, rent or lease with confidence'),
    serviceLinks: ['apartment-for-sale', 'house-for-sale', 'plot-for-sale', 'apartment-for-rent', 'shop-for-lease'],
  },
  cta: { label: 'Book a property visit', secondary: 'Browse properties' },
  about: {
    title: 'About [[vendor_name]]',
    text: v(
      '[[vendor_name]] is a property agency based in [[town]]. [[owner]] leads the team. We help owners sell, rent and lease, and help buyers and tenants find the right place in [[area]] and nearby localities.\n\nEvery listing page shows the type, size, locality and an indicative price, so you can compare before you visit.',
      '[[vendor_name]] works with buyers, sellers, landlords and tenants across [[town]]. Under [[owner]], our agents shortlist properties, arrange visits and explain the paperwork.\n\nUse the listing pages to see what is available for sale, rent and lease today.',
      'We are [[vendor_name]], a local agency in [[area]]. [[owner]] and the team know the streets, the schools and the prices in [[town]].\n\nBrowse the listings, read the details, and send an enquiry for the one that fits your budget.'),
  },
  groups: [
    { slug: 'for-sale', name: 'Properties for sale' },
    { slug: 'for-rent', name: 'Properties for rent' },
    { slug: 'for-lease', name: 'Commercial for lease' },
  ],
  items: [
    {
      slug: 'apartment-for-sale', name: 'Apartment for sale', group: 'for-sale', badge: 'For sale',
      summary: v('Ready and under-construction apartments in [[area]] to suit different budgets.', 'Flats for sale in [[town]], from compact 1 BHK to family 3 BHK homes.', 'Apartments in [[area]] shortlisted by our agents for your budget.'),
      description: v(
        'Apartments for sale in [[area]], [[town]]. Replace this text with the listing story: the building, the floor, the facing, the age of the property and what is nearby.\n\nThe price shown is indicative. Ask [[vendor_name]] for the current rate, and for the documents to check before you book.',
        'A flat in a well-kept building in [[area]]. Describe the rooms, the parking, the lift and the neighbourhood, and say whether it is ready to move in.\n\nPrices are a guide only; the final price is agreed between buyer and seller.',
        'Looking to buy an apartment in [[town]]? Use this page for the layout, the amenities and the locality, and add photographs of the home.\n\nSend an enquiry to get the latest price and to arrange a visit.'),
      priceFrom: price(3200000, 'onwards (2 BHK)'),
      highlights: ['Covered parking and lift access', 'Close to schools, markets and bus routes', 'Ready-to-move and under-construction options', 'Our agent arranges the visit and explains the documents'],
      details: [{ label: 'Type', value: 'Residential apartment' }, { label: 'Location', value: loc }, { label: 'Size', value: 'Add the built-up area' }, { label: 'Configuration', value: '1, 2 and 3 BHK' }, { label: 'Timeline', value: 'Ready to move or add the handover date' }],
      faqs: [
        { q: 'Is the price on this page final?', a: v('No. It is an indicative starting price. The final price is agreed between buyer and seller, and confirmed in writing.', 'The price is a guide for comparing properties. Ask us for the current figure for the exact home you like.', 'It is an estimate. The agent will confirm the latest price before you decide.') },
        { q: 'Can you arrange a visit?', a: v('Yes. Call [[phone]] or send an enquiry and we will fix a time that suits you.', 'Visits are by appointment. Contact [[vendor_name]] on [[phone]] to choose a day.', 'Please ask; our agent will take you to see the property.') },
        { q: 'Do you help with loans and paperwork?', a: v('We explain the documents and can point you to banks. Please check everything with your own advisor.', 'Our agents explain the steps. Loan and legal checks should be done with your bank and lawyer.', 'We guide you through the process, but ask a lawyer to review the papers before you pay.') },
      ],
      related: ['house-for-sale', 'apartment-for-rent'],
    },
    {
      slug: 'house-for-sale', name: 'Independent house for sale', group: 'for-sale', badge: 'For sale',
      summary: v('Independent houses and villas in [[area]] with space for a family and a garden.', 'Houses for sale in [[town]], from compact homes to large family villas.', 'Own an independent home in [[area]]: shortlisted and verified by our agents.'),
      description: v(
        'Independent houses for sale in [[area]], [[town]]. Describe the plot size, the built-up area, the number of floors, the age and the road access.\n\nThe starting price is indicative and depends on size, age and location.',
        'A house in a settled neighbourhood of [[town]]. Use this page for the rooms, the parking, the water and power arrangements and the nearby facilities.\n\nAsk [[vendor_name]] for the current price and the title documents to check.',
        'A family home in [[area]]. Tell buyers about the layout and the surroundings, and add photographs.\n\nThe price here is a guide only; the agent will confirm the latest figure.'),
      priceFrom: price(5500000, 'onwards'),
      highlights: ['Own plot with parking and space to extend', 'Quiet residential streets', 'Water and power connections in place', 'Title documents can be checked with your lawyer'],
      details: [{ label: 'Type', value: 'Independent house or villa' }, { label: 'Location', value: loc }, { label: 'Size', value: 'Add the plot and built-up areas' }, { label: 'Configuration', value: '2, 3 and 4 BHK' }, { label: 'Timeline', value: 'Ready to move' }],
      faqs: [
        { q: 'Can I check the title documents?', a: v('Yes. Ask the agent for the documents and have your lawyer review them before you pay.', 'We can share the available documents. Please have an advisor check them.', 'Request the papers early and review them with a lawyer.') },
        { q: 'Is the price negotiable?', a: v('Prices are agreed between buyer and seller. Tell us your budget and we will help.', 'Often there is room to discuss. Share your budget in an enquiry.', 'Please ask; our agent will talk to the owner on your behalf.') },
      ],
      related: ['apartment-for-sale', 'plot-for-sale'],
    },
    {
      slug: 'plot-for-sale', name: 'Residential plot for sale', group: 'for-sale', badge: 'For sale',
      summary: v('Approved residential plots in [[area]] ready for you to build.', 'Plots for sale in [[town]] with clear boundaries and road access.', 'Buy land in [[area]] and build the home you want.'),
      description: v(
        'Residential plots for sale in [[area]], [[town]]. Describe the plot size, facing, road width and the approval status, and mention the nearby facilities.\n\nThe price per plot is indicative and depends on size, corner position and facing.',
        'A plot in a developing locality of [[town]]. Use this page for the layout, boundaries and approvals, and add a site photograph.\n\nAsk [[vendor_name]] for the plot-wise price and availability.',
        'Plots with road access in [[area]]. Explain what is already built around and what is planned.\n\nPrices are a guide; confirm the exact rate with our agent.'),
      priceFrom: price(1500000, 'per plot onwards'),
      highlights: ['Clear boundaries and road access', 'Approval and title details shared on request', 'Close to schools and markets', 'Site visit arranged by our agent'],
      details: [{ label: 'Type', value: 'Residential plot' }, { label: 'Location', value: loc }, { label: 'Size', value: 'Add the plot size in square feet' }, { label: 'Configuration', value: 'East, west, north or south facing' }, { label: 'Timeline', value: 'Ready for registration' }],
      faqs: [
        { q: 'Are the plots approved?', a: v('Approval details are listed for each plot. Please verify them with your lawyer before you pay.', 'We share the approval and title details on request; have them checked independently.', 'Ask for the layout approval and title papers and review them with an advisor.') },
        { q: 'Can you help me build after I buy?', a: v('We can introduce local builders and contractors. The choice and the contract are yours.', 'Ask us for contacts of local builders; you decide whom to hire.', 'We can point you to trusted local contractors on request.') },
      ],
      related: ['house-for-sale', 'apartment-for-sale'],
    },
    {
      slug: 'apartment-for-rent', name: 'Apartment for rent', group: 'for-rent', badge: 'For rent',
      summary: v('Flats for rent in [[area]] for families, bachelors and working professionals.', 'Rental apartments in [[town]], furnished and unfurnished.', 'Find a flat to rent in [[area]] with a clear deposit and rent.'),
      description: v(
        'Apartments for rent in [[area]], [[town]]. Describe the rooms, the floor, the furnishing and the rent and deposit terms.\n\nThe rent shown is indicative and depends on the flat and the lease period.',
        'A rental flat close to everyday needs. Use this page for the layout, parking and the rules of the building, and add photographs.\n\nAsk [[vendor_name]] for the current rent, deposit and available date.',
        'Rent a home in [[town]] without the hassle. Tell tenants what is included, such as water, parking and maintenance.\n\nThe rent here is a guide; the owner confirms the final figure.'),
      priceFrom: price(12000, 'per month onwards'),
      highlights: ['Furnished and unfurnished options', 'Clear rent, deposit and notice terms', 'Parking and lift in many buildings', 'Agent arranges the visit and the agreement'],
      details: [{ label: 'Type', value: 'Residential apartment for rent' }, { label: 'Location', value: loc }, { label: 'Size', value: 'Add the built-up area' }, { label: 'Configuration', value: '1, 2 and 3 BHK' }, { label: 'Timeline', value: 'Available now or add the date' }],
      faqs: [
        { q: 'How much deposit is usual?', a: v('It varies by owner and locality. We will tell you the deposit for the exact flat before you visit.', 'Deposits differ from flat to flat. Ask us for the figure on the listing you like.', 'Please enquire; the deposit is set by the owner and we will confirm it in writing.') },
        { q: 'Do you prepare the rental agreement?', a: v('We help with the agreement and explain its terms. Read it carefully before you sign.', 'Our agents can arrange the agreement; please read every clause before signing.', 'Yes, we help; keep a copy and read it with care.') },
      ],
      related: ['house-for-rent', 'apartment-for-sale'],
    },
    {
      slug: 'house-for-rent', name: 'House for rent', group: 'for-rent', badge: 'For rent',
      summary: v('Independent houses for rent in [[area]] for families.', 'Rental houses in [[town]] with parking and space.', 'A house to rent in [[area]], ready to move into.'),
      description: v(
        'Houses for rent in [[area]], [[town]]. Describe the floors, the rooms, the parking and the neighbourhood.\n\nThe rent is indicative and depends on the house and the lease period.',
        'A family house to rent in a quiet part of [[town]]. Tell tenants about water, power and any restrictions.\n\nAsk [[vendor_name]] for the current rent and deposit.',
        'Rent a home with space for the whole family in [[area]]. Add photographs and the available date.\n\nThe figure on this page is a guide only.'),
      priceFrom: price(15000, 'per month onwards'),
      highlights: ['Space for a family with parking', 'Quiet residential streets', 'Clear rent and deposit terms', 'Visit arranged by our agent'],
      details: [{ label: 'Type', value: 'House for rent' }, { label: 'Location', value: loc }, { label: 'Size', value: 'Add the built-up area' }, { label: 'Configuration', value: '2 and 3 BHK' }, { label: 'Timeline', value: 'Available now or add the date' }],
      faqs: [
        { q: 'Are pets or bachelors allowed?', a: v('It depends on the owner. Ask us and we will check before you visit.', 'Rules differ for each house. Tell us your situation and we will find a match.', 'Please enquire; each owner sets the rules.') },
        { q: 'Who pays for maintenance and repairs?', a: v('This is set in the rental agreement. We explain the terms before you sign.', 'It depends on the agreement; we make sure it is written down.', 'Ask us; the agreement should state it clearly.') },
      ],
      related: ['apartment-for-rent', 'house-for-sale'],
    },
    {
      slug: 'shop-for-lease', name: 'Shop for lease', group: 'for-lease', badge: 'For lease',
      summary: v('Shops on busy roads in [[area]] for lease or rent.', 'Retail space in [[town]] with road frontage and footfall.', 'Start or grow your business from a shop in [[area]].'),
      description: v(
        'A shop for lease in [[area]], [[town]]. Describe the size, the frontage, the floor and the type of business the road suits.\n\nRent and deposit are indicative; ask for the lease terms in writing.',
        'Retail space on a busy road. Use this page for the dimensions, parking and the nearby businesses, and add photographs.\n\nAsk [[vendor_name]] for the current rent and lease period.',
        'A shop that suits a new business in [[town]]. Explain what is included and any restrictions.\n\nThe figure shown is a guide only.'),
      priceFrom: price(25000, 'per month onwards'),
      highlights: ['Road frontage with passing footfall', 'Ground-floor and first-floor options', 'Parking nearby', 'Lease terms explained in writing'],
      details: [{ label: 'Type', value: 'Shop for lease' }, { label: 'Location', value: loc }, { label: 'Size', value: 'Add the area in square feet' }, { label: 'Configuration', value: 'Ground or first floor' }, { label: 'Timeline', value: 'Available now or add the date' }],
      faqs: [
        { q: 'What is the usual lease period?', a: v('It varies by owner. We will tell you the period and the terms for the shop you like.', 'Lease periods differ; the terms are written into the agreement.', 'Please enquire; the owner sets the period and we explain it.') },
        { q: 'Can I run any business here?', a: v('Some owners restrict the type of business. Tell us your plan and we will check.', 'Ask us before you decide; permissions depend on the building and the owner.', 'Share your business type in an enquiry and we will confirm.') },
      ],
      related: ['office-for-lease', 'apartment-for-rent'],
    },
    {
      slug: 'office-for-lease', name: 'Office space for lease', group: 'for-lease', badge: 'For lease',
      summary: v('Office space in [[area]] for small teams and growing firms.', 'Commercial offices in [[town]] with lift, parking and power backup.', 'A professional address in [[area]] for your business.'),
      description: v(
        'Office space for lease in [[area]], [[town]]. Describe the floor, the area, the cabins or open plan, and the amenities.\n\nThe rent is indicative; ask for the lease terms in writing.',
        'A workspace for a small team. Use this page for the layout, parking and the building facilities, and add photographs.\n\nAsk [[vendor_name]] for the current rent and the available date.',
        'An office that suits a growing firm in [[town]]. Explain what is included and what is extra.\n\nThe price shown is a guide only.'),
      priceFrom: price(30000, 'per month onwards'),
      highlights: ['Lift access and parking', 'Power backup for common areas', 'Open-plan and cabin layouts', 'Central location with easy transport'],
      details: [{ label: 'Type', value: 'Office space for lease' }, { label: 'Location', value: loc }, { label: 'Size', value: 'Add the area in square feet' }, { label: 'Configuration', value: 'Open plan or with cabins' }, { label: 'Timeline', value: 'Available now or add the date' }],
      faqs: [
        { q: 'Can the office be furnished?', a: v('Some are. Ask us and we will tell you what the owner offers.', 'Furnishing varies by listing; we will confirm what is included.', 'Please enquire; some owners provide furniture and some do not.') },
        { q: 'Is there a lock-in period?', a: v('This is set by the owner in the lease. We explain it before you sign.', 'Lock-in terms differ; they are written into the agreement.', 'Ask us; we will confirm the lock-in and notice terms.') },
      ],
      related: ['shop-for-lease', 'apartment-for-rent'],
    },
  ],
  blocks: [
    { key: 'listings', title: 'Indicative rates', items: [
      { title: 'Apartments for sale, 2 BHK', detail: 'Ready and under construction', price: 'from ₹32 lakh (indicative)' },
      { title: 'Residential plots', detail: 'Approved layouts', price: 'from ₹15 lakh (indicative)' },
      { title: 'Flats for rent, 2 BHK', detail: 'Furnished and unfurnished', price: 'from ₹12,000 per month (indicative)' },
      { title: 'Shops for lease', detail: 'Main road frontage', price: 'from ₹25,000 per month (indicative)' } ] },
    { key: 'areas', title: 'Localities we cover', items: [{ title: '[[area]]', detail: 'Main locality', price: '' }, { title: '[[town]]', detail: 'City and nearby areas', price: '' }, { title: '[[branches]]', detail: 'Other localities and offices', price: '' }] },
    { key: 'process', title: 'How we help', items: [
      { title: '1. Tell us what you need', detail: 'Share the type, locality and budget.', price: '' },
      { title: '2. Shortlist', detail: 'We send you matching properties.', price: '' },
      { title: '3. Visit', detail: 'Our agent takes you to see them.', price: '' },
      { title: '4. Close the deal', detail: 'We guide you through the agreement and paperwork.', price: '' } ] },
  ],
  faqs: [
    { q: 'How do I find a property in [[town]]?', a: v('Browse the listings by type or tell us what you need. We shortlist and arrange visits.', 'Use the listing pages, then call [[phone]] with your budget and locality. We will match you.', 'Send an enquiry with your needs and we will reply with options.') },
    { q: 'Are the prices on this website final?', a: v('No. Prices are indicative. The final price or rent is agreed between the parties and confirmed in writing.', 'They help you compare. Ask for the current figure for the exact property.', 'Treat them as a guide; our agent confirms the latest price.') },
    { q: 'Do you charge a fee?', a: v('Brokerage terms differ for sale, rent and lease. We explain our fee before you commit.', 'Please ask; we share our brokerage in writing before any visit that leads to a deal.', 'Our fee depends on the type of deal and is told to you up front.') },
    { q: 'Can I list my own property with [[vendor_name]]?', a: v('Yes. Call [[phone]] or send an enquiry with the type, locality and expected price.', 'Owners are welcome. Tell us about your property and we will advise on pricing and marketing.', 'Contact us with the details; we will arrange a visit to list it.') },
    { q: 'Which localities do you cover?', a: v('We cover [[area]], [[town]] and nearby places. See the localities section for the list.', 'Mainly [[area]] and across [[town]]. Other offices: [[branches]].', 'Our listings are in [[area]] and around [[town]].') },
    { q: 'How do I verify a property before I buy?', a: v('Check the title documents, approvals and encumbrance details with your lawyer and, for projects, the RERA website.', 'Have a lawyer review the papers. We share what we have, but verify independently.', 'Ask for the documents early and review them with an advisor before you pay.') },
  ],
  trust: ['Local agents who know the streets and prices', 'Site visits arranged for you', 'Clear fees explained before any deal', 'Documents shared for your lawyer to check'],
  steps: [
    { title: 'Tell us what you need', desc: 'Share the type of property, locality and budget.' },
    { title: 'Get a shortlist', desc: 'We send matching listings with indicative prices.' },
    { title: 'Visit with our agent', desc: 'See the properties and ask questions on site.' },
    { title: 'Close with clear paperwork', desc: 'We guide you through the agreement and documents.' },
  ],
  team: [
    { name: '[[owner]]', role: 'Owner or principal agent', note: 'Add a line about experience.' },
    { name: 'Name to be added', role: 'Sales agent', note: '' },
    { name: 'Name to be added', role: 'Rental and leasing agent', note: '' },
  ],
  credentials: [
    { title: 'RERA agent registration', detail: '[[rera_no]]' },
    { title: 'Other registrations', detail: '[[approvals]]' },
    { title: 'Office', detail: '[[area]], [[town]]' },
  ],
  areas: ['[[area]]', '[[town]]', '[[branches]]'],
  contact: { hours: 'Monday to Saturday, 9:30 am to 7:00 pm. Sunday by appointment.', areaServed: '[[area]], [[town]] and nearby localities', branches: '[[branches]]' },
  terms: { items: 'Properties', itemOne: 'Property', groups: 'Listing type' },
  listPageTitle: 'Properties',
  notes: 'Replace the generic listing types with the vendor\'s own listings: name, locality, size, configuration, availability, price or rent (or leave the price empty to show "price on request"), and photographs. Add the RERA agent registration number only if the vendor has given one; never invent a registration number.',
};
