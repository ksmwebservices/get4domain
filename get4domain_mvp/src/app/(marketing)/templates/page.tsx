import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, Check, FileCode, Star, ArrowRight } from 'lucide-react';
import PageHero from '@/components/PageHero';
import CTABanner from '@/components/CTABanner';
import Button from '@/components/ui/Button';
import { themes, industries } from '@/data/content';
import { createPageMetadata } from '@/lib/metadata';

export const metadata: Metadata = createPageMetadata({
  title: 'Templates',
  description: 'Browse our collection of industry-specific themes. Each template is professionally designed and ready to launch.',
  path: '/templates',
});

export default function TemplatesPage() {
  return (
    <>
      <PageHero
        eyebrow="Theme Gallery"
        title="Professional Niche Templates"
        description="Browse our collection of industry-specific themes. Each template is professionally designed and ready to launch."
        breadcrumbs={[{ label: 'Templates' }]}
      />

      <section className="section-py">
        <div className="container-mx container-px">
          <div className="mb-10 flex flex-wrap gap-2 justify-center">
            <button className="rounded-full bg-primary-600 px-4 py-1.5 text-sm font-medium text-white">
              All Templates
            </button>
            {industries.slice(0, 8).map((industry) => (
              <button
                key={industry.id}
                className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-600 hover:border-primary-300 hover:text-primary-600 transition-colors"
              >
                {industry.name}
              </button>
            ))}
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {themes.map((theme) => {
              const industry = industries.find((i) => i.id === theme.industryId);
              return (
                <div key={theme.id} className="card-base card-hover overflow-hidden">
                  <div className="relative aspect-video overflow-hidden">
                    <Image
                      src={theme.previewImage}
                      alt={theme.name}
                      fill
                      className="object-cover transition-transform duration-500 hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/50 to-transparent" />
                    <div className="absolute bottom-3 left-3">
                      <h3 className="text-lg font-bold text-white">{theme.name}</h3>
                      {industry && (
                        <p className="text-xs text-white/80">{industry.name}</p>
                      )}
                    </div>
                    <div className="absolute top-3 right-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-slate-700">
                        <Star className="h-3 w-3 fill-secondary-400 text-secondary-400" />
                        Theme A
                      </span>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="mb-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Features</p>
                      <div className="flex flex-wrap gap-1.5">
                        {theme.features.slice(0, 4).map((feature) => (
                          <span key={feature} className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600">
                            <Check className="h-3 w-3 text-success-500" />
                            {feature}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Pages</p>
                      <div className="flex flex-wrap gap-1.5">
                        {theme.pagesIncluded.map((page) => (
                          <span key={page} className="inline-flex items-center gap-1 rounded-md bg-primary-50 px-2 py-1 text-xs text-primary-700">
                            <FileCode className="h-3 w-3" />
                            {page}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" fullWidth leftIcon={<Eye className="h-4 w-4" />}>
                        Preview
                      </Button>
                      <Link href="/pricing" className="flex-1">
                        <Button size="sm" fullWidth leftIcon={<ArrowRight className="h-4 w-4" />}>
                          Select
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <CTABanner />
    </>
  );
}
