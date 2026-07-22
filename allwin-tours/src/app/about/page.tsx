import type { Metadata } from 'next';
import { BUSINESS, WHY_CHOOSE_US } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'About Us | Allwin Tours & Travels',
  description: 'About Allwin Tours & Travels, Cuddalore — our story and values.',
};

export default function AboutPage() {
  return (
    <section className="pt-32 pb-20 px-4 bg-bg-dark min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-accent font-semibold text-sm uppercase tracking-wide">
            About Us
          </span>
          <h1 className="text-3xl md:text-4xl font-bold text-white mt-2">
            Our Story
          </h1>
        </div>

        <div className="bg-bg-card rounded-xl border border-white/5 p-8 space-y-6">
          <p className="text-text-light leading-relaxed">
            {BUSINESS.name} has been serving travellers from {BUSINESS.location}{' '}
            with safe, comfortable and reliable journeys across Tamil Nadu and South
            India. From pilgrimage trips to family holidays, airport transfers to
            corporate travel, our team is committed to making every journey
            stress-free and memorable.
          </p>
          <p className="text-text-light leading-relaxed">
            With a fleet of well-maintained AC vehicles and experienced, verified
            drivers, we take pride in punctual service, transparent pricing, and
            round-the-clock support for our passengers.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mt-14">
          {WHY_CHOOSE_US.map((item) => (
            <div key={item.title} className="text-center">
              <div className="text-3xl mb-3">{item.icon}</div>
              <h3 className="text-sm font-semibold text-white">{item.title}</h3>
              <p className="text-xs text-text-grey mt-1">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
