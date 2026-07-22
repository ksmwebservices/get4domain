import { TESTIMONIALS } from '@/lib/constants';

export default function Testimonials() {
  return (
    <section className="py-20 px-4 bg-bg-dark">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-accent font-semibold text-sm uppercase tracking-wide">
            Testimonials
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mt-2">
            What Our Passengers Say
          </h2>
        </div>

        <div className="flex gap-6 overflow-x-auto pb-4 md:grid md:grid-cols-2 lg:grid-cols-4 md:overflow-visible snap-x">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.author}
              className="bg-bg-card rounded-xl p-6 border border-white/5 min-w-[280px] md:min-w-0 snap-start flex flex-col"
            >
              <div className="text-accent mb-3">
                {'★'.repeat(t.rating)}
                {'☆'.repeat(5 - t.rating)}
              </div>
              <p className="text-sm text-text-light flex-1">&ldquo;{t.text}&rdquo;</p>
              <p className="text-sm font-semibold text-white mt-4">
                — {t.author}, {t.location}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
