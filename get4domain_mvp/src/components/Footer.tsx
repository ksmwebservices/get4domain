import { Mail, Phone, MapPin } from 'lucide-react';
import Link from 'next/link';

const footerSections = [
  {
    title: 'Products',
    links: [
      { label: 'DomainCampaign', href: '/domain-campaign' },
      { label: 'DomainApp', href: '/domain-app' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About Us', href: '/about' },
      { label: 'Contact', href: '/contact' },
      { label: 'Support', href: '/support' },
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
      <div className="container-mx container-px py-16">
        <div className="grid gap-10 lg:grid-cols-12">
          {/* Brand */}
          <div className="lg:col-span-4">
            <Link href="/" className="flex items-center gap-2.5">
              <img src="/logo.png" alt="Get4Domain" className="h-9 w-auto object-contain brightness-0 invert" />
            </Link>
            <p className="mt-4 text-sm leading-relaxed max-w-xs">
              Professional Business Launch Made Easy. SaaS platform for Indian SMBs — websites, business management and managed digital marketing.
            </p>
            <div className="mt-6 space-y-2.5">
              <div className="flex items-center gap-2.5 text-sm">
                <Phone className="h-4 w-4 text-primary-400" />
                <span>+91 75500 47567</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm">
                <Mail className="h-4 w-4 text-primary-400" />
                <span>support@get4domain.com</span>
              </div>
              <div className="flex items-start gap-2.5 text-sm">
                <MapPin className="h-4 w-4 text-primary-400 mt-0.5 flex-shrink-0" />
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
                      <Link href={link.href} className="text-sm text-slate-400 transition-colors hover:text-primary-400">
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

      <div className="border-t border-slate-800">
        <div className="container-mx container-px py-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-slate-500">
              &copy; {new Date().getFullYear()} Get4Domain. All rights reserved.
            </p>
            <p className="text-xs text-slate-600">
              DomainApp · DomainCampaign · GST-Compliant Platform · Made in India 🇮🇳
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
