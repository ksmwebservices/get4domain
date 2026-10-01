import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Check, Play, Quote } from 'lucide-react';
import Header from '@/components/site/Header';
import Footer from '@/components/site/Footer';
import BottomNav from '@/components/site/BottomNav';
import FloatingWhatsApp from '@/components/site/FloatingWhatsApp';
import ServiceBookingButton from '@/components/site/ServiceBookingButton';
import { resolveService, serviceSlugs } from '@/lib/services';
import { fetchSiteData } from '@/lib/site-data';

export function generateStaticParams() {
  return serviceSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const site = await fetchSiteData();
  const service = resolveService(site, params.slug);
  if (!service) return { title: 'Service | Deebi Wedding Stories' };
  return { title: `${service.title} | Deebi Wedding Stories`, description: service.answer, keywords: service.keywords, openGraph: { title: service.title, description: service.answer, images: [{ url: service.image }] } };
}

export default async function ServicePage({ params }: { params: { slug: string } }) {
  const site = await fetchSiteData();
  const service = resolveService(site, params.slug);
  if (!service) return <div className="min-h-screen bg-ink text-cream grid place-items-center">Service not found</div>;

  const schema = { '@context': 'https://schema.org', '@type': 'Service', name: service.title, description: service.answer, provider: { '@type': 'LocalBusiness', name: 'Deebi Wedding Stories', address: { '@type': 'PostalAddress', addressLocality: 'Madurai', addressRegion: 'Tamil Nadu', addressCountry: 'IN' }, telephone: '+91 95666 21288', email: 'click@deebi.com' }, areaServed: ['Madurai', 'Tamil Nadu', 'India'] };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <Header />
      <main className="pt-24">
        <section className="relative min-h-[620px] flex items-end overflow-hidden">
          <img src={service.image} alt={service.title} className="absolute inset-0 w-full h-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-ink/10" />
          <div className="relative z-10 max-w-7xl mx-auto w-full px-5 sm:px-8 pb-16 sm:pb-24"><Link href="/services" className="inline-flex items-center gap-2 text-warm/70 hover:text-gold text-sm mb-8"><ArrowLeft className="w-4 h-4" /> All services</Link><p className="font-cinzel text-gold text-xs tracking-[0.35em] uppercase">{service.eyebrow}</p><h1 className="font-playfair text-4xl sm:text-6xl lg:text-7xl text-cream max-w-4xl leading-[1.05] mt-4">{service.title}</h1><p className="text-warm/80 text-base sm:text-lg max-w-2xl leading-relaxed mt-6">{service.description}</p><div className="flex flex-wrap gap-3 mt-8"><ServiceBookingButton service={service.shortTitle} className="px-7 py-3.5 bg-gold text-ink text-sm font-medium rounded-sm hover:bg-gold-light transition-colors">Check our availability</ServiceBookingButton><a href="#gallery" className="px-7 py-3.5 border border-cream/30 text-cream text-sm rounded-sm hover:border-gold hover:text-gold transition-colors">View samples</a></div></div>
        </section>

        <section className="px-5 sm:px-8 py-16 sm:py-24"><div className="max-w-7xl mx-auto grid lg:grid-cols-5 gap-12"><div className="lg:col-span-3"><p className="font-cinzel text-gold text-xs tracking-[0.3em] uppercase mb-4">A clear answer</p><h2 className="font-playfair text-3xl sm:text-4xl text-cream leading-tight">What you can expect from our {service.shortTitle.toLowerCase()} service</h2><p className="text-warm/75 text-lg leading-relaxed mt-6">{service.answer}</p><div className="grid sm:grid-cols-2 gap-4 mt-8">{service.features.map((feature) => <div key={feature} className="flex gap-3 items-start text-warm/75 text-sm"><Check className="w-4 h-4 text-gold mt-0.5 shrink-0" />{feature}</div>)}</div></div><aside className="lg:col-span-2 bg-ink-light border border-gold/20 rounded-sm p-7 h-fit"><p className="font-cinzel text-gold text-xs tracking-[0.25em] uppercase">Included in your story</p><ul className="mt-5 space-y-4">{service.deliverables.map((deliverable) => <li key={deliverable} className="flex items-center gap-3 text-cream text-sm"><span className="w-1.5 h-1.5 rounded-full bg-gold" />{deliverable}</li>)}</ul><ServiceBookingButton service={service.shortTitle} className="w-full mt-7 py-3.5 border border-gold text-gold text-sm rounded-sm hover:bg-gold hover:text-ink transition-colors">Ask for a tailored quote</ServiceBookingButton></aside></div></section>

        <section id="gallery" className="bg-ink-light px-5 sm:px-8 py-16 sm:py-24"><div className="max-w-7xl mx-auto"><div className="flex items-end justify-between gap-4 mb-10"><div><p className="font-cinzel text-gold text-xs tracking-[0.3em] uppercase mb-3">Sample gallery</p><h2 className="font-playfair text-3xl sm:text-4xl text-cream">A few frames from the feeling</h2></div><Link href="/#portfolio" className="hidden sm:inline-flex items-center gap-2 text-gold text-sm">Full portfolio <ArrowUpRight className="w-4 h-4" /></Link></div><div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{service.gallery.map((photo) => <div key={photo.src} className="aspect-[4/5] overflow-hidden rounded-sm"><img src={photo.src} alt={photo.alt} className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" /></div>)}</div></div></section>

        <section className="px-5 sm:px-8 py-16 sm:py-24"><div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-10 items-center"><div><p className="font-cinzel text-gold text-xs tracking-[0.3em] uppercase mb-3">Film sample</p><h2 className="font-playfair text-3xl sm:text-4xl text-cream">See the story move</h2><p className="text-warm/65 mt-4 max-w-xl leading-relaxed">A photograph holds a moment. A film brings back the voice, movement, music, and atmosphere. Explore this sample clip, then let us create one around your day.</p></div><a href={service.video.href} target="_blank" rel="noopener noreferrer" className="group relative aspect-video overflow-hidden rounded-sm border border-gold/20"><img src={service.video.poster} alt={service.video.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" /><div className="absolute inset-0 bg-ink/45 group-hover:bg-ink/25 transition-colors" /><div className="absolute inset-0 grid place-items-center"><span className="w-16 h-16 rounded-full bg-gold flex items-center justify-center group-hover:scale-110 transition-transform"><Play className="w-6 h-6 fill-ink text-ink ml-1" /></span></div><div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-ink to-transparent"><p className="text-cream font-playfair text-xl">{service.video.title}</p><p className="text-warm/70 text-xs mt-1">Open sample clip on Pexels</p></div></a></div></section>

        <section className="px-5 sm:px-8 pb-20"><div className="max-w-3xl mx-auto text-center border-y border-gold/20 py-14"><Quote className="w-8 h-8 text-gold/50 mx-auto mb-5" /><p className="font-playfair text-2xl sm:text-3xl text-cream italic">“The best photographs are the ones that make you feel the day all over again.”</p><p className="font-cinzel text-gold text-xs tracking-[0.25em] uppercase mt-6">Boopathi Raja R · Founder</p><ServiceBookingButton service={service.shortTitle} className="inline-flex mt-8 px-7 py-3.5 bg-gold text-ink text-sm rounded-sm hover:bg-gold-light transition-colors">Start your booking</ServiceBookingButton></div></section>
      </main>
      <Footer /><BottomNav /><FloatingWhatsApp />
    </>
  );
}
