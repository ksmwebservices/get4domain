import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, ArrowRight } from 'lucide-react';
import Faq from '@/components/marketing/Faq';

export const metadata: Metadata = {
  title: 'DomainApp — Industry Website + Business Workspace + AI Studio',
  description: 'DomainApp is everything in one plan at ₹999/month — a professional industry website, business workspace (CRM, invoicing, records), campaigns and AI Studio with ₹499 free credit.',
  alternates: { canonical: 'https://get4domain.com/domain-app' },
};

const FEATURES = [
  { icon: '👥', title: 'Contacts & CRM', desc: 'Every customer, lead and vendor in one place — labelled for your industry.' },
  { icon: '📦', title: 'Catalog & Products', desc: 'Your packages, menu, services or rooms — a catalog that fits your business.' },
  { icon: '🗂️', title: 'Records & Transactions', desc: 'Bookings, orders, appointments, enrolments — your core workflow, tracked.' },
  { icon: '🧾', title: 'GST Invoicing & Payments', desc: 'GST-compliant invoices, payment links and collection built in.' },
  { icon: '📊', title: 'Accounts & Reports', desc: 'Income, expenses, P&L and GST summaries — know your numbers.' },
  { icon: '🧑‍💼', title: 'HR & Payroll', desc: 'Employees, attendance, leave and salary — an optional addon.' },
  { icon: '🎨', title: 'Design Studio', desc: 'Letterheads, ID cards, quotes and posters, on brand.' },
  { icon: '🌐', title: 'Website & CMS', desc: 'A professional industry website you can edit anytime.' },
];

const INDUSTRIES = ['🚗 Travel', '🍽️ Restaurant', '🏥 Clinic', '🏨 Hotel', '💇 Salon', '🏋️ Gym', '🏠 Real Estate', '🎓 Education', '🛒 Retail', '🏗️ Construction', '📸 Photography', '🚚 Logistics'];

const ADDONS = ['Fleet Management', 'Driver Management', 'Table Management', 'Appointment Scheduling', 'Inventory Management', 'Room Management', 'Batch Management', 'Project Management'];

const FAQS = [
  { q: 'What does DomainApp actually do?', a: 'DomainApp is a business workspace: it manages your contacts, catalog, records (bookings/orders/appointments), GST invoicing and basic accounts, plus a professional website — all adapted to your industry. Optional addons extend it with HR, fleet, inventory and more.' },
  { q: 'Is it different for my industry?', a: 'Yes. The workspace is configured per industry — a travel agency sees Bookings, Fleet and Drivers; a restaurant sees Orders, Tables and Menu; a clinic sees Appointments, Patients and Doctors. Same reliable engine underneath, tailored on top.' },
  { q: 'Do I get a real website?', a: 'Yes — a professional website built with your business name, services and photos, with an easy CMS so you can update content yourself. Not a generic drag-and-drop template.' },
  { q: 'What are addons?', a: 'Addons are optional modules you enable on top of core DomainApp — like Fleet, Driver, Table Management or Inventory. They add extra tools without duplicating your core data, and are billed separately per your needs.' },
];

export default function DomainAppPage() {
  return (
    <>
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-4 pb-8 pt-16 text-center sm:px-6 md:pt-24 lg:px-8">
          <div className="text-4xl">📋</div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 md:text-6xl">DomainApp — Your Business Workspace</h1>
          <p className="mt-5 text-lg text-slate-600">Website, operations, CRM, invoicing, HR — everything to run your business digitally. Adapted to your industry.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/book-demo?product=app" className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700">Book Demo <ArrowRight className="h-4 w-4" /></Link>
            <Link href="/pricing" className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-6 py-3 font-medium text-slate-700 hover:bg-slate-50">See Pricing</Link>
          </div>
        </div>
      </section>

      {/* Feature sections */}
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Everything in one workspace</h2>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="text-2xl">{f.icon}</div>
                <h3 className="mt-3 text-base font-bold text-slate-900">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Industry carousel */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900">Works for 20+ industries</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {INDUSTRIES.map((i) => (
              <span key={i} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">{i}</span>
            ))}
          </div>
          <Link href="/industries" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700">View all industries <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>

      {/* Pricing + addons */}
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-md rounded-2xl border-2 border-blue-500 bg-white p-8 text-center shadow-md">
            <span className="inline-block rounded-full bg-blue-600 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">All-in-One</span>
            <h3 className="mt-3 text-xl font-bold text-slate-900">DomainApp</h3>
            <p className="mt-2 text-4xl font-bold text-slate-900">₹999<span className="text-base font-normal text-slate-400">/month</span></p>
            <p className="mt-1 text-sm text-slate-500">Everything included · Cancel anytime</p>
            <p className="mt-3 text-sm text-slate-600">Industry website + Workplace + CRM/TeleCRM + Campaigns + AI Studio (₹499 free credit)</p>
          </div>

          <div className="mt-12">
            <h3 className="text-center text-xl font-bold text-slate-900">Extend with industry-specific addons</h3>
            <div className="mt-6 flex flex-wrap justify-center gap-2.5">
              {ADDONS.map((a) => (
                <span key={a} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"><Check className="h-3.5 w-3.5 text-emerald-500" />{a}</span>
              ))}
            </div>
          </div>

          <div className="mt-10 text-center">
            <Link href="/book-demo?product=app" className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700">Book Demo <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>

      <Faq items={FAQS} title="DomainApp — People Also Ask" />
    </>
  );
}
