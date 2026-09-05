import { Mail, MapPin, ArrowRight } from 'lucide-react';
import Link from 'next/link';

// Managed Growth Services are an optional add-on — footer/dashboard-only, never
// hero/pricing-prominent (PRODUCT_DIRECTION_FINAL §18–19, §28). Requested for
// scope review via the demo form.
const MANAGED_HREF = '/book-demo?service=managed-growth';
const MANAGED_SERVICES = ['SEO', 'Google Business Profile', 'Social Media', 'Content', 'Campaigns', 'Paid Ads', 'GEO', 'AEO'];

const footerSections = [
  {
    title: 'Platform',
    links: [
      { label: 'DomainApp', href: '/domain-app' },
      { label: 'Industries', href: '/industries' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'AI Studio', href: '/pricing' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About Us', href: '/about' },
      { label: 'Contact', href: '/contact' },
      { label: 'Support', href: '/support' },
      { label: 'Managed Services', href: MANAGED_HREF },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/privacy-policy' },
      { label: 'Terms of Use', href: '/terms' },
      { label: 'Refund Policy', href: '/refund-policy' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-400">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-12">
          {/* Brand */}
          <div className="lg:col-span-4">
            <Link href="/" className="flex items-center gap-2.5">
              <img
                src="/logo.png"
                alt="Get4Domain"
                className="h-16 w-auto object-contain"
                style={{ filter: 'brightness(0) invert(1)' }}
              />
            </Link>
            <p className="mt-4 text-sm font-semibold text-white">Your Online Identity Partner</p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed">
              Build, manage and grow your complete online business identity.
            </p>
            <div className="mt-6 space-y-2.5">
              <div className="flex items-center gap-2.5 text-sm">
                <Mail className="h-4 w-4 text-blue-400" />
                <a href="mailto:support@get4domain.com" className="hover:text-blue-400">support@get4domain.com</a>
              </div>
              <div className="flex items-start gap-2.5 text-sm">
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-400" />
                <span>Tidel Park, 1st Floor D Block, Tharamani, Chennai - 600113</span>
              </div>
            </div>
          </div>

          {/* Links */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-8">
            {footerSections.map((section) => (
              <div key={section.title}>
                <h4 className="mb-4 text-sm font-semibold text-white">{section.title}</h4>
                <ul className="space-y-2.5">
                  {section.links.map((link) => (
                    <li key={link.label}>
                      <Link href={link.href} className="text-sm text-slate-400 transition-colors hover:text-blue-400">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Managed Growth Services — optional add-on, intentionally secondary */}
      <div className="border-t border-slate-800">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-800/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-300">Managed Growth Services</p>
              <p className="mt-1 text-xs text-slate-500">
                Prefer we do it for you? {MANAGED_SERVICES.join(' · ')}
              </p>
            </div>
            <Link href={MANAGED_HREF} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-blue-400/40 hover:text-blue-400">
              Explore Managed Services <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-800">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-slate-500">
              &copy; {new Date().getFullYear()} Get4Domain by KSM Quantum Technologies. All rights reserved.
            </p>
            <p className="text-xs text-slate-600">Made in India 🇮🇳 | GST Compliant</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
