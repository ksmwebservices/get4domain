'use client';

import { CalendarCheck, ArrowRight, ExternalLink } from 'lucide-react';
import { industries } from '@/data/content';
import { SectionHeading } from './ui/Accordion';
import Button from './ui/Button';
import Image from 'next/image';
import Link from 'next/link';

interface IndustryMarketplaceProps {
  limit?: number;
}

export default function IndustryMarketplace({ limit }: IndustryMarketplaceProps) {
  const displayedIndustries = limit ? industries.slice(0, limit) : industries;

  return (
    <section id="industries">
      <div className="container-mx container-px">
        <SectionHeading
          eyebrow="Industry Solutions"
          title="Choose Your Industry"
          description="20+ industries supported. Each with purpose-built modules, real content and a professional website — not a generic template."
        />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {displayedIndustries.map((industry) => {
            const Icon = industry.icon;
            const isLive = industry.id === 'travel';
            return (
              <div key={industry.id} className="group card-base card-hover overflow-hidden flex flex-col">
                <div className="relative h-40 overflow-hidden">
                  <Image
                    src={industry.coverImage}
                    alt={industry.name}
                    fill
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-slate-900/20 to-transparent" />
                  <div className={`absolute top-3 left-3 flex h-9 w-9 items-center justify-center rounded-xl ${industry.bgColor} backdrop-blur-sm`}>
                    <Icon className={`h-4 w-4 ${industry.color}`} />
                  </div>
                  {industry.badge && (
                    <div className="absolute top-3 right-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${industry.badge === 'Demo Live' ? 'bg-success-500 text-white' : 'bg-secondary-500 text-white'}`}>
                        {industry.badge}
                      </span>
                    </div>
                  )}
                  <div className="absolute bottom-3 left-3 right-3">
                    <h3 className="text-sm font-bold text-white leading-tight">{industry.name}</h3>
                  </div>
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <p className="text-xs text-slate-500 mb-3 flex-1 line-clamp-2">{industry.description}</p>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {industry.features.slice(0, 2).map((f) => (
                      <span key={f} className="rounded-md bg-slate-50 px-1.5 py-0.5 text-xs text-slate-500">{f}</span>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-auto">
                    {isLive ? (
                      <a href="https://mrtravels.get4domain.com" target="_blank" rel="noopener noreferrer" className="flex-1">
                        <Button size="sm" variant="outline" fullWidth leftIcon={<ExternalLink className="h-3.5 w-3.5" />}>
                          Live Demo
                        </Button>
                      </a>
                    ) : (
                      <Link href={`/industries/${industry.id}`} className="flex-1">
                        <Button size="sm" variant="outline" fullWidth rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>
                          Details
                        </Button>
                      </Link>
                    )}
                    <Link href={`/book-demo?industry=${industry.id}`} className="flex-1">
                      <Button size="sm" fullWidth leftIcon={<CalendarCheck className="h-3.5 w-3.5" />}>
                        Book Demo
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
  );
}
