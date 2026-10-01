'use client';

import Link from 'next/link';
import { ArrowUpRight, Camera, Film, Heart, Sparkles, Video } from 'lucide-react';
import { BookButton } from '@/components/site/BookingModal';
import { useServices } from '@/lib/use-services';

const icons = [Camera, Heart, Sparkles, Camera, Video, Sparkles, Film];

export default function Services() {
  const { services } = useServices();
  return (
    <section id="services" className="relative py-20 sm:py-32 px-5 sm:px-8 bg-ink-light">
      <div className="absolute top-0 left-0 right-0 h-px gold-line opacity-30" />
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-4 mb-4"><span className="h-px w-10 bg-gold" /><p className="font-cinzel text-gold tracking-[0.3em] text-xs uppercase">What We Offer</p><span className="h-px w-10 bg-gold" /></div>
          <h2 className="font-playfair text-3xl sm:text-4xl md:text-5xl text-cream">Services Crafted for<span className="gold-gradient-text italic"> Every Moment</span></h2>
          <p className="mt-4 text-warm/60 max-w-2xl mx-auto">Explore separate service guides for every kind of wedding photography and film coverage.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, index) => {
            const Icon = icons[index % icons.length];
            return (
              <article key={service.slug} className="group relative overflow-hidden rounded-sm bg-ink border border-white/8 hover:border-gold/40 transition-all duration-500">
                <Link href={`/services/${service.slug}`} className="block">
                  <div className="relative h-56 overflow-hidden"><img src={service.image} alt={service.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" /><div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" /><div className="absolute top-4 left-4 w-10 h-10 rounded-full border border-gold/50 flex items-center justify-center bg-ink/80"><Icon className="w-4 h-4 text-gold" /></div><span className="absolute top-4 right-4 font-cinzel text-gold/50 text-sm">0{index + 1}</span></div>
                  <div className="p-6"><p className="font-cinzel text-gold/60 text-[10px] tracking-[0.2em] uppercase">{service.eyebrow}</p><h3 className="font-playfair text-xl text-cream mt-2 group-hover:text-gold transition-colors">{service.shortTitle}</h3><p className="text-sm text-warm/60 leading-relaxed mt-2">{service.description}</p><span className="inline-flex items-center gap-1 text-gold text-sm mt-5">View service <ArrowUpRight className="w-4 h-4" /></span></div>
                </Link>
                <div className="px-6 pb-6"><BookButton service={service.shortTitle} className="w-full py-3 border border-gold/40 text-gold text-sm rounded-sm hover:bg-gold hover:text-ink transition-colors">Book this service</BookButton></div>
              </article>
            );
          })}
        </div>
        <div className="text-center mt-10"><Link href="/services" className="inline-flex items-center gap-2 text-gold text-sm hover:text-gold-light transition-colors">See all service details <ArrowUpRight className="w-4 h-4" /></Link></div>
      </div>
    </section>
  );
}
