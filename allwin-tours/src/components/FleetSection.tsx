import Image from 'next/image';
import { FLEET } from '@/lib/constants';

export default function FleetSection() {
  return (
    <section className="py-20 px-4 bg-slate-950/40">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-accent font-semibold text-sm uppercase tracking-wide">
            Our Fleet
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mt-2">
            Comfortable Vehicles &amp; Expert Drivers
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {FLEET.map((v) => (
            <div
              key={v.name}
              className="bg-bg-card rounded-xl overflow-hidden border border-white/5 hover:border-accent/40 transition-colors"
            >
              <div className="relative h-44 w-full">
                <Image src={v.image} alt={v.name} fill className="object-cover" />
              </div>
              <div className="p-5">
                <h3 className="text-lg font-bold text-white">{v.name}</h3>
                <p className="text-sm text-text-grey mt-1">
                  {v.seats} · {v.tags.join(' · ')}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
