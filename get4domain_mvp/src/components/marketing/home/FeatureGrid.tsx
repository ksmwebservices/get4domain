import { CAPABILITIES } from '@/data/platform-features';
import { CAPABILITY_ICONS, CAPABILITY_ACCENTS } from '../capability-icons';

export default function FeatureGrid() {
  return (
    <section id="features" className="relative py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/5 bg-slate-800/60 px-3.5 py-1.5 text-xs font-medium text-primary-300 backdrop-blur-xl">
            Everything included
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            One platform. <span className="text-gradient-hero">Every tool you need.</span>
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-slate-400">
            Website, CRM, accounting, HRM, inventory, communication, AI, SEO and social — Get4Domain replaces a stack of separate apps with one platform from ₹999/month, billed annually.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CAPABILITIES.map((f, i) => {
            const Icon = CAPABILITY_ICONS[f.icon];
            return (
              <div key={f.id} className="group relative rounded-2xl border border-white/5 bg-slate-800/60 p-5 backdrop-blur-xl transition-all duration-300 hover:border-primary-400/20 hover:shadow-glow">
                <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${CAPABILITY_ACCENTS[i % CAPABILITY_ACCENTS.length]} transition-transform duration-300 group-hover:scale-110`}>
                  {Icon && <Icon className="h-5 w-5 text-white" />}
                </div>
                <h3 className="mb-1.5 text-base font-semibold text-white">{f.title}</h3>
                <p className="mb-3 text-sm leading-relaxed text-slate-400">{f.description}</p>
                <ul className="space-y-1">
                  {f.details.map((d) => (
                    <li key={d} className="flex items-center gap-1.5 text-[11px] text-slate-300">
                      <span className="h-1 w-1 flex-shrink-0 rounded-full bg-primary-400" />
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
