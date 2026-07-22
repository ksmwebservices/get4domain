import { SERVICES } from '@/lib/constants';

export default function ServicesSection() {
  return (
    <section className="py-20 px-4 bg-bg-dark">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-accent font-semibold text-sm uppercase tracking-wide">
            Our Services
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mt-2">
            Everything You Need for a Perfect Journey
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {SERVICES.map((s) => (
            <div
              key={s.title}
              className="bg-bg-card rounded-xl p-6 border border-white/5 hover:border-accent/40 transition-colors"
            >
              <div className="text-4xl mb-4">{s.icon}</div>
              <h3 className="text-lg font-bold text-white mb-2">{s.title}</h3>
              <p className="text-sm text-text-grey">{s.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
