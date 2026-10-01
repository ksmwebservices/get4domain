import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Camera, Film, Heart, Sparkles, Video } from 'lucide-react';
import Header from '@/components/site/Header';
import Footer from '@/components/site/Footer';
import BottomNav from '@/components/site/BottomNav';
import FloatingWhatsApp from '@/components/site/FloatingWhatsApp';
import { BookButton } from '@/components/site/BookingModal';
import { services as fallbackServices, resolveServices } from '@/lib/services';
import { fetchSiteData } from '@/lib/site-data';

export const metadata: Metadata = {
  title: 'Wedding Photography Services in Madurai | Deebi Wedding Stories',
  description: 'Explore wedding photography, candid photography, traditional South Indian wedding coverage, pre-wedding shoots, engagement photography, Haldi, Mehendi, and cinematic wedding films by Deebi Wedding Stories.',
  keywords: fallbackServices.flatMap((service) => service.keywords),
};

const icons = [Camera, Heart, Sparkles, Camera, Video, Sparkles, Film];

export default async function ServicesHub() {
  const site = await fetchSiteData();
  const services = resolveServices(site);
  return (
    <>
      <Header />
      <main className="pt-20">
        <section className="relative overflow-hidden border-b border-gold/20">
          <div className="absolute inset-0 bg-[url('https://images.pexels.com/photos/9931785/pexels-photo-9931785.jpeg?auto=compress&cs=tinysrgb&w=1800')] bg-cover bg-center opacity-35" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/90 to-ink/45" />
          <div className="relative max-w-7xl mx-auto px-5 sm:px-8 py-24 sm:py-36 grid lg:grid-cols-2 gap-10 items-end">
            <div><p className="font-cinzel text-gold text-xs tracking-[0.35em] uppercase mb-5">Deebi Wedding Stories · Madurai</p><h1 className="font-playfair text-4xl sm:text-6xl text-cream leading-tight">Every celebration deserves its own visual language.</h1><p className="mt-6 text-warm/75 text-lg leading-relaxed max-w-2xl">Choose a service for your wedding, engagement, or pre-wedding celebration. We combine candid feeling, South Indian tradition, and cinematic craft into photographs and films you will return to.</p><div className="flex flex-wrap gap-3 mt-8"><BookButton className="px-7 py-3.5 bg-gold text-ink text-sm font-medium rounded-sm hover:bg-gold-light transition-colors">Check our availability</BookButton><a href="#service-list" className="px-7 py-3.5 border border-cream/30 text-cream text-sm rounded-sm hover:border-gold hover:text-gold transition-colors">Explore services</a></div></div>
            <div className="grid grid-cols-3 gap-3 max-w-md lg:ml-auto"><div className="p-4 border border-gold/25 bg-ink/60 backdrop-blur-sm"><p className="font-playfair text-3xl text-gold">{services.length}</p><p className="text-warm/60 text-xs mt-1">specialist services</p></div><div className="p-4 border border-gold/25 bg-ink/60 backdrop-blur-sm"><p className="font-playfair text-3xl text-gold">12+</p><p className="text-warm/60 text-xs mt-1">years of stories</p></div><div className="p-4 border border-gold/25 bg-ink/60 backdrop-blur-sm"><p className="font-playfair text-3xl text-gold">4K</p><p className="text-warm/60 text-xs mt-1">film delivery</p></div></div>
          </div>
        </section>

        <section id="service-list" className="px-5 sm:px-8 py-20 sm:py-28 bg-ink-light"><div className="max-w-7xl mx-auto"><div className="max-w-2xl mb-12"><p className="font-cinzel text-gold text-xs tracking-[0.3em] uppercase mb-4">Our photography & film services</p><h2 className="font-playfair text-3xl sm:text-5xl text-cream">Built around the moments you never want to forget.</h2><p className="text-warm/65 mt-4 leading-relaxed">Each guide includes what is covered, what you receive, sample images, a verified sample film, and a simple way to ask for availability.</p></div><div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">{services.map((service, index) => { const Icon = icons[index % icons.length]; return <article key={service.slug} className="group bg-ink border border-white/10 hover:border-gold/40 rounded-sm overflow-hidden transition-all duration-500"><Link href={`/services/${service.slug}`} className="block"><div className="relative h-56 overflow-hidden"><img src={service.image} alt={service.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" /><div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" /><div className="absolute top-4 left-4 w-10 h-10 rounded-full border border-gold/50 bg-ink/75 flex items-center justify-center"><Icon className="w-4 h-4 text-gold" /></div><span className="absolute top-4 right-4 font-cinzel text-gold/60 text-xs">0{index + 1}</span></div><div className="p-6"><p className="font-cinzel text-gold/60 text-[10px] tracking-[0.25em] uppercase">{service.eyebrow}</p><h3 className="font-playfair text-2xl text-cream mt-2 group-hover:text-gold transition-colors">{service.shortTitle}</h3><p className="text-warm/60 text-sm leading-relaxed mt-3">{service.description}</p><span className="inline-flex items-center gap-2 text-gold text-sm mt-5">Explore guide <ArrowUpRight className="w-4 h-4" /></span></div></Link><div className="px-6 pb-6"><BookButton service={service.shortTitle} className="w-full py-3 border border-gold/40 text-gold text-sm rounded-sm hover:bg-gold hover:text-ink transition-colors">Book this service</BookButton></div></article>; })}</div></div></section>

        <section className="px-5 sm:px-8 py-20 sm:py-28"><div className="max-w-4xl mx-auto text-center border-y border-gold/20 py-14"><ArrowRight className="w-6 h-6 text-gold mx-auto mb-5" /><p className="font-playfair text-2xl sm:text-4xl text-cream">Not sure which coverage fits your celebration?</p><p className="text-warm/65 mt-4">Tell us your date, city, and wedding plans. We will suggest the right combination of photography and film.</p><BookButton className="inline-flex mt-7 px-7 py-3.5 bg-gold text-ink text-sm rounded-sm hover:bg-gold-light transition-colors">Talk to Boopathi</BookButton></div></section>
      </main>
      <Footer /><BottomNav /><FloatingWhatsApp />
    </>
  );
}
