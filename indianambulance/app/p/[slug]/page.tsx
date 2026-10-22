import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getContent } from '@/lib/content'
import { paragraphs } from '@/lib/site-connect'

/** A page the owner added in Website Manager, shown in this site's own header and footer styling. Only for a vendor in connected mode, within their plan's page limit. */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const c = await getContent()
  const page = c.pages.find((p) => p.slug === slug)
  if (!page) return {}
  return { title: page.title, description: paragraphs(page.body)[0]?.slice(0, 160) || c.seo.description, ...(c.seo.noindex ? { robots: { index: false, follow: false } } : {}) }
}

export default async function VendorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const c = await getContent()
  const page = c.pages.find((p) => p.slug === slug)
  if (!c.connected || !page) notFound()
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f8fafc] text-[#10233f]">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <a href="/" className="flex items-center gap-3">
            <span className="relative size-11 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200"><Image src={c.logo} alt={`${c.name} logo`} fill className="object-cover" sizes="44px" /></span>
            <span><span className="block text-sm font-bold tracking-tight sm:text-base">{c.name}</span><span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[.12em] text-[#c9232d]"><span className="size-1.5 rounded-full bg-emerald-500" /> 24 hours service</span></span>
          </a>
          <a href="/" className="text-sm font-semibold text-slate-600 hover:text-[#c9232d]">Home</a>
        </div>
      </header>
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
        <h1 className="section-title">{page.title}</h1>
        <div className="mt-8 space-y-5">
          {paragraphs(page.body).map((para) => <p key={para} className="leading-7 text-slate-600">{para}</p>)}
        </div>
      </section>
      <footer className="border-t border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8"><p className="font-bold">{c.name} <span className="font-normal text-slate-400">| 24 Hours Service</span></p><p className="text-xs text-slate-400">© {new Date().getFullYear()} {c.name}</p></div></footer>
    </main>
  )
}
