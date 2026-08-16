import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Check, ArrowRight, CalendarCheck, Globe } from 'lucide-react';
import { industryContent } from '@/data/industry-content';
import { industries } from '@/data/content';
import { INDUSTRIES } from '@/data/industries-list';
import PageHero from '@/components/PageHero';
import CTABanner from '@/components/CTABanner';
import Button from '@/components/ui/Button';

export async function generateStaticParams() {
  return industryContent.map((ind) => ({ id: ind.id }));
}

export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await props.params;
  const content = industryContent.find((i) => i.id === id);
  if (!content) return {};
  return {
    title: `${content.name} Business Website & Software | Get4Domain`,
    description: content.fullDesc,
    keywords: content.seoKeywords,
  };
}

export default async function IndustryDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const content = industryContent.find((i) => i.id === id);
  const industry = industries.find((i) => i.id === id);
  if (!content || !industry) notFound();

  const workspace = INDUSTRIES.find((i) => i.id === id);

  return (
    <>
      <PageHero
        eyebrow={content.name}
        title={content.tagline}
        description={content.shortDesc}
        breadcrumbs={[{ label: 'Industries', href: '/industries' }, { label: content.name }]}
      />

      <section className="py-12 lg:py-16">
        <div className="container-mx container-px">
          <div className="mx-auto max-w-3xl">
            <p className="text-lg text-slate-600 leading-relaxed">{content.fullDesc}</p>
          </div>

          {workspace && (
            <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-primary-100 bg-primary-50 p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">Your {content.name} Workspace</p>
                <span className="rounded-full bg-primary-600 px-3 py-1 text-xs font-bold text-white">₹999/month — everything included</span>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Configured for how you actually work — your records become{' '}
                <span className="font-semibold text-slate-900">{workspace.records}</span> and your contacts become{' '}
                <span className="font-semibold text-slate-900">{workspace.contacts}</span>.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[`Your ${workspace.records} management`, `Your ${workspace.contacts} database`, 'GST invoicing', 'Accounts & reports', 'Website & CMS', 'Industry addons'].map((f) => (
                  <span key={f} className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-slate-700">{f}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Website preview mockup */}
      <section className="py-12 bg-slate-50">
        <div className="container-mx container-px">
          <div className="mb-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary-600 mb-2">Website Preview</p>
            <h2 className="text-2xl font-bold text-slate-900">What Your Website Will Look Like</h2>
            <p className="mt-2 text-slate-500 text-sm">Sample content — your actual business details will be used</p>
          </div>
          <div className="relative mx-auto max-w-2xl">
            {/* Floating phone mockup (2.5) — animated, desktop only */}
            <div className="animate-g4d-float-slow absolute -bottom-6 -right-4 z-10 hidden w-32 rounded-[1.75rem] border-4 border-slate-800 bg-slate-800 shadow-2xl lg:block">
              <div className="overflow-hidden rounded-[1.4rem] bg-white">
                <div className="relative h-28">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={content.coverImage} alt="" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 to-transparent" />
                  <span className="absolute bottom-1.5 left-1.5 rounded-full bg-primary-600 px-2 py-0.5 text-[9px] font-bold text-white">Book Now</span>
                </div>
                <div className="space-y-1 p-2">
                  <div className="h-1.5 w-3/4 rounded bg-slate-200" />
                  <div className="h-1.5 w-1/2 rounded bg-slate-100" />
                </div>
              </div>
            </div>
            <div className="animate-g4d-float rounded-2xl border-2 border-primary-200 bg-white overflow-hidden shadow-premium">
              <div className="bg-slate-100 px-4 py-2.5 flex items-center gap-2 border-b border-slate-200">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-400" />
                  <div className="h-3 w-3 rounded-full bg-yellow-400" />
                  <div className="h-3 w-3 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 mx-3 rounded-md bg-white border border-slate-200 px-3 py-1 text-xs text-slate-400 font-mono">
                  yourbusiness.get4domain.com
                </div>
              </div>
              <div className="relative h-48 overflow-hidden">
                <img src={content.coverImage} alt={content.name} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/40 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <h3 className="text-lg font-bold text-white leading-tight">{content.sampleContent.heroHeadline}</h3>
                  <p className="text-sm text-white/80 mt-1">{content.sampleContent.heroSubline}</p>
                  <div className="mt-3 flex gap-2">
                    <span className="rounded-full bg-primary-600 px-3 py-1 text-xs font-semibold text-white">Book Now</span>
                    <span className="rounded-full bg-white/20 backdrop-blur-sm px-3 py-1 text-xs font-semibold text-white">WhatsApp Us</span>
                  </div>
                </div>
              </div>
              <div className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Our Services</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {content.sampleContent.services.map((s) => (
                    <span key={s} className="rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-700">{s}</span>
                  ))}
                </div>
                <div className="rounded-xl bg-success-50 border border-success-100 px-3 py-2">
                  <p className="text-xs text-success-800 font-medium">{content.sampleContent.highlight}</p>
                </div>
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-slate-400">
              Sample content only. Built with your business name, photos and details.
            </p>
          </div>
        </div>
      </section>

      {/* What you get + pages */}
      <section className="py-12 lg:py-16">
        <div className="container-mx container-px">
          <div className="grid gap-10 lg:grid-cols-2 max-w-4xl mx-auto">
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-5">What You Get</h2>
              <ul className="space-y-3">
                {content.whatYouGet.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-success-100">
                      <Check className="h-3 w-3 text-success-600" />
                    </div>
                    <span className="text-sm text-slate-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-5">Website Pages Included</h2>
              <div className="flex flex-wrap gap-2 mb-6">
                {content.websitePages.map((page) => (
                  <span key={page} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                    <Globe className="h-3.5 w-3.5 text-primary-500" />{page}
                  </span>
                ))}
              </div>
              <div className="rounded-2xl border border-primary-100 bg-primary-50 p-5">
                <h3 className="text-base font-bold text-slate-900 mb-2">Custom content, not a template</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Every page is built with your actual business name, services, photos and contact details. Not a drag-and-drop builder — a real website built by our team.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-16">
        <div className="container-mx container-px">
          <div className="mx-auto max-w-2xl text-center rounded-2xl border border-slate-200 bg-slate-50 p-10">
            <h2 className="text-2xl font-bold text-slate-900">Ready to Launch Your {content.name} Business Online?</h2>
            <p className="mt-3 text-slate-600 text-sm leading-relaxed">
              Book a free consultation. We will show you a live demo, understand your requirements and give you a clear project plan with pricing — no obligation.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <Link href={`/book-demo?industry=${id}`}>
                <Button size="lg" leftIcon={<CalendarCheck className="h-5 w-5" />} rightIcon={<ArrowRight className="h-4 w-4" />}>
                  Book Free Demo
                </Button>
              </Link>
              <Link href="/industries">
                <Button size="lg" variant="outline">Browse All Industries</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <CTABanner />
    </>
  );
}
