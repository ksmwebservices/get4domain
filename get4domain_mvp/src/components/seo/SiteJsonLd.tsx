/**
 * Get4Domain's own structured data (Organization, WebSite, SoftwareApplication). Rendered by the marketing layout only, so it appears on
 * get4domain.com pages and never on a vendor's site, a LeadSpace page or an app screen (it used to sit in the root layout and reached all of them).
 *
 * Deliberately absent until there is a V3 source for them: prices and offers (no plan or price is stated), and `sameAs`.
 * TODO(owner): add `sameAs` once the real company profile URLs (LinkedIn, X, Instagram, YouTube, ...) are supplied. An empty list says nothing.
 * TODO(owner): `foundingDate` below is the value that was already live; confirm it matches the About page.
 * There is no SearchAction: /industries ignores `?q=`, so a sitelinks search box would point at a search that does not exist.
 */
const ORGANIZATION = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Get4Domain',
  legalName: 'KSM Quantum Technologies',
  url: 'https://get4domain.com',
  logo: 'https://get4domain.com/logo.png',
  description: "India's complete digital business platform for SMBs",
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Tidel Park, 1st Floor D Block',
    addressLocality: 'Tharamani, Chennai',
    addressRegion: 'Tamil Nadu',
    postalCode: '600113',
    addressCountry: 'IN',
  },
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'support@get4domain.com',
    contactType: 'customer support',
    availableLanguage: ['English', 'Tamil'],
    hoursAvailable: 'Mo-Sa 09:00-20:00',
  },
  foundingDate: '2026',
};

const SOFTWARE_APPLICATION = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Get4Domain',
  description: 'A professional website for your business, built fast, with the tools to capture leads, take bookings and grow.',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  provider: { '@type': 'Organization', name: 'KSM Quantum Technologies', url: 'https://get4domain.com', logo: 'https://get4domain.com/logo.png' },
};

const WEBSITE = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Get4Domain',
  url: 'https://get4domain.com',
  inLanguage: 'en-IN',
  publisher: { '@type': 'Organization', name: 'Get4Domain' },
};

export default function SiteJsonLd() {
  return (
    <>
      {[ORGANIZATION, SOFTWARE_APPLICATION, WEBSITE].map((block) => (
        <script key={block['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }} />
      ))}
    </>
  );
}
