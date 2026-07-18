import { type ReactNode } from 'react';
import PageHero from '@/components/PageHero';
import CTABanner from '@/components/CTABanner';

interface LegalPageProps {
  title: string;
  breadcrumb: string;
  lastUpdated: string;
  sections: { heading: string; content: ReactNode }[];
}

export default function LegalPage({ title, breadcrumb, lastUpdated, sections }: LegalPageProps) {
  return (
    <>
      <PageHero
        title={title}
        breadcrumbs={[{ label: breadcrumb }]}
      />

      <section className="pb-16">
        <div className="container-mx container-px">
          <div className="mx-auto max-w-3xl">
            <p className="mb-8 text-sm text-slate-500">Last updated: {lastUpdated}</p>
            <div className="space-y-8">
              {sections.map((section, i) => (
                <div key={i}>
                  <h2 className="mb-3 text-xl font-bold text-slate-900">{section.heading}</h2>
                  <div className="text-sm leading-relaxed text-slate-600 space-y-3">{section.content}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <CTABanner />
    </>
  );
}
