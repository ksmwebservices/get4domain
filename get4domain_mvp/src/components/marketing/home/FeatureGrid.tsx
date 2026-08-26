import { MessageCircle, Bot, BarChart3, CreditCard, Bell, Users, Megaphone, Sparkles, type LucideIcon } from 'lucide-react';

// Real platform capabilities (recolored from the Bolt reference's features.ts;
// content kept honest — no overclaimed "unlimited" promises).
interface Feature { id: string; title: string; description: string; icon: LucideIcon; accent: string; details: string[]; }

const FEATURES: Feature[] = [
  { id: 'comm-hub', title: 'Communication Hub', description: 'WhatsApp Business API (no monthly platform fee), transactional & promotional SMS, and email — all from one inbox.', icon: MessageCircle, accent: 'from-primary-400 to-primary-600', details: ['WhatsApp Business API', 'Transactional SMS', 'Promotional SMS', 'Email campaigns'] },
  { id: 'ai-studio', title: 'AI Studio', description: 'Create promotional reels, posters, captions and marketing content with AI. Usage is pay-per-use from your wallet.', icon: Bot, accent: 'from-warning-400 to-warning-600', details: ['Reel maker', 'Poster designer', 'Content & captions', 'Wallet pay-per-use'] },
  { id: 'operations', title: 'Business Operations', description: 'Tasks, bookings, appointments and POS — run your whole operation from the Workplace dashboard.', icon: BarChart3, accent: 'from-success-400 to-success-600', details: ['Task management', 'Bookings & appointments', 'Point of sale', 'Staff scheduling'] },
  { id: 'payments', title: 'Online Payments', description: 'Accept UPI, cards and net-banking with GST invoicing built in. Auto receipts and payment links.', icon: CreditCard, accent: 'from-secondary-400 to-secondary-600', details: ['UPI & cards', 'GST invoicing', 'Auto receipts', 'Payment links'] },
  { id: 'notifications', title: 'Smart Notifications', description: 'Real-time alerts for every lead, task, booking and payment — so nothing slips through.', icon: Bell, accent: 'from-error-400 to-error-600', details: ['Lead alerts', 'Task reminders', 'Booking updates', 'Payment confirmations'] },
  { id: 'crm', title: 'CRM + TeleCRM', description: 'Manage leads, follow-ups and customers through a clear pipeline — with calling and call records.', icon: Users, accent: 'from-primary-400 to-primary-600', details: ['Lead pipeline', 'Follow-up reminders', 'Call records', 'Customer history'] },
  { id: 'growth', title: 'Growth Hub & Campaigns', description: 'Build campaign landing pages, generate a shareable link, and track results — no paid distribution required to start.', icon: Megaphone, accent: 'from-warning-400 to-secondary-500', details: ['Campaign pages', 'Shareable link', 'Audience segments', 'Result tracking'] },
  { id: 'website', title: 'Industry Website', description: 'A lead-generation website on your subdomain with hosting, CDN and SSL — enquiry, WhatsApp and call CTAs built in.', icon: Sparkles, accent: 'from-success-400 to-primary-500', details: ['Subdomain + hosting', 'SSL + CDN', 'Enquiry forms', 'WhatsApp & call CTA'] },
];

export default function FeatureGrid() {
  return (
    <section id="features" className="relative py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/5 bg-slate-800/60 px-3.5 py-1.5 text-xs font-medium text-primary-300 backdrop-blur-xl">
            Everything included
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            One platform. <span className="text-gradient-hero">Every tool you need.</span>
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-slate-400">
            From communication to operations to marketing — Get4Domain replaces a stack of separate apps with one unified platform for ₹999/month.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.id} className="group relative rounded-2xl border border-white/5 bg-slate-800/60 p-5 backdrop-blur-xl transition-all duration-300 hover:border-primary-400/20 hover:shadow-glow">
                <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${f.accent} transition-transform duration-300 group-hover:scale-110`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="mb-1.5 text-base font-semibold text-white">{f.title}</h3>
                <p className="mb-3 text-sm leading-relaxed text-slate-400">{f.description}</p>
                <ul className="space-y-1">
                  {f.details.map((d) => (
                    <li key={d} className="flex items-center gap-1.5 text-[11px] text-slate-300">
                      <span className="h-1 w-1 rounded-full bg-primary-400" />
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
