import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail, MessageCircle, PhoneCall, Headphones, Clock, ArrowRight, HelpCircle, MapPin } from 'lucide-react';
import PageHero from '@/components/PageHero';
import FAQ from '@/components/FAQ';
import CTABanner from '@/components/CTABanner';
import Button from '@/components/ui/Button';
import { createPageMetadata } from '@/lib/metadata';

export const metadata: Metadata = createPageMetadata({
  title: 'Support',
  description: 'Get answers to your questions and find the support you need to launch and grow your business online.',
  path: '/support',
});

// Policy (28-Aug-2026): no inbound number/WhatsApp. Support = assistant → callback → email.
const supportOptions = [
  { icon: MessageCircle, title: 'Chat with us', value: 'Instant answers', desc: 'Open the assistant, bottom-right', action: 'Ask a question', href: undefined },
  { icon: PhoneCall, title: 'Request a callback', value: 'We call you back', desc: 'Leave your number — no need to dial us', action: 'Request callback', href: '/contact' },
  { icon: Mail, title: 'Email Support', value: 'support@get4domain.com', desc: 'Reply within 4 hours', action: 'Send Email', href: 'mailto:support@get4domain.com' },
  { icon: Headphones, title: 'Help Center', value: 'Browse Articles', desc: 'Self-service guides & docs', action: 'Browse', href: undefined },
];

export default function SupportPage() {
  return (
    <>
      <PageHero
        eyebrow="Support"
        title="We're Here to Help"
        description="Get answers to your questions and find the support you need to launch and grow your business online."
        breadcrumbs={[{ label: 'Support' }]}
      />

      <section className="pb-12">
        <div className="container-mx container-px">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {supportOptions.map((option) => {
              const Icon = option.icon;
              return (
                <div key={option.title} className="card-base card-hover p-6 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50"><Icon className="h-6 w-6 text-primary-600" /></div>
                  <h3 className="mb-1 text-base font-bold text-slate-900">{option.title}</h3>
                  <p className="mb-1 text-sm font-medium text-primary-600">{option.value}</p>
                  <p className="mb-4 text-xs text-slate-500">{option.desc}</p>
                  {option.href
                    ? <Link href={option.href}><Button size="sm" variant="outline" fullWidth>{option.action}</Button></Link>
                    : <Button size="sm" variant="outline" fullWidth>{option.action}</Button>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <FAQ />

      <section className="py-12">
        <div className="container-mx container-px">
          <div className="mx-auto max-w-3xl rounded-2xl bg-primary-50 p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100"><Clock className="h-6 w-6 text-primary-600" /></div>
            <h3 className="text-lg font-bold text-slate-900">Support Hours</h3>
            <p className="mt-2 text-sm text-slate-600">Monday to Saturday: 9:00 AM - 8:00 PM IST</p>
            <p className="mt-1 text-sm text-slate-600">Callbacks are placed during support hours; the assistant is available anytime.</p>
            <p className="mt-4 flex items-center justify-center gap-1.5 text-sm text-slate-600">
              <MapPin className="h-4 w-4 text-primary-600" />
              Tidel Park, 1st Floor D Block, Tharamani, Chennai - 600113
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row justify-center">
              <Link href="/contact"><Button size="md" rightIcon={<ArrowRight className="h-4 w-4" />}>Contact Us</Button></Link>
              <Button size="md" variant="outline" leftIcon={<HelpCircle className="h-4 w-4" />}>Browse Help Center</Button>
            </div>
          </div>
        </div>
      </section>

      <CTABanner />
    </>
  );
}
