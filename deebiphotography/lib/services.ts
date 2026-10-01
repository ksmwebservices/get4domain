export type Service = {
  slug: string;
  shortTitle: string;
  title: string;
  eyebrow: string;
  description: string;
  answer: string;
  image: string;
  keywords: string[];
  features: string[];
  deliverables: string[];
  gallery: { src: string; alt: string }[];
  video: { title: string; description: string; href: string; poster: string };
};

const photos = {
  ceremony: 'https://images.pexels.com/photos/17657612/pexels-photo-17657612.jpeg?auto=compress&cs=tinysrgb&w=1200',
  couple: 'https://images.pexels.com/photos/32878577/pexels-photo-32878577.jpeg?auto=compress&cs=tinysrgb&w=1200',
  haldi: 'https://images.pexels.com/photos/35327940/pexels-photo-35327940.jpeg?auto=compress&cs=tinysrgb&w=1200',
  portrait: 'https://images.pexels.com/photos/32060316/pexels-photo-32060316.jpeg?auto=compress&cs=tinysrgb&w=1200',
  temple: 'https://images.pexels.com/photos/31771915/pexels-photo-31771915.jpeg?auto=compress&cs=tinysrgb&w=1200',
  details: 'https://images.pexels.com/photos/32325846/pexels-photo-32325846.jpeg?auto=compress&cs=tinysrgb&w=1200',
  celebration: 'https://images.pexels.com/photos/19982554/pexels-photo-19982554.jpeg?auto=compress&cs=tinysrgb&w=1200',
  ritual: 'https://images.pexels.com/photos/32878562/pexels-photo-32878562.jpeg?auto=compress&cs=tinysrgb&w=1200',
  engagement: 'https://images.pexels.com/photos/29187302/pexels-photo-29187302.jpeg?auto=compress&cs=tinysrgb&w=1200',
};

export const services: Service[] = [
  {
    slug: 'wedding-photography',
    shortTitle: 'Wedding Photography',
    title: 'Wedding Photography in Madurai & Tamil Nadu',
    eyebrow: 'The Main Celebration',
    description: 'Candid, traditional, editorial, and documentary wedding photography for couples who want the full feeling of their day preserved.',
    answer: 'Deebi Wedding Stories provides full-day Indian wedding photography in Madurai, covering rituals, family portraits, candid moments, couple portraits, and the reception in a refined visual story.',
    image: photos.ceremony,
    keywords: ['wedding photographer in Madurai', 'Indian wedding photography Tamil Nadu', 'candid wedding photography Madurai', 'traditional wedding photographer'],
    features: ['Candid and traditional coverage', 'Two experienced photographers', '800+ professionally edited images', 'Family, ritual, and couple portraits'],
    deliverables: ['Private online gallery', 'High-resolution wedding photos', 'Premium album design', 'Print-ready family portraits'],
    gallery: [
      { src: photos.ceremony, alt: 'Indian couple during a wedding ceremony' },
      { src: photos.couple, alt: 'South Asian couple in traditional wedding attire' },
      { src: photos.ritual, alt: 'South Indian wedding ritual' },
      { src: photos.celebration, alt: 'Indian wedding celebration with family' },
    ],
    video: { title: 'Indian wedding ceremony sample', description: 'A short Pexels wedding ceremony clip for visual reference.', href: 'https://www.pexels.com/video/people-during-indian-wedding-10805308', poster: photos.celebration },
  },
  {
    slug: 'candid-photography',
    shortTitle: 'Candid Photography',
    title: 'Candid Wedding Photography That Feels Like You',
    eyebrow: 'Unscripted Emotion',
    description: 'Quiet glances, loud laughter, happy tears, and the people who make your wedding yours — photographed without interrupting the moment.',
    answer: 'Candid wedding photography focuses on natural emotions and real interactions instead of stiff posing, giving couples in Madurai an honest visual record of their wedding day.',
    image: photos.couple,
    keywords: ['candid wedding photographer Madurai', 'natural wedding photography', 'emotional wedding photos Tamil Nadu', 'documentary wedding photography'],
    features: ['Unobtrusive documentary approach', 'Emotion-led storytelling', 'Natural couple portraits', 'Family and guest candids'],
    deliverables: ['Curated candid gallery', 'Black-and-white portrait set', 'Social media preview set', 'Archival high-resolution files'],
    gallery: [
      { src: photos.couple, alt: 'Couple sharing a candid wedding moment' },
      { src: photos.celebration, alt: 'Family celebrating an Indian wedding' },
      { src: photos.haldi, alt: 'Joyful candid haldi ceremony moment' },
      { src: photos.portrait, alt: 'Natural Indian wedding portrait' },
    ],
    video: { title: 'Romantic couple sample clip', description: 'A short outdoor wedding couple clip with a natural, candid feel.', href: 'https://www.pexels.com/video/romantic-wedding-couple-embracing-outdoors-28952503', poster: photos.couple },
  },
  {
    slug: 'traditional-photography',
    shortTitle: 'Traditional Photography',
    title: 'Traditional South Indian Wedding Photography',
    eyebrow: 'Ritual & Heritage',
    description: 'Beautifully composed coverage of every sacred ritual, family blessing, garland exchange, and cultural detail that makes your wedding meaningful.',
    answer: 'Traditional wedding photography documents every important ritual and family relationship with clear, timeless compositions suited to South Indian weddings in Madurai and across Tamil Nadu.',
    image: photos.ritual,
    keywords: ['South Indian wedding photography', 'traditional marriage photography Madurai', 'Tamil wedding photographer', 'temple wedding photography'],
    features: ['Complete ritual coverage', 'Family and elders portraits', 'Temple and mandapam photography', 'Classic album compositions'],
    deliverables: ['Ritual timeline gallery', 'Family group portraits', 'Wedding album story edit', 'Large-format print files'],
    gallery: [
      { src: photos.ritual, alt: 'Traditional South Indian wedding ritual' },
      { src: photos.temple, alt: 'Indian couple near temple architecture' },
      { src: photos.details, alt: 'Wedding hands and henna detail' },
      { src: photos.ceremony, alt: 'Indian wedding ceremony under floral decor' },
    ],
    video: { title: 'South Indian rituals sample', description: 'A verified South Indian wedding ritual clip for inspiration.', href: 'https://www.pexels.com/video/elegant-south-indian-wedding-rituals-captured-31139763', poster: photos.ritual },
  },
  {
    slug: 'pre-wedding-photography',
    shortTitle: 'Pre-Wedding Shoots',
    title: 'Pre-Wedding Photography in Madurai',
    eyebrow: 'Before The Vows',
    description: 'A relaxed pre-wedding experience built around your story, your chemistry, and locations that feel personal to both of you.',
    answer: 'Deebi Wedding Stories creates romantic pre-wedding photoshoots around Madurai, temples, heritage spaces, beaches, gardens, and meaningful locations chosen by each couple.',
    image: photos.portrait,
    keywords: ['pre-wedding shoot Madurai', 'couple photoshoot Tamil Nadu', 'pre-wedding photographer near Madurai', 'romantic couple photography'],
    features: ['Location and wardrobe guidance', '2–4 hour guided session', 'Natural posing direction', 'Optional teaser film'],
    deliverables: ['60+ edited photographs', 'Save-the-date images', 'Vertical social media edits', 'Location planning consultation'],
    gallery: [
      { src: photos.portrait, alt: 'South Asian couple pre-wedding portrait' },
      { src: photos.temple, alt: 'Couple pre-wedding portrait at a historic temple' },
      { src: photos.couple, alt: 'Romantic couple portrait outdoors' },
      { src: photos.engagement, alt: 'Couple sharing an intimate pre-wedding moment' },
    ],
    video: { title: 'Pre-wedding couple sample clip', description: 'A romantic couple clip to help you imagine your own pre-wedding film.', href: 'https://www.pexels.com/video/romantic-wedding-couple-embracing-outdoors-28952503', poster: photos.engagement },
  },
  {
    slug: 'engagement-photography',
    shortTitle: 'Engagement Photography',
    title: 'Engagement & Reception Photography',
    eyebrow: 'The First Celebration',
    description: 'Elegant coverage for engagement ceremonies, ring exchanges, receptions, and the first celebration of your new chapter.',
    answer: 'Engagement photography captures the ring exchange, family greetings, stage portraits, décor, and celebration with a polished style for couples in Madurai.',
    image: photos.engagement,
    keywords: ['engagement photographer Madurai', 'reception photography Tamil Nadu', 'ring ceremony photographer', 'engagement photoshoot'],
    features: ['Stage and candid coverage', 'Ring and detail photographs', 'Couple and family portraits', 'Fast preview delivery'],
    deliverables: ['Edited engagement gallery', 'Same-week preview set', 'Family portrait collection', 'Reception décor details'],
    gallery: [
      { src: photos.engagement, alt: 'Engaged couple embracing' },
      { src: photos.celebration, alt: 'Indian wedding reception celebration' },
      { src: photos.details, alt: 'Hands and wedding jewellery detail' },
      { src: photos.portrait, alt: 'Elegant couple portrait' },
    ],
    video: { title: 'Wedding celebration sample clip', description: 'A short wedding celebration clip with the energy of a reception.', href: 'https://www.pexels.com/video/a-man-carrying-his-beautiful-bride-14988161', poster: photos.celebration },
  },
  {
    slug: 'haldi-mehendi-photography',
    shortTitle: 'Haldi & Mehendi',
    title: 'Haldi & Mehendi Photography Full of Colour',
    eyebrow: 'Colour, Laughter & Chaos',
    description: 'Vibrant coverage of turmeric, henna, music, family games, and every joyful pre-wedding ritual before the main ceremony.',
    answer: 'Haldi and mehendi photography captures the colour, laughter, décor, henna details, and family energy of Indian pre-wedding celebrations in Madurai.',
    image: photos.haldi,
    keywords: ['haldi photographer Madurai', 'mehendi photography Tamil Nadu', 'Indian pre-wedding ceremony photographer', 'haldi candid photos'],
    features: ['Bright editorial details', 'Candid family coverage', 'Henna and décor close-ups', 'Same-day highlight option'],
    deliverables: ['100+ edited images', 'Colourful detail gallery', 'Short social preview', 'Print-ready family moments'],
    gallery: [
      { src: photos.haldi, alt: 'Bride at a joyful Indian haldi ceremony' },
      { src: photos.details, alt: 'Henna and wedding jewellery details' },
      { src: photos.celebration, alt: 'Family celebrating a wedding' },
      { src: photos.portrait, alt: 'Bride portrait in traditional attire' },
    ],
    video: { title: 'Haldi celebration sample clip', description: 'A short Indian wedding celebration clip with colour and movement.', href: 'https://www.pexels.com/video/cultural-wedding-celebration-with-henna-art-29766214', poster: photos.haldi },
  },
  {
    slug: 'cinematic-wedding-films',
    shortTitle: 'Cinematic Films',
    title: 'Cinematic Wedding Films in 4K',
    eyebrow: 'Your Story, In Motion',
    description: 'A film with the sounds, movement, voices, and emotion of your wedding — edited with a cinematic eye and delivered to revisit for years.',
    answer: 'Deebi Wedding Stories creates cinematic wedding films in 4K with ceremony audio, family voices, natural sound, highlight edits, and full-day storytelling for couples in Tamil Nadu.',
    image: 'https://images.pexels.com/photos/3990404/pexels-photo-3990404.jpeg?auto=compress&cs=tinysrgb&w=1200',
    keywords: ['wedding videographer Madurai', 'cinematic wedding film Tamil Nadu', 'Indian wedding video', '4K wedding cinematography'],
    features: ['4K wedding cinematography', 'Highlight film edit', 'Ceremony and speech audio', 'Optional drone coverage'],
    deliverables: ['3–7 minute highlight film', 'Full ceremony film', 'Social media teaser', 'Private digital delivery'],
    gallery: [
      { src: photos.ceremony, alt: 'Wedding ceremony cinematic still' },
      { src: photos.celebration, alt: 'Wedding celebration cinematic still' },
      { src: photos.couple, alt: 'Couple cinematic portrait' },
      { src: photos.ritual, alt: 'Traditional ritual cinematic still' },
    ],
    video: { title: 'Indian wedding film sample', description: 'A short Indian wedding video clip selected as a visual reference.', href: 'https://www.pexels.com/video/people-during-indian-wedding-10805308', poster: photos.ceremony },
  },
];

export const serviceSlugs = services.map((service) => service.slug);

export function getService(slug: string) {
  return services.find((service) => service.slug === slug);
}

/** Adapts a real vendor product (VendorProduct: flat name/description/image/category
 *  columns + a free-form `customFields` JSON bag) into this design's own `Service`
 *  shape, so every existing component (Services grid, service detail page) keeps
 *  working completely untouched. The real Deebi Wedding Stories catalogue (seeded
 *  24-Sep-2026 via the real POST /cms/vendor/:id/products API) stores the full
 *  original package richness in customFields (slug/title/eyebrow/answer/keywords/
 *  features/deliverables/gallery/video) so the site renders with zero visual
 *  regression versus the old hardcoded fallback. */
export function adaptLiveService(p: {
  id: string; name: string; description: string | null; image: string | null;
  customFields: Record<string, unknown> | null;
}): Service {
  const cf = p.customFields ?? {};
  const asStringArray = (v: unknown): string[] | undefined =>
    Array.isArray(v) && v.length && v.every((x) => typeof x === 'string') ? (v as string[]) : undefined;
  const gallerySrcs = asStringArray(cf.gallery);
  const video = cf.video as Service['video'] | undefined;
  const fallbackImage = p.image || 'https://images.pexels.com/photos/1261731/pexels-photo-1261731.jpeg?auto=compress&cs=tinysrgb&w=1200';
  return {
    slug: typeof cf.slug === 'string' ? cf.slug : p.id,
    shortTitle: p.name,
    title: typeof cf.title === 'string' ? cf.title : p.name,
    eyebrow: typeof cf.eyebrow === 'string' ? cf.eyebrow : '',
    description: p.description || '',
    answer: typeof cf.answer === 'string' ? cf.answer : p.description || '',
    image: p.image || fallbackImage,
    keywords: asStringArray(cf.keywords) ?? [],
    features: asStringArray(cf.features) ?? [],
    deliverables: asStringArray(cf.deliverables) ?? [],
    gallery: gallerySrcs && gallerySrcs.length
      ? gallerySrcs.map((src) => ({ src, alt: p.name }))
      : [{ src: fallbackImage, alt: p.name }],
    video: video ?? { title: p.name, description: '', href: '', poster: fallbackImage },
  };
}

/** Real catalogue when the vendor has added packages; otherwise the original
 *  uploaded showcase data - so the site never looks broken/empty before packages
 *  are added, and never breaks if the API is briefly unreachable. */
export function resolveServices(site: { products: Parameters<typeof adaptLiveService>[0][] } | null): Service[] {
  if (!site || site.products.length === 0) return services;
  const adapted = site.products.map(adaptLiveService);
  // The API returns products newest-first; restore the original curated narrative
  // order (Wedding -> ... -> Cinematic Films) for the known seed slugs, appending
  // any newly-added service (not in the original curated set) at the end.
  const order = new Map(serviceSlugs.map((slug, i) => [slug, i]));
  return adapted.sort((a, b) => (order.get(a.slug) ?? Infinity) - (order.get(b.slug) ?? Infinity));
}

export function resolveService(
  site: { products: Parameters<typeof adaptLiveService>[0][] } | null,
  slug: string,
): Service | undefined {
  return resolveServices(site).find((s) => s.slug === slug);
}
