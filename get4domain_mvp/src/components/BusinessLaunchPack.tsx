import Link from 'next/link';
import { CalendarCheck, ArrowRight } from 'lucide-react';
import Button from './ui/Button';
export default function BusinessLaunchPack() {
  return (
    <section className="section-py bg-gradient-to-b from-slate-50 to-white">
      <div className="container-mx container-px text-center">
        <h2 className="text-2xl font-bold text-slate-900">Ready to Launch?</h2>
        <p className="mt-3 text-slate-600 max-w-lg mx-auto">Book a free demo to see DomainApp and DomainCampaign in action.</p>
        <div className="mt-6 flex justify-center gap-4">
          <Link href="/book-demo"><Button leftIcon={<CalendarCheck className="h-4 w-4" />} rightIcon={<ArrowRight className="h-4 w-4" />}>Book a Free Demo</Button></Link>
          <Link href="/pricing"><Button variant="outline">View Pricing</Button></Link>
        </div>
      </div>
    </section>
  );
}
