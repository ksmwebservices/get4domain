import Link from 'next/link';
import { ArrowRight, CalendarCheck } from 'lucide-react';
import Button from './ui/Button';

export default function CTABanner() {
  return (
    <section className="section-py">
      <div className="container-mx container-px">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary-700 via-primary-600 to-primary-500 px-8 py-14 text-center sm:px-12">
          {/* BG decoration */}
          <div className="absolute -top-16 -right-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />

          <div className="relative">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary-200">Ready to get started?</p>
            <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
              Let&apos;s Launch Your Business the Right Way
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-primary-100 leading-relaxed">
              Book a free demo with our consultant. See live demos of your industry, get a custom plan recommendation and a clear project timeline — no commitment required.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/book-demo">
                <Button
                  size="lg"
                  className="bg-white text-primary-700 hover:bg-primary-50 shadow-lg"
                  leftIcon={<CalendarCheck className="h-5 w-5" />}
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                >
                  Book a Free Demo
                </Button>
              </Link>
              <Link href="/industries">
                <Button size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10 hover:border-white/60">
                  See Industry Demos
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-xs text-primary-200">
              Our consultant calls within 24 hours · No obligation
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
