import { portfolioItems } from '@/data/content';
import { SectionHeading } from './ui/Accordion';
import { ExternalLink, Rocket } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import Button from './ui/Button';

interface PortfolioProps {
  limit?: number;
}

export default function Portfolio({ limit }: PortfolioProps) {
  const items = limit ? portfolioItems.slice(0, limit) : portfolioItems;

  if (items.length === 0) {
    return (
      <section id="portfolio">
        <div className="container-mx container-px">
          <SectionHeading
            eyebrow="Portfolio"
            title="Businesses Launched on Get4Domain"
            description="Real businesses across India using DomainApp for their online presence and business management."
          />
          <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50">
              <Rocket className="h-6 w-6 text-primary-600" />
            </div>
            <p className="text-slate-600 text-sm">Portfolio coming soon — we're building more client websites.</p>
            <Link href="/book-demo" className="mt-5 inline-block">
              <Button size="sm" variant="outline">Be Our Next Success Story</Button>
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="portfolio">
      <div className="container-mx container-px">
        <SectionHeading
          eyebrow="Portfolio"
          title="Businesses Launched on Get4Domain"
          description="Real businesses across India using DomainApp for their online presence and business management."
        />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => {
            const isLive = item.url !== '#';
            return (
              <div key={item.id} className="group card-base overflow-hidden card-hover">
                <div className="relative h-36 overflow-hidden">
                  <Image
                    src={item.image}
                    alt={item.businessName}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
                  {isLive && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-success-500 px-2 py-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                      <span className="text-xs font-bold text-white">Live</span>
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 right-2">
                    <div className="text-sm font-bold text-white leading-tight">{item.businessName}</div>
                    <div className="text-xs text-white/70">{item.industry} · {item.city}</div>
                  </div>
                </div>
                <div className="p-3">
                  {isLive ? (
                    <a href={item.url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" fullWidth rightIcon={<ExternalLink className="h-3 w-3" />}>
                        Visit Site
                      </Button>
                    </a>
                  ) : (
                    <Link href="/book-demo">
                      <Button size="sm" variant="ghost" fullWidth>
                        Get This for My Business
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
