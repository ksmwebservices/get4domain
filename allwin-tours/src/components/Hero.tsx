'use client';

import { useBookingModal } from './BookingModalContext';

const STATS = [
  { value: '5+', label: 'Years Exp.' },
  { value: '10K+', label: 'Passengers' },
  { value: '8+', label: 'Vehicles' },
  { value: '4.8★', label: 'Rating' },
];

export default function Hero() {
  const { openModal } = useBookingModal();

  const scrollToPackages = () => {
    document.getElementById('packages')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section
      className="relative min-h-screen flex flex-col justify-center bg-cover bg-center"
      style={{
        backgroundImage:
          "url('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080&fit=crop')",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/70 via-slate-900/50 to-slate-900/90" />

      <div className="relative flex-1 flex items-center justify-center px-4 pt-16">
        <div className="max-w-3xl mx-auto text-center animate-fade-in-up">
          <span className="inline-block border border-accent text-accent text-xs sm:text-sm font-medium px-4 py-1.5 rounded-full mb-6">
            🏆 #1 Rated Travels · Cuddalore District
          </span>

          <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight mb-6">
            Your Journey,
            <br />
            <span className="text-amber-400 italic">Our Priority</span>
          </h1>

          <p className="text-lg text-slate-300 max-w-2xl mx-auto mb-10">
            Premium cab services, expert drivers, and unforgettable tour experiences
            across Tamil Nadu &amp; South India. Pilgrimage · Packages · Airport
            Transfers · Weddings.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => openModal()}
              className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-slate-900 font-semibold px-8 py-3 rounded-lg transition-colors w-full sm:w-auto justify-center"
            >
              📅 Book Your Trip
            </button>
            <button
              onClick={scrollToPackages}
              className="inline-flex items-center gap-2 border border-white/60 text-white hover:bg-white/10 font-semibold px-8 py-3 rounded-lg transition-colors w-full sm:w-auto justify-center"
            >
              🗺️ Tour Packages
            </button>
          </div>
        </div>
      </div>

      <div className="relative bg-slate-900/70 border-t border-white/10">
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 px-4 py-8">
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-accent">{stat.value}</div>
              <div className="text-sm text-text-grey mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
