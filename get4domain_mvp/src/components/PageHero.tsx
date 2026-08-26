import { type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface PageHeroProps {
  eyebrow?: string;
  title: string;
  description?: string;
  breadcrumbs: { label: string; href?: string }[];
  children?: ReactNode;
}

/**
 * Shared inner-page hero — in the homepage dark visual family (slate-950 base,
 * brand blue/gold glows, glass eyebrow pill). Used by every top-level nav page
 * that doesn't have a bespoke hero, so they all share the same look.
 */
export default function PageHero({ eyebrow, title, description, breadcrumbs, children }: PageHeroProps) {
  return (
    <section className="relative overflow-hidden bg-slate-950 pt-28 pb-12 text-slate-100 lg:pt-36 lg:pb-16">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 right-0 h-96 w-96 rounded-full bg-primary-600/15 blur-[120px]" />
        <div className="absolute top-40 -left-20 h-72 w-72 rounded-full bg-warning-500/10 blur-[110px]" />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
      </div>

      <div className="container-mx container-px">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-slate-400">
            <li>
              <Link href="/" className="transition-colors hover:text-primary-300">Home</Link>
            </li>
            {breadcrumbs.map((crumb, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
                {crumb.href ? (
                  <Link href={crumb.href} className="transition-colors hover:text-primary-300">{crumb.label}</Link>
                ) : (
                  <span className="font-medium text-slate-200">{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>

        {eyebrow && (
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/5 bg-slate-800/60 px-3.5 py-1.5 text-xs font-medium text-primary-300 backdrop-blur-xl">
            {eyebrow}
          </span>
        )}
        <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-white text-balance sm:text-4xl lg:text-5xl">
          {title}
        </h1>
        {description && (
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-400 text-balance">
            {description}
          </p>
        )}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  );
}
