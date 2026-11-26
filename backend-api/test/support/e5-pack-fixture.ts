/** A small but complete content pack (schema g4d-pack-content/1), for the importer tests. Three wording variants wherever the schema asks for them. */
export const v3 = (s: string): string[] => [`${s} (one)`, `${s} (two)`, `${s} (three)`];

export const samplePack = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  schema: 'g4d-pack-content/1', type: 'builder-developer', family: 'real-estate-property', kitCategories: ['real-estate-agent'], language: 'en',
  placeholders: { vendor_name: 'Your Builders', owner: 'the owner', town: 'your town', area: 'your area', branches: 'our branches', phone: '' },
  seo: { title: v3('[[vendor_name]] builders in [[town]]'), description: v3('Homes and villas by [[vendor_name]] in [[town]]. Call [[phone]]') },
  hero: { title: v3('Homes built by [[vendor_name]]'), subtitle: v3('Trusted builders serving [[town]]'), bannerText: v3('Site visits this week'), serviceLinks: ['villas'] },
  cta: { label: 'Book a site visit', secondary: 'Call us' },
  about: { title: 'About [[vendor_name]]', text: v3('[[vendor_name]] is led by [[owner]] and works across [[town]] and [[branches]]') },
  groups: [{ slug: 'homes', name: 'Homes' }, { slug: 'plots', name: 'Plots in [[town]]' }],
  items: [
    { slug: 'villas', name: 'Villas', group: 'homes', summary: v3('Villas in [[town]]'), description: v3('Independent villas by [[vendor_name]]'), priceFrom: { amount: 4500000, unit: 'per villa', currency: 'INR', indicative: true },
      highlights: ['Own parking', 'Garden'], details: [{ label: 'Bedrooms', value: '3 or 4' }], faqs: [{ q: 'Is parking included?', a: v3('Yes, parking is included') }], related: ['plots'] },
    { slug: 'plots', name: 'Plots', group: 'plots', summary: v3('Plots near [[area]]'), description: v3('Ready plots'), priceFrom: null, highlights: [], details: [], faqs: [], related: [] },
  ],
  blocks: [{ key: 'price-list', title: 'Indicative prices', items: [{ title: 'Villa', detail: 'per unit', price: 'from 45 lakh' }, { title: 'Plot', detail: 'per cent', price: 'on request' }] }],
  faqs: [{ q: 'Do you offer site visits?', a: v3('Yes, free site visits') }, { q: 'Which areas do you cover?', a: v3('[[town]] and nearby') }],
  trust: ['Years of building homes', 'Clear paperwork'],
  steps: [{ title: 'Visit the site', desc: 'We walk the plot with you' }, { title: 'Plan and quote' }],
  team: [{ name: '[[owner]]', role: 'Builder', note: 'Leads every project' }],
  credentials: [{ title: 'Registered builder', detail: 'Ask us for details' }],
  areas: ['[[area]]', 'Nearby towns'],
  contact: { hours: 'Mon-Sat 9 to 6', areaServed: '[[town]]', branches: '[[branches]]' },
  notes: 'for admins',
  ...over,
});
