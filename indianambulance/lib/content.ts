import { cache } from 'react';
import { getConnected, pickList, pickSocial, pickText, seoOf, type ConnectedPage, type ConnectedSite } from './site-connect';

/**
 * What the page shows. The service's own wording (exactly as exported) is the default, so with the vendor not connected the site is what it always was. With the vendor
 * connected, words, pictures, links and contact details come from their site document (Website Manager) wherever the vendor has written something.
 * Design, layout, colours and animations are not touched here.
 */
export const SUBDOMAIN = 'indianambulance';
const NL = String.fromCharCode(10);

export const DEFAULT_NAME = 'Indian Ambulance';
export const DEFAULT_TAGLINE = 'Emergency and patient transport assistance, available 24 hours.';
export const DEFAULT_ABOUT = 'Indian Ambulance provides ambulance and patient transportation services in Tindivanam. Contact our team to discuss your transport requirements and the appropriate service for your situation.';
export const DEFAULT_PHONE = '+918490045502';
const DEFAULT_PHONE_DISPLAY = '+91 84900 45502';
export const DEFAULT_ADDRESS = '4, East Coast Road, Sangeevirayan, Pettai, Tindivanam, Tamil Nadu 604001.';
export const DEFAULT_MAPS = 'https://www.google.com/maps/search/?api=1&query=4%2C+East+Coast+Road%2C+Sangeevirayan%2C+Pettai%2C+Tindivanam%2C+Tamil+Nadu+604001';
export const DEFAULT_LOGO = '/indian-ambulance-logo.png';
export const DEFAULT_HERO_IMAGE = 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-U6SWdIBgGQv7pkynqGABwS7pWhWNof.png';
export const DEFAULT_HOURS = 'Open 24 hours';
export const DEFAULT_SEO_TITLE = 'Indian Ambulance | 24 Hours Service in Tindivanam';
export const DEFAULT_SEO_DESC = 'Indian Ambulance provides 24-hour emergency, ICU, patient, wheelchair, stretcher, and interfacility transport services in Tindivanam, Tamil Nadu.';
export const DEFAULT_KEYWORDS = ['Indian Ambulance', 'ambulance service Tindivanam', '24 hours ambulance', 'ICU ambulance Tamil Nadu', 'patient transport Tindivanam'];
export const DEFAULT_GALLERY: PhotoOut[] = [
  { src: DEFAULT_HERO_IMAGE, alt: 'Red Indian Ambulance vehicle parked outside' },
  { src: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-Q5pbmlXzGVCquEMMh2EiGvjodAKpzm.png', alt: 'White ambulance vehicle from the front' },
];
export const DEFAULT_SERVICES: ServiceOut[] = [
  { name: 'Critical / ICU Ambulance', description: 'Advanced transport support for patients who need close medical attention.' },
  { name: 'Emergency Transport', description: 'Reliable ambulance assistance for urgent patient movement.' },
  { name: 'Interfacility Transport', description: 'Safe transfers between hospitals, clinics, and care facilities.' },
  { name: 'International Medical Transport', description: 'Enquire about coordinated medical travel requirements.' },
  { name: 'Non-Emergency Transport', description: 'Comfortable transport for planned appointments and care.' },
  { name: 'Paramedic Intercept', description: 'Ask our team about paramedic support for your situation.' },
  { name: 'Pet / Veterinary Ambulance', description: 'Transport support for pets and veterinary care needs.' },
  { name: 'Special Event Medical Standby', description: 'Medical standby planning for events and gatherings.' },
  { name: 'Stretcher Transport', description: 'Patient movement support with stretcher transport arrangements.' },
  { name: 'Transplant Transport Services', description: 'Discuss time-sensitive transplant transport requirements.' },
  { name: 'Wheelchair Transport', description: 'Accessible transport assistance for wheelchair users.' },
];

export interface PhotoOut { src: string; alt: string }
export interface ServiceOut { name: string; description: string }
export interface SocialOut { key: string; label: string; href: string }
export interface Content {
  connected: boolean; preview: boolean;
  name: string;
  /** how the business greets in a WhatsApp message: the exported text says "Indian Ambulance Service" */
  greetName: string;
  /** true while the name is the exported one: the hero headline keeps its original two-colour markup */
  defaultName: boolean;
  logo: string;
  tagline: string;
  about: string;
  phone: { display: string; tel: string };
  /** digits only, for wa.me links */
  whatsapp: string;
  address: string;
  mapHref: string;
  /** "Open 24 hours" and its small line, as two strings */
  hoursTitle: string;
  hoursSub: string;
  /** the exported hours block is drawn as it was while the owner has not written their own hours */
  defaultHours: boolean;
  heroImage: string;
  photos: PhotoOut[];
  services: ServiceOut[];
  social: SocialOut[];
  pages: ConnectedPage[];
  seo: { title: string; description: string; keywords: string[]; image: string; noindex: boolean; favicon: string };
}

const digits = (s: string): string => s.replace(/[^0-9]/g, '');

export function buildContent(site: ConnectedSite | null): Content {
  const connected = !!site && site.connected;
  const name = pickText(site, 'businessName', DEFAULT_NAME) || DEFAULT_NAME;
  const phoneRaw = pickText(site, 'phone', DEFAULT_PHONE);
  const waRaw = pickText(site, 'whatsapp', phoneRaw) || phoneRaw;
  const address = pickText(site, 'address', DEFAULT_ADDRESS).split(NL).filter(Boolean).join(', ');
  const customAddress = connected && address !== '' && address !== DEFAULT_ADDRESS;
  const maps = connected && site ? site.values.googleMaps : '';
  const hours = pickText(site, 'businessHours', DEFAULT_HOURS);
  const defaultHours = hours === DEFAULT_HOURS;
  const [hoursTitle, ...hoursRest] = hours.split(NL).map((l) => l.trim()).filter(Boolean);
  const mine: PhotoOut[] = (site ? site.gallery : []).map((p) => ({ src: p.src, alt: p.alt || p.title || name }));
  const photos = pickList<PhotoOut>(site, 'portfolio', mine, DEFAULT_GALLERY);
  const myServices: ServiceOut[] = (site ? site.items : []).map((i) => ({ name: i.name, description: i.description }));
  // the services are the vendor's own items once they have any; until then the exported list stays
  const services = connected && site && site.items.length > 0 ? myServices : DEFAULT_SERVICES;
  const social = pickSocial(site, []).filter((l) => l.key !== 'whatsapp' && l.key !== 'maps');
  const pages = connected && site ? site.pages.slice(0, Math.max(0, site.pagesLimit - 1)) : [];
  const seo = seoOf(site, { title: DEFAULT_SEO_TITLE, description: DEFAULT_SEO_DESC, image: DEFAULT_LOGO });
  return {
    connected, preview: !!site?.preview,
    name, greetName: name === DEFAULT_NAME ? 'Indian Ambulance Service' : name, defaultName: name === DEFAULT_NAME,
    logo: pickText(site, 'logo', DEFAULT_LOGO) || DEFAULT_LOGO,
    tagline: pickText(site, 'tagline', DEFAULT_TAGLINE),
    about: pickText(site, 'about', DEFAULT_ABOUT),
    phone: { display: phoneRaw === DEFAULT_PHONE ? DEFAULT_PHONE_DISPLAY : phoneRaw, tel: phoneRaw.replace(/[^0-9+]/g, '') },
    whatsapp: digits(waRaw),
    address: customAddress ? address : DEFAULT_ADDRESS,
    mapHref: maps || (customAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : DEFAULT_MAPS),
    hoursTitle: defaultHours ? DEFAULT_HOURS : hoursTitle || '',
    hoursSub: defaultHours ? 'Every day' : hoursRest.join(', '),
    defaultHours,
    heroImage: pickText(site, 'banner', DEFAULT_HERO_IMAGE) || DEFAULT_HERO_IMAGE,
    photos, services, social, pages,
    seo: { title: seo.title, description: seo.description, keywords: seo.keywords ? seo.keywords.split(',').map((k) => k.trim()).filter(Boolean) : DEFAULT_KEYWORDS, image: seo.image, noindex: seo.noindex, favicon: pickText(site, 'favicon', '') },
  };
}

export const getContent = cache(async (): Promise<Content> => buildContent(await getConnected(SUBDOMAIN)));
