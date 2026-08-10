import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { INDUSTRIES } from '@/data/industries-list';

export const metadata: Metadata = {
  title: '20+ Industry Solutions — Restaurant, Travel, Clinic & More',
  description: 'Get4Domain serves 20+ industries with industry-specific workspaces. Your dashboard speaks your business language — Bookings, Orders, Appointments, and more.',
  alternates: { canonical: 'https://get4domain.com/industries' },
};

export default function IndustriesPage() {
  return (
    <>
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-4 pb-8 pt-16 text-center sm:px-6 md:pt-24 lg:px-8">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-6xl">Built for Every Industry</h1>
          <p className="mt-4 text-lg text-slate-600">20+ industry configurations. Your workspace speaks your business language.</p>
        </div>
      </section>

      <section className="pb-16 md:pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {INDUSTRIES.map((ind) => (
              <Link key={ind.id} href={`/industries/${ind.id}`} className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{ind.icon}</span>
                  <h2 className="text-lg font-bold text-slate-900">{ind.name}</h2>
                </div>
                <p className="mt-3 text-sm text-slate-500">
                  Records become <span className="font-semibold text-slate-700">{ind.records}</span>, Contacts become <span className="font-semibold text-slate-700">{ind.contacts}</span>.
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 group-hover:gap-2.5 transition-all">Learn More <ArrowRight className="h-4 w-4" /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white md:text-3xl">Don&apos;t see your industry?</h2>
          <p className="mt-3 text-slate-300">We configure new industries in days. Book a demo and we&apos;ll tailor a workspace to how your business works.</p>
          <Link href="/book-demo" className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 font-medium text-slate-900 hover:bg-slate-100">Book a Free Demo <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>
    </>
  );
}
