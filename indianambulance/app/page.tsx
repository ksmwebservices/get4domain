'use client'

import Image from 'next/image'
import {
  Ambulance,
  ArrowRight,
  BriefcaseMedical,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Cross,
  ExternalLink,
  HeartPulse,
  ImageIcon,
  MapPin,
  Menu,
  Phone,
  ShieldCheck,
  Stethoscope,
  X,
  MessageCircle,
} from 'lucide-react'
import { useState } from 'react'
import { useContent } from '@/components/ContentContext'

// icons of the exported service cards, in their order; a vendor's own services reuse them in turn
const serviceIcons = [HeartPulse, Ambulance, ShieldCheck, ExternalLink, Clock3, Stethoscope, Cross, BriefcaseMedical, HeartPulse, ShieldCheck, Ambulance]

function WhatsAppLink({ children, service }: { children: React.ReactNode; service?: string }) {
  const c = useContent()
  const href = `https://wa.me/${c.whatsapp}?text=${encodeURIComponent(service
    ? `Hello ${c.greetName}, I would like to enquire about ${service}. Please contact me.`
    : `Hello ${c.greetName}, I need ambulance assistance. Please contact me.`)}`
  return <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2">{children}</a>
}

export default function Page() {
  const c = useContent()
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const phone = c.phone.tel
  const maps = c.mapHref
  const heroImage = c.heroImage
  // the About pictures: the second and first photo, or the hero picture when the owner has fewer
  const aboutPhotos = [c.photos[1]?.src ?? heroImage, c.photos[0]?.src ?? heroImage]
  const customAddress = c.address !== '4, East Coast Road, Sangeevirayan, Pettai, Tindivanam, Tamil Nadu 604001.'

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'EmergencyService',
    name: c.name,
    description: c.connected ? c.seo.description : '24-hour emergency and patient transport ambulance service in Tindivanam, Tamil Nadu.',
    url: 'https://indianambulance.in',
    telephone: c.phone.display,
    image: /^https?:\/\//.test(c.logo) ? c.logo : `https://indianambulance.in${c.logo}`,
    address: customAddress
      ? { '@type': 'PostalAddress', streetAddress: c.address, addressCountry: 'IN' }
      : { '@type': 'PostalAddress', streetAddress: '4, East Coast Road, Sangeevirayan, Pettai', addressLocality: 'Tindivanam', addressRegion: 'Tamil Nadu', postalCode: '604001', addressCountry: 'IN' },
    ...(c.defaultHours ? { openingHours: 'Mo-Su 00:00-23:59' } : {}),
    areaServed: 'Tindivanam',
    serviceType: c.services.map((s) => s.name),
    ...(c.social.length ? { sameAs: c.social.map((l) => l.href) } : {}),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <main className="min-h-screen overflow-x-hidden bg-[#f8fafc] text-[#10233f] pb-24 md:pb-0">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <a href="#overview" className="flex items-center gap-3">
            <span className="relative size-11 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200"><Image src={c.logo} alt={`${c.name} logo`} fill className="object-cover" sizes="44px" /></span>
            <span><span className="block text-sm font-bold tracking-tight sm:text-base">{c.name}</span><span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[.12em] text-[#c9232d]"><span className="size-1.5 rounded-full bg-emerald-500" /> 24 hours service</span></span>
          </a>
          <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 md:flex" aria-label="Main navigation">
            <a href="#overview" className="hover:text-[#c9232d]">Overview</a><a href="#services" className="hover:text-[#c9232d]">Services</a><a href="#photos" className="hover:text-[#c9232d]">Photos</a><a href="#contact" className="hover:text-[#c9232d]">Contact</a>
            <a href={`tel:${phone}`} className="inline-flex items-center gap-2 rounded-full bg-[#c9232d] px-4 py-2.5 text-white shadow-sm hover:bg-[#a91d26]"><Phone size={16} /> Call now</a>
          </nav>
          <button className="rounded-lg p-2 md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation"><Menu size={22} /></button>
        </div>
        {menuOpen && <nav className="border-t border-slate-100 bg-white px-4 py-3 md:hidden"><div className="flex flex-col gap-3 text-sm font-semibold"><a href="#overview" onClick={() => setMenuOpen(false)}>Overview</a><a href="#services" onClick={() => setMenuOpen(false)}>Services</a><a href="#photos" onClick={() => setMenuOpen(false)}>Photos</a><a href="#contact" onClick={() => setMenuOpen(false)}>Contact</a></div></nav>}
      </header>

      <section id="overview" className="relative isolate overflow-hidden bg-[#10233f]">
        <div className="absolute inset-0 -z-10"><Image src={heroImage} alt={`${c.name} emergency vehicle`} fill priority className="object-cover opacity-40" sizes="100vw" /><div className="absolute inset-0 bg-gradient-to-r from-[#10233f] via-[#10233f]/85 to-[#10233f]/35" /></div>
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-28">
          <div className="max-w-2xl text-white"><div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold tracking-[.12em] text-red-100"><span className="size-2 rounded-full bg-red-400" /> 24 HOURS AMBULANCE SERVICE</div><h1 className="text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">{c.defaultName ? <>Indian Ambulance Service in <span className="text-red-300">Tindivanam</span></> : c.name}</h1><p className="mt-6 max-w-lg text-base leading-7 text-slate-200 sm:text-lg">{c.tagline}</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><a href={`tel:${phone}`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[#c9232d] px-6 font-bold text-white shadow-lg shadow-red-950/20 hover:bg-[#a91d26]"><Phone size={19} /> Call Ambulance</a><WhatsAppLink><span className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[#24a55a] px-6 font-bold text-white hover:bg-[#168344]"><MessageCircle size={19} /> WhatsApp Us</span></WhatsAppLink></div></div>
          <div className="hidden justify-end lg:flex"><div className="w-full max-w-md rounded-3xl border border-white/20 bg-white/10 p-3 backdrop-blur-sm"><div className="relative aspect-[4/3] overflow-hidden rounded-2xl"><Image src={heroImage} alt="Red ambulance service vehicle" fill className="object-cover" sizes="(max-width: 1024px) 0px, 420px" /></div><div className="flex items-center gap-3 px-2 pb-1 pt-4 text-white"><div className="grid size-10 place-items-center rounded-xl bg-red-500/20"><ShieldCheck size={20} /></div><div><p className="font-bold">Here when you need us</p><p className="text-sm text-slate-300">Serving Tindivanam and nearby areas</p></div></div></div></div>
        </div>
      </section>

      <section className="relative z-10 mx-auto -mt-5 max-w-7xl px-4 sm:px-6 lg:px-8"><div className="grid overflow-hidden rounded-2xl bg-white shadow-xl shadow-slate-900/10 sm:grid-cols-3"><a href={`tel:${phone}`} className="group flex items-center gap-3 border-b border-slate-100 p-5 hover:bg-red-50 sm:border-b-0 sm:border-r"><span className="grid size-11 place-items-center rounded-xl bg-red-50 text-[#c9232d]"><Phone size={20} /></span><span><span className="block text-xs font-bold uppercase tracking-wider text-slate-500">Need help now?</span><span className="font-bold group-hover:text-[#c9232d]">Call Now</span></span><ChevronRight className="ml-auto text-slate-300" size={18} /></a><WhatsAppLink><span className="group flex items-center gap-3 border-b border-slate-100 p-5 hover:bg-emerald-50 sm:border-b-0 sm:border-r"><span className="grid size-11 place-items-center rounded-xl bg-emerald-50 text-[#168344]"><MessageCircle size={20} /></span><span><span className="block text-xs font-bold uppercase tracking-wider text-slate-500">Quick enquiry</span><span className="font-bold group-hover:text-[#168344]">WhatsApp</span></span><ChevronRight className="ml-auto text-slate-300" size={18} /></span></WhatsAppLink><a href={maps} target="_blank" rel="noreferrer" className="group flex items-center gap-3 p-5 hover:bg-blue-50"><span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-700"><MapPin size={20} /></span><span><span className="block text-xs font-bold uppercase tracking-wider text-slate-500">Visit us</span><span className="font-bold group-hover:text-blue-700">Get Directions</span></span><ChevronRight className="ml-auto text-slate-300" size={18} /></a></div></section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8"><div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-center"><div><p className="eyebrow">About our service</p><h2 className="section-title">Careful transport. <br /><span className="text-[#c9232d]">Human support.</span></h2><p className="mt-5 leading-7 text-slate-600">{c.about}</p><div className="mt-8 grid gap-4 sm:grid-cols-2"><div className="flex gap-3"><Clock3 className="mt-1 shrink-0 text-[#c9232d]" size={20} /><div><p className="font-bold">{c.hoursTitle}</p><p className="text-sm text-slate-500">{c.defaultHours ? 'Every day of the week' : c.hoursSub}</p></div></div><div className="flex gap-3"><MapPin className="mt-1 shrink-0 text-[#c9232d]" size={20} /><div><p className="font-bold">Tindivanam, Tamil Nadu</p><p className="text-sm text-slate-500">Serving local transport needs</p></div></div></div></div><div className="grid grid-cols-2 gap-4"><div className="relative mt-8 aspect-[4/5] overflow-hidden rounded-3xl"><Image src={aboutPhotos[0]} alt={c.photos[1]?.alt ?? c.name} fill className="object-cover" sizes="(max-width: 1024px) 50vw, 350px" /></div><div className="relative aspect-[4/5] overflow-hidden rounded-3xl"><Image src={aboutPhotos[1]} alt={c.photos[0]?.alt ?? c.name} fill className="object-cover" sizes="(max-width: 1024px) 50vw, 350px" /></div></div></div></section>

      <section id="services" className="bg-white py-20"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="max-w-2xl"><p className="eyebrow">Support for every journey</p><h2 className="section-title">Our ambulance services</h2><p className="mt-4 leading-7 text-slate-600">Tell us what you need and our team can discuss the right transport option. Availability should be confirmed in advance.</p></div><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{c.services.map(({ name, description }, index) => { const Icon = serviceIcons[index % serviceIcons.length]; return <article key={`${name}-${index}`} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-red-200 hover:shadow-md"><div className="flex items-start justify-between"><span className="grid size-11 place-items-center rounded-xl bg-red-50 text-[#c9232d]"><Icon size={21} /></span><span className="text-xs font-bold text-slate-300">{String(index + 1).padStart(2, '0')}</span></div><h3 className="mt-5 font-bold text-[#10233f]">{name}</h3><p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{description}</p><WhatsAppLink service={name}><span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#c9232d]">Enquire on WhatsApp <ArrowRight size={15} /></span></WhatsAppLink></article> })}</div></div></section>

      <section id="photos" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="eyebrow">A look at our vehicles</p><h2 className="section-title">Our ambulance photos</h2></div><p className="max-w-sm text-sm leading-6 text-slate-500">A selection of ambulance vehicles available through Indian Ambulance Service.</p></div><div className="mt-10 grid gap-4 sm:grid-cols-2">{c.photos.map((photo, index) => <button key={`${photo.src}-${index}`} onClick={() => setSelectedPhoto(photo.src)} className="group relative aspect-[16/10] overflow-hidden rounded-3xl text-left"><Image src={photo.src} alt={photo.alt} fill className="object-cover transition duration-500 group-hover:scale-105" sizes="(max-width: 640px) 100vw, 50vw" /><span className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 transition group-hover:opacity-100" /><span className="absolute bottom-5 left-5 flex items-center gap-2 font-bold text-white opacity-0 transition group-hover:opacity-100"><ImageIcon size={17} /> View photo</span></button>)}</div></section>

      <section className="bg-[#10233f] py-20 text-white"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="grid gap-10 lg:grid-cols-2 lg:items-center"><div><p className="eyebrow text-red-300">Your feedback matters</p><h2 className="section-title text-white">Have you used our service?</h2><p className="mt-5 max-w-lg leading-7 text-slate-300">Share your feedback with the {c.name} team. Your experience helps local families find the support they need.</p></div><a href="https://www.google.com/search?q=Indian+Ambulance+Tindivanam+Tamil+Nadu" target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-2 rounded-xl bg-white px-5 py-3.5 font-bold text-[#10233f] hover:bg-red-50">Find us on Google <ExternalLink size={17} /></a></div></div></section>

      <section id="contact" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8"><div className="grid gap-8 rounded-3xl bg-red-50 p-6 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center"><div><p className="eyebrow">Find Indian Ambulance Service</p><h2 className="section-title">We are here when you need us.</h2><p className="mt-4 max-w-xl leading-7 text-slate-600">{c.address}</p><div className="mt-6 flex flex-col gap-3 sm:flex-row"><a href={`tel:${phone}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#c9232d] px-5 py-3.5 font-bold text-white hover:bg-[#a91d26]"><Phone size={17} /> Call Now</a><WhatsAppLink><span className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#24a55a] px-5 py-3.5 font-bold text-white hover:bg-[#168344]"><MessageCircle size={17} /> WhatsApp</span></WhatsAppLink><a href={maps} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3.5 font-bold hover:bg-slate-50"><MapPin size={17} /> Directions</a></div></div><div className="rounded-2xl bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 size={20} /></span><div><p className="font-bold">{c.hoursTitle}</p><p className="text-sm text-slate-500">{c.hoursSub}</p></div></div></div></div></section>

      <footer className="border-t border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8"><div><p className="font-bold">{c.name} <span className="font-normal text-slate-400">| 24 Hours Service</span></p><p className="mt-1 text-sm text-slate-500">Tindivanam, Tamil Nadu</p></div><div className="flex flex-wrap gap-4 text-sm font-semibold text-slate-600"><a href="#overview">Overview</a><a href="#services">Services</a><a href="#photos">Photos</a><a href="#contact">Contact</a>{c.pages.map((pg) => <a key={pg.slug} href={`/p/${pg.slug}`}>{pg.title}</a>)}{c.social.map((l) => <a key={l.key} href={l.href} target="_blank" rel="noreferrer">{l.label}</a>)}</div><p className="text-xs text-slate-400">© {new Date().getFullYear()} {c.name}</p></div></footer>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_25px_rgba(15,23,42,.08)] backdrop-blur md:hidden" aria-label="Mobile navigation"><div className="mx-auto flex max-w-md items-center justify-around py-2"><a href="#overview" className="mobile-nav-item"><Ambulance size={19} /><span>Home</span></a><a href="#services" className="mobile-nav-item"><BriefcaseMedical size={19} /><span>Services</span></a><a href="#photos" className="mobile-nav-item"><ImageIcon size={19} /><span>Photos</span></a><a href={maps} target="_blank" rel="noreferrer" className="mobile-nav-item"><MapPin size={19} /><span>Directions</span></a><WhatsAppLink><span className="mobile-nav-item text-[#168344]"><MessageCircle size={19} /><span>WhatsApp</span></span></WhatsAppLink></div></nav>

      {selectedPhoto && <div className="fixed inset-0 z-[60] grid place-items-center bg-[#071426]/90 p-4" role="dialog" aria-modal="true" aria-label="Full size ambulance photo" onClick={() => setSelectedPhoto(null)}><div className="relative h-[80vh] w-full max-w-5xl" onClick={(e) => e.stopPropagation()}><Image src={selectedPhoto} alt="Full size ambulance photo" fill className="object-contain" sizes="100vw" /><button onClick={() => setSelectedPhoto(null)} className="absolute right-0 top-0 rounded-full bg-white p-2 text-[#10233f]" aria-label="Close photo"><X size={20} /></button></div></div>}
    </main>
    </>
  )
}
