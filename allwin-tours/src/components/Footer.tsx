import Link from 'next/link';
import { BUSINESS, NAV_LINKS } from '@/lib/constants';

const SERVICE_LINKS = [
  'Pilgrimage Tours',
  'Airport Transfers',
  'Wedding Transport',
  'Corporate Trips',
  'Cab Rentals',
];

export default function Footer() {
  return (
    <footer className="bg-bg-dark border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 py-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
        <div>
          <div className="flex items-center gap-2 font-bold text-lg text-white mb-3">
            <img
              src="/logo.png"
              alt="Allwin Tours & Travels"
              className="h-20 w-auto object-contain brightness-0 invert"
            />
            <span>{BUSINESS.name}</span>
          </div>
          <p className="text-sm text-text-grey">
            Premium travel services from Cuddalore, Tamil Nadu. Safe, comfortable and
            reliable journeys.
          </p>
          <div className="flex items-center gap-4 mt-5 text-xl">
            <a
              href={`https://wa.me/${BUSINESS.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              className="hover:text-accent transition-colors"
            >
              💬
            </a>
            <a href="#" aria-label="Facebook" className="hover:text-accent transition-colors">
              📘
            </a>
            <a href="#" aria-label="Instagram" className="hover:text-accent transition-colors">
              📷
            </a>
            <a href="#" aria-label="YouTube" className="hover:text-accent transition-colors">
              ▶️
            </a>
          </div>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-4">Quick Links</h4>
          <ul className="space-y-2">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-text-grey hover:text-accent transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <a
                href="https://get4domain.com/login"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-text-grey hover:text-accent transition-colors"
              >
                Vendor Login
              </a>
            </li>
            <li>
              <a
                href="https://get4domain.com/login"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-text-grey hover:text-accent transition-colors"
              >
                Customer Login
              </a>
            </li>
            <li>
              <a
                href="https://get4domain.com/login"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-text-grey hover:text-accent transition-colors"
              >
                Staff Login
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-4">Services</h4>
          <ul className="space-y-2">
            {SERVICE_LINKS.map((s) => (
              <li key={s} className="text-sm text-text-grey">
                {s}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-4">Contact</h4>
          <ul className="space-y-3 text-sm text-text-grey">
            <li className="flex items-start gap-2">
              <span>📍</span>
              <span>{BUSINESS.location}</span>
            </li>
            <li className="flex items-center gap-2">
              <span>📞</span>
              <a href={`tel:${BUSINESS.phone}`} className="hover:text-accent transition-colors">
                {BUSINESS.phone}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <span>💬</span>
              <a
                href={`https://wa.me/${BUSINESS.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-accent transition-colors"
              >
                WhatsApp: {BUSINESS.phone}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <span>🕐</span>
              <span>24 Hours · 7 Days</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 py-6 text-center text-xs text-text-grey px-4">
        © 2026 {BUSINESS.name}. All rights reserved. | Powered by Get4Domain
      </div>
    </footer>
  );
}
