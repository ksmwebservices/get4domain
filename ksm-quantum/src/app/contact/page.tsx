import type { Metadata } from 'next';
import { Mail, MapPin, Building2, ArrowUpRight } from 'lucide-react';
import Reveal from '@/components/Reveal';
import { SITE, PRODUCTS, OG_IMAGE } from '@/data/site';

export const metadata: Metadata = {
  title: 'Contact — KSM Quantum Technologies, Chennai',
  description:
    'Get in touch with KSM Quantum Technologies in Chennai, India. Email support@get4domain.com or reach us at Tidel Park, Tharamani, Chennai.',
  alternates: { canonical: `${SITE.url}/contact` },
  openGraph: { title: 'Contact KSM Quantum Technologies', description: 'Chennai, India · support@get4domain.com', url: `${SITE.url}/contact`, type: 'website', images: [OG_IMAGE] },
};

export default function ContactPage() {
  return (
    <>
      <section className="container-x pb-14 pt-16 md:pb-20 md:pt-24">
        <Reveal><div className="eyebrow">Contact</div></Reveal>
        <Reveal delay={80}>
          <h1 className="mt-4 max-w-4xl font-display text-4xl font-bold leading-[1.06] tracking-tight md:text-6xl">
            Let&apos;s build <span className="text-gradient">what&apos;s next.</span>
          </h1>
        </Reveal>
        <Reveal delay={160}>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
            Tell us about your business or project. We&apos;ll get back to you from our Chennai team.
          </p>
        </Reveal>
      </section>

      <section className="container-x pb-16 md:pb-24">
        <div className="grid gap-4 md:grid-cols-3">
          <Reveal>
            <a href={`mailto:${SITE.email}`} className="card flex h-full flex-col p-7">
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--accent-cyan)]"><Mail className="h-5 w-5" /></span>
              <h2 className="mt-4 font-display text-lg font-semibold">Email us</h2>
              <p className="mt-2 flex-1 text-sm text-[var(--muted)]">The fastest way to reach us.</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-white">{SITE.email} <ArrowUpRight className="h-4 w-4" /></span>
            </a>
          </Reveal>
          <Reveal delay={80}>
            <div className="card flex h-full flex-col p-7">
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--accent-cyan)]"><MapPin className="h-5 w-5" /></span>
              <h2 className="mt-4 font-display text-lg font-semibold">Visit / write</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--muted)]">
                Tidel Park, 1st Floor D Block,<br />Tharamani, Chennai,<br />Tamil Nadu 600113, India
              </p>
            </div>
          </Reveal>
          <Reveal delay={160}>
            <div className="card flex h-full flex-col p-7">
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--accent-cyan)]"><Building2 className="h-5 w-5" /></span>
              <h2 className="mt-4 font-display text-lg font-semibold">The company</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--muted)]">
                {SITE.name}<br />Established {SITE.founded}<br />Chennai, India
              </p>
            </div>
          </Reveal>
        </div>

        {/* Contact form — posts via the visitor's own mail client (no backend needed) */}
        <Reveal>
          <form
            action={`mailto:${SITE.email}`}
            method="post"
            encType="text/plain"
            className="card mt-4 grid gap-4 p-7 md:p-9"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1.5 block text-[var(--muted)]">Your name</span>
                <input name="name" required className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[var(--accent)]/60" placeholder="Jane Doe" />
              </label>
              <label className="text-sm">
                <span className="mb-1.5 block text-[var(--muted)]">Email</span>
                <input name="email" type="email" required className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[var(--accent)]/60" placeholder="you@company.com" />
              </label>
            </div>
            <label className="text-sm">
              <span className="mb-1.5 block text-[var(--muted)]">How can we help?</span>
              <textarea name="message" rows={4} required className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[var(--accent)]/60" placeholder="Tell us about your business or project…" />
            </label>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-[var(--muted)]">Opens your email app addressed to {SITE.email}.</p>
              <button type="submit" className="btn-primary">Send message</button>
            </div>
          </form>
        </Reveal>

        {/* Product links */}
        <div className="mt-14">
          <Reveal><div className="eyebrow">Or explore our products</div></Reveal>
          <div className="mt-5 flex flex-wrap gap-2.5">
            {PRODUCTS.map((p) => (
              <a key={p.name} href={p.href} target="_blank" rel="noopener noreferrer" className="btn-ghost !py-2 !text-sm">
                {p.name} <ArrowUpRight className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
