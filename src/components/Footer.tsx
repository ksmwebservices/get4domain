import { Rocket, Facebook, Twitter, Instagram, Linkedin, Youtube, Mail, Phone, MapPin } from 'lucide-react';
import Link from 'next/link';

const footerSections = [
  {
    title: 'Products',
    links: [
      { label: 'DomainApp — Startup', href: '/domain-app' },
      { label: 'DomainApp — Enterprise', href: '/domain-app' },
      { label: 'DomainCampaign — Starter', href: '/domain-campaign' },
      { label: 'DomainCampaign — Business', href: '/domain-campaign' },
      { label: 'View All Pricing', href: '/pricing' },
    ],
  },
  {
    title: 'Industries',
    links: [
      { label: 'Restaurant & Food', href: '/industries' },
      { label: 'Travel & Tours', href: '/industries' },
      { label: 'Clinic & Hospital', href: '/industries' },
      { label: 'School & College', href: '/industries' },
      { label: 'View All 20+ Industries', href: '/industries' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Portfolio', href: '/portfolio' },
      { label: 'How It Works', href: '/how-it-works' },
      { label: 'Book a Demo', href: '/book-demo' },
      { label: 'Contact Us', href: '/contact' },
      { label: 'Support', href: '/support' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms & Conditions', href: '/terms' },
      { label: 'Privacy Policy', href: '/privacy-policy' },
      { label: 'Refund Policy', href: '/refund-policy' },
    ],
  },
];

const socialLinks = [
  { icon: Facebook, label: 'Facebook' },
  { icon: Instagram, label: 'Instagram' },
  { icon: Linkedin, label: 'LinkedIn' },
  { icon: Youtube, label: 'YouTube' },
  { icon: Twitter, label: 'Twitter' },
];

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-400">
      <div className="container-mx container-px py-16">
        <div className="grid gap-10 lg:grid-cols-12">
          {/* Brand */}
          <div className="lg:col-span-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-primary-500 shadow-md">
                <Rocket className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold text-white">
                Get4<span className="text-primary-400">Domain</span>
              </span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed max-w-xs">
              Professional Business Launch Made Easy. SaaS platform for Indian SMBs — websites, business management and managed digital marketing.
            </p>
            <div className="mt-6 space-y-2.5">
              <div className="flex items-center gap-2.5 text-sm">
                <Phone className="h-4 w-4 text-primary-400" />
                <span>+91 98765 43210</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm">
                <Mail className="h-4 w-4 text-primary-400" />
                <span>hello@get4domain.in</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm">
                <MapPin className="h-4 w-4 text-primary-400" />
                <span>Chennai, Tamil Nadu, India</span>
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href="#"
                    aria-label={social.label}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-slate-400 transition-colors hover:bg-primary-600 hover:text-white"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Links */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:col-span-8">
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
