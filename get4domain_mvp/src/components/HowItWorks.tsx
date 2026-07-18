import { Calendar, MessageCircle, CreditCard, Settings, Rocket } from 'lucide-react';
import { SectionHeading } from './ui/Accordion';

const iconMap: Record<string, React.ElementType> = { Calendar, MessageCircle, CreditCard, Settings, Rocket };

const steps = [
  { icon: 'Calendar', title: 'Book a Demo', description: 'Fill a short form with your industry and goals. Our consultant calls you within 24 hours.' },
  { icon: 'MessageCircle', title: 'Requirement Discussion', description: 'We show live demos, understand your business needs and recommend the right plan.' },
  { icon: 'CreditCard', title: 'Pay via Dashboard', description: 'Receive a secure payment link in your dashboard. Pay via Razorpay — UPI, card or net banking.' },
  { icon: 'Settings', title: 'Design & Build', description: 'Our team builds your complete platform — website, CRM, modules as per your chosen plan.' },
  { icon: 'Rocket', title: 'Review & Go Live', description: 'Review everything, request any adjustments, then launch. Your business is ready to grow.' },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="section-py bg-slate-50">
      <div className="container-mx container-px">
        <SectionHeading
          eyebrow="How It Works"
          title="From Enquiry to Launch in 5 Steps"
          description="A simple, transparent process. No surprises, no confusion — just a smooth launch for your business."
        />
        <div className="relative">
          {/* Connector line */}
          <div className="absolute left-1/2 top-8 hidden h-0.5 w-[calc(100%-160px)] -translate-x-1/2 bg-slate-200 lg:block" />
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((step, i) => {
              const Icon = iconMap[step.icon] ?? Calendar;
              return (
                <div key={step.title} className="relative flex flex-col items-center text-center">
                  <div className="relative z-10 mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white border-2 border-primary-200 shadow-card">
                    <Icon className="h-7 w-7 text-primary-600" />
                    <div className="absolute -top-2.5 -right-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
                      {i + 1}
                    </div>
                  </div>
                  <h3 className="mb-2 text-base font-bold text-slate-900">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-500">{step.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
