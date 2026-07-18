import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, Rocket, ArrowRight, Globe, BarChart3, Users, FileText, Package, Megaphone, CalendarCheck, Star } from 'lucide-react';
import PageHero from '@/components/PageHero';
import CTABanner from '@/components/CTABanner';
import Button from '@/components/ui/Button';
import { domainAppStartupFeatures, domainAppEnterpriseFeatures } from '@/data/content';

export const metadata: Metadata = {
  title: 'DomainApp — Business Operating System | Get4Domain',
  description: 'DomainApp is a complete Business OS for Indian SMBs. Website + CRM + HR + Accounting + Invoicing + Inventory — all in one subscription.',
};

const modules = [
  { icon: Globe, title: 'Professional Website', desc: 'Industry-specific website with CMS, blog, SEO, WhatsApp & lead forms. Your business online in days.' },
  { icon: Users, title: 'CRM & Leads', desc: 'Lead CRM, Customer CRM, Telecalling CRM. Track every enquiry from first contact to sale.' },
  { icon: FileText, title: 'GST Invoicing', desc: 'GST-compliant invoices, quotations, payment collection and outstanding management.' },
  { icon: BarChart3, title: 'Accounting', desc: 'Income, expense, cash book, bank book, P&L report. Know your numbers at all times.' },
  { icon: Users, title: 'HR & Payroll', desc: 'Employees, departments, attendance, leave, salary calculation, payslips and PF/ESI.' },
  { icon: Package, title: 'Inventory', desc: 'Product master, stock register, purchase, sales and low stock alerts.' },
  { icon: Megaphone, title: 'Marketing Tools', desc: 'Poster designer, festival posters, WhatsApp bot and AI chatbot built in.' },
  { icon: BarChart3, title: 'Reports Dashboard', desc: 'Sales, lead, employee, finance and marketing reports — all in one view.' },
];

const demoWebsites = [
  { name: 'MR Travels', industry: 'Travel & Tours', url: 'https://mrtravels.get4domain.com', image: 'https://images.pexels.com/photos/3601425/pexels-photo-3601425.jpeg?auto=compress&cs=tinysrgb&w=600', live: true },
  { name: 'CareWell Clinic', industry: 'Healthcare', url: '#', image: 'https://images.pexels.com/photos/263402/pexels-photo-263402.jpeg?auto=compress&cs=tinysrgb&w=600', live: false },
  { name: 'Spice Garden', industry: 'Restaurant', url: '#', image: 'https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg?auto=compress&cs=tinysrgb&w=600', live: false },
];

export default function DomainAppPage() {
  return (
    <>
      <PageHero
        eyebrow="DomainApp"
        title="Complete Business OS for Indian SMBs"
        description="One subscription. Professional website + CRM + HR + Accounting + Invoicing + Inventory. Everything your business needs, in one platform."
        breadcrumbs={[{ label: 'DomainApp' }]}
      />

      {/* Modules grid */}
      <section className="section-py">
        <div className="container-mx container-px">
          <div className="mb-12 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary-600 mb-2">What's Inside</p>
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Every Module Your Business Needs</h2>
            <p className="mt-3 text-slate-600 max-w-xl mx-auto">DomainApp Enterprise includes all modules below. DomainApp Startup includes Website, Lead Forms, Basic CRM and WhatsApp.</p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {modules.map((mod) => {
              const Icon = mod.icon;
              return (
                <div key={mod.title} className="card-base p-6 group card-hover">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 group-hover:bg-primary-100 transition-colors">
                    <Icon className="h-5 w-5 text-primary-600" />
                  </div>
                  <h3 className="mb-2 text-base font-bold text-slate-900">{mod.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{mod.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="section-py bg-slate-50">
        <div className="container-mx container-px">
          <div className="mb-12 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary-600 mb-2">Plans</p>
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">DomainApp Plans</h2>
          </div>
          <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-2">
            {/* Startup */}
            <div className="card-base p-8">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xl font-bold text-slate-900">Startup</h3>
                </div>
                <p className="text-sm text-slate-500">Perfect for businesses that need a professional website and basic tools to capture leads.</p>
                <div className="mt-4 flex items-end gap-2">
                  <span className="text-3xl font-bold text-slate-900">₹6,999</span>
                  <span className="text-slate-400 mb-1">/ year</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">or ₹3,999 for 6 months</p>
              </div>
              <ul className="space-y-2.5 mb-8">
                {domainAppStartupFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <Check className="h-4 w-4 text-success-500 mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/book-demo">
                <Button variant="outline" fullWidth leftIcon={<CalendarCheck className="h-4 w-4" />}>Book Demo for Startup</Button>
              </Link>
            </div>

            {/* Enterprise */}
            <div className="relative card-base border-2 border-primary-400 p-8 shadow-premium overflow-hidden">
              <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-primary-600 to-primary-500 py-1.5 text-center">
                <span className="text-xs font-bold text-white uppercase tracking-wider">Most Popular</span>
              </div>
              <div className="mt-5 mb-6">
                <h3 className="text-xl font-bold text-slate-900">Enterprise</h3>
                <p className="text-sm text-slate-500 mt-1">Full Business OS — website, CRM, HR, accounting, inventory and everything in between.</p>
                <div className="mt-4 flex items-end gap-2">
                  <span className="text-3xl font-bold text-slate-900">₹24,999</span>
                  <span className="text-slate-400 mb-1">/ year</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">or ₹13,999 for 6 months</p>
              </div>
              <ul className="space-y-2.5 mb-8">
                {domainAppEnterpriseFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <Check className="h-4 w-4 text-success-500 mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/book-demo">
                <Button fullWidth leftIcon={<CalendarCheck className="h-4 w-4" />}>Book Demo for Enterprise</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Live Demo Websites */}
      <section className="section-py">
        <div className="container-mx container-px">
          <div className="mb-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary-600 mb-2">See It Live</p>
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Real Businesses Built on DomainApp</h2>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {demoWebsites.map((site) => (
              <div key={site.name} className="card-base card-hover overflow-hidden group">
                <div className="relative h-48 overflow-hidden">
                  <img src={site.image} alt={site.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 to-transparent" />
                  <div className="absolute top-3 right-3">
                    {site.live ? (
                      <span className="flex items-center gap-1.5 rounded-full bg-success-500 px-2.5 py-1 text-xs font-semibold text-white">
                        <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                        Live
                      </span>
                    ) : (
                      <span className="rounded-full bg-white/20 backdrop-blur-sm px-2.5 py-1 text-xs text-white">Coming Soon</span>
                    )}
                  </div>
                  <div className="absolute bottom-3 left-3">
                    <div className="text-base font-bold text-white">{site.name}</div>
                    <div className="text-xs text-white/70">{site.industry}</div>
                  </div>
                </div>
                <div className="p-4">
                  {site.live ? (
                    <a href={site.url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" fullWidth variant="outline" rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>
                        Visit Live Site
                      </Button>
                    </a>
                  ) : (
                    <Link href="/book-demo">
                      <Button size="sm" fullWidth variant="ghost">Request Demo for This Industry</Button>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTABanner />
    </>
  );
}
