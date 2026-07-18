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

export default function PageHero({ eyebrow, title, description, breadcrumbs, children }: PageHeroProps) {
  return (
    <section className="relative overflow-hidden pt-28 pb-12 lg:pt-36 lg:pb-16 bg-gradient-to-b from-primary-50/50 via-white to-white">
      <div className="absolute inset-0 -z-10">
        <div className="absolute -top-24 right-0 h-96 w-96 rounded-full bg-primary-200/30 blur-3xl" />
        <div className="absolute top-40 -left-20 h-72 w-72 rounded-full bg-secondary-200/20 blur-3xl" />
      </div>

      <div className="container-mx container-px">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex items-center gap-1.5 text-sm text-slate-500">
            <li>
              <Link href="/" className="hover:text-primary-600 transition-colors">
                Home
              </Link>
            </li>
            {breadcrumbs.map((crumb, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-primary-600 transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="font-medium text-slate-700">{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>

        {eyebrow && (
          <span className="mb-3 inline-block text-sm font-semibold uppercase tracking-wider text-primary-600">
            {eyebrow}
          </span>
        )}
        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl text-balance max-w-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-4 text-lg leading-relaxed text-slate-600 max-w-2xl text-balance">
            {description}
          </p>
        )}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  );
}
