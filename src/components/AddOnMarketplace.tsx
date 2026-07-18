import { Search, MapPin, MessageCircle, Smartphone, Mail, Image, Share2, Wrench, PenTool, Palette, ArrowRight, type LucideIcon } from 'lucide-react';
import { addOns } from '@/data/content';
import { SectionHeading } from './ui/Accordion';
import Button from './ui/Button';
import Link from 'next/link';
import { CalendarCheck } from 'lucide-react';

const iconMap: Record<string, LucideIcon> = { Search, MapPin, MessageCircle, Smartphone, Mail, Image, Share2, Wrench, PenTool, Palette };

export default function AddOnMarketplace({ limit }: { limit?: number }) {
  const displayedAddOns = limit ? addOns.slice(0, limit) : addOns;
  return (
    <section id="addons" className="section-py">
      <div className="container-mx container-px">
        <SectionHeading
          eyebrow="DomainCampaign Add-ons"
          title="Grow Your Business Further"
          description="All add-on services are part of DomainCampaign — fully managed by our team. Available as standalone or bundled with your DomainApp subscription."
        />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {displayedAddOns.map((addon) => {
            const Icon = iconMap[addon.icon] ?? Search;
            return (
              <div key={addon.id} className="group card-base card-hover flex flex-col p-5">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-secondary-50 transition-colors group-hover:bg-secondary-100">
                  <Icon className="h-5 w-5 text-secondary-600" />
                </div>
                <h3 className="mb-1.5 text-base font-bold text-slate-900">{addon.name}</h3>
                <p className="mb-4 text-sm leading-relaxed text-slate-500 flex-1 line-clamp-3">{addon.description}</p>
                <div className="mb-4 flex items-baseline justify-between border-t border-slate-100 pt-3">
                  <div>
                    <span className="text-lg font-bold text-slate-900">{addon.price}</span>
                    <span className="ml-1 text-xs text-slate-400">/ {addon.duration}</span>
                  </div>
                </div>
                <Link href="/book-demo">
                  <Button size="sm" fullWidth rightIcon={<CalendarCheck className="h-3.5 w-3.5" />}>Request Service</Button>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
