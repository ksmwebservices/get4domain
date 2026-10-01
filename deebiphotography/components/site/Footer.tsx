import { Camera, Mail, Phone, MapPin, Instagram, Facebook, Youtube, Heart } from 'lucide-react';

const WHATSAPP_NUMBER = '919566621288';

const quickLinks = [
  { label: 'Home', href: '#home' },
  { label: 'About', href: '#about' },
  { label: 'Services', href: '#services' },
  { label: 'Portfolio', href: '#portfolio' },
  { label: 'Stories', href: '#testimonials' },
  { label: 'Contact', href: '#contact' },
];

const serviceLinks = [
  'Wedding Photography',
  'Cinematic Films',
  'Pre-Wedding Shoots',
  'Post-Wedding Films',
  'Mehendi & Haldi',
  'Reception Coverage',
];

export default function Footer() {
  return (
    <footer className="relative border-t border-gold/20 bg-ink pt-16 pb-28 md:pb-10 px-5 sm:px-8">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-px bg-gold" />

      <div className="max-w-7xl mx-auto">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full border border-gold/60 flex items-center justify-center">
                <Camera className="w-5 h-5 text-gold" />
              </div>
              <div>
                <p className="font-cinzel text-lg tracking-[0.2em] text-cream font-semibold">DEEBI</p>
                <p className="text-[10px] tracking-[0.35em] text-gold/80 uppercase mt-0.5">Wedding Stories</p>
              </div>
            </div>
            <p className="text-warm/50 text-sm leading-relaxed mb-4">
              Crafting timeless visual stories for Indian weddings. Based in Madurai, travelling wherever love leads.
            </p>
            <div className="flex gap-3">
              {[
                { icon: Instagram, href: '#' },
                { icon: Facebook, href: '#' },
                { icon: Youtube, href: '#' },
              ].map((social, i) => (
                <a
                  key={i}
                  href={social.href}
                  className="w-9 h-9 rounded-full border border-white/15 flex items-center justify-center text-warm/60 hover:border-gold hover:text-gold transition-all"
                >
                  <social.icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-cinzel text-gold text-xs tracking-[0.3em] uppercase mb-4">Quick Links</h4>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-warm/50 text-sm hover:text-gold transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-cinzel text-gold text-xs tracking-[0.3em] uppercase mb-4">Services</h4>
            <ul className="space-y-2">
              {serviceLinks.map((link) => (
                <li key={link}>
                  <a
                    href="#services"
                    className="text-warm/50 text-sm hover:text-gold transition-colors"
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-cinzel text-gold text-xs tracking-[0.3em] uppercase mb-4">Contact</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-warm/50 text-sm">
                <MapPin className="w-4 h-4 text-gold/60 flex-shrink-0 mt-0.5" />
                <span>Surya Nagar, Madurai, Tamil Nadu</span>
              </li>
              <li>
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 text-warm/50 text-sm hover:text-gold transition-colors"
                >
                  <Phone className="w-4 h-4 text-gold/60 flex-shrink-0 mt-0.5" />
                  <span>+91 95666 21288</span>
                </a>
              </li>
              <li>
                <a
                  href="mailto:click@deebi.com"
                  className="flex items-start gap-3 text-warm/50 text-sm hover:text-gold transition-colors"
                >
                  <Mail className="w-4 h-4 text-gold/60 flex-shrink-0 mt-0.5" />
                  <span>click@deebi.com</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-warm-dark text-xs text-center sm:text-left">
            © {new Date().getFullYear()} Deebi Wedding Stories. Owned by Boopathi Raja R. All rights reserved.
          </p>
          <p className="text-warm-dark text-xs flex items-center gap-1.5">
            Crafted with <Heart className="w-3 h-3 text-gold fill-gold" /> in Madurai
          </p>
        </div>
      </div>
    </footer>
  );
}
