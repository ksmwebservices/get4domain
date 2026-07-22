'use client';

import Image from 'next/image';
import { PACKAGES } from '@/lib/constants';
import { useBookingModal } from './BookingModalContext';

export default function PackagesSection() {
  const { openModal } = useBookingModal();

  return (
    <section id="packages" className="py-20 px-4 bg-bg-dark">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-accent font-semibold text-sm uppercase tracking-wide">
            Popular Packages
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mt-2">
            Top Tamil Nadu Destinations
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {PACKAGES.map((pkg) => (
            <div
              key={pkg.slug}
              className="bg-bg-card rounded-xl overflow-hidden border border-white/5 hover:border-accent/40 transition-colors flex flex-col"
            >
              <div className="relative h-48 w-full">
                <Image src={pkg.image} alt={pkg.name} fill className="object-cover" />
              </div>
              <div className="p-6 flex flex-col flex-1">
                <h3 className="text-xl font-bold text-white">{pkg.name}</h3>
                <p className="text-sm text-text-grey mt-1">
                  {pkg.duration} · ₹{pkg.price}/person
                </p>
                <ul className="mt-4 space-y-1.5 flex-1">
                  {pkg.highlights.map((h) => (
                    <li key={h} className="text-sm text-text-light flex items-start gap-2">
                      <span className="text-accent mt-0.5">•</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => openModal(pkg.name)}
                  className="mt-6 w-full bg-accent hover:bg-accent-hover text-slate-900 font-semibold py-2.5 rounded-lg transition-colors"
                >
                  Book This Package
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
