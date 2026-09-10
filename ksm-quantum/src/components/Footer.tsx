import Link from 'next/link';
import { NAV, PRODUCTS, SITE } from '@/data/site';

export default function Footer() {
  return (
    <footer className="relative border-t border-[var(--border)] bg-[rgba(255,255,255,0.015)]">
      <div className="container-x grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent-cyan)] text-sm font-black text-white">K</span>
            <span className="font-display text-[15px] font-bold tracking-tight">KSM Quantum Technologies</span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-[var(--muted)]">{SITE.tagline}</p>
          <p className="mt-3 text-xs text-[var(--muted)]">Established {SITE.founded} · {SITE.city}</p>
        </div>

        <div>
          <div className="eyebrow">Company</div>
          <ul className="mt-4 space-y-2.5 text-sm">
            {NAV.filter((n) => n.href !== '/').map((n) => (
              <li key={n.href}><Link href={n.href} className="text-[var(--muted)] transition-colors hover:text-white">{n.label}</Link></li>
            ))}
          </ul>
        </div>

        <div>
          <div className="eyebrow">Products</div>
          <ul className="mt-4 space-y-2.5 text-sm">
            {PRODUCTS.map((p) => (
              <li key={p.name}>
                {p.comingSoon ? (
                  <Link href={`/products/${p.slug}`} className="text-[var(--muted)] transition-colors hover:text-white">
                    {p.name} <span className="text-[var(--border)]">·</span> <span className="text-[13px]">Coming soon</span>
                  </Link>
                ) : (
                  <a href={p.href} target="_blank" rel="noopener noreferrer" className="text-[var(--muted)] transition-colors hover:text-white">
                    {p.name} <span className="text-[var(--border)]">·</span> <span className="text-[13px]">{p.domain}</span>
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-[var(--border)]">
        <div className="container-x flex flex-col items-center justify-between gap-2 py-6 text-xs text-[var(--muted)] sm:flex-row">
          <p>© {new Date().getFullYear()} {SITE.name}. All rights reserved.</p>
          <p>{SITE.address}</p>
        </div>
      </div>
    </footer>
  );
}
