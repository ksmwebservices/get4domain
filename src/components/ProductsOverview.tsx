import Link from 'next/link';
import { Globe, Megaphone, Check, ArrowRight } from 'lucide-react';
import Button from './ui/Button';
import { SectionHeading } from './ui/Accordion';

const products = [
  {
    id: 'domainapp',
    icon: Globe,
    accentBg: 'bg-primary-600',
    badge: 'Business OS',
    badgeBg: 'bg-primary-50 text-primary-700',
    title: 'DomainApp',
    desc: 'A complete Business Operating System for Indian SMBs. Professional website, CRM, HR, accounting, invoicing, inventory and reports — all in one subscription.',
    plans: ['Startup — ₹6,999/yr', 'Enterprise — ₹24,999/yr'],
    highlights: [
      'Professional industry website with CMS',
      'Lead CRM, Customer CRM, Telecalling',
      'GST Invoicing & Accounting',
      'HR, Payroll & Attendance',
      'Inventory Management',
    ],
    href: '/domain-app',
    cta: 'Explore DomainApp',
    demoHref: '/book-demo',
    image: 'https://images.pexels.com/photos/3601425/pexels-photo-3601425.jpeg?auto=compress&cs=tinysrgb&w=800',
    liveUrl: 'https://mrtravels.get4domain.com',
    liveLabel: 'MR Travels — Live Demo',
  },
  {
    id: 'domaincampaign',
    icon: Megaphone,
    accentBg: 'bg-secondary-600',
    badge: 'Managed Service',
    badgeBg: 'bg-secondary-50 text-secondary-700',
    title: 'DomainCampaign',
    desc: 'Fully managed digital marketing. Our team creates content, manages social media, runs SEO and delivers monthly reports. You focus on running your business.',
    plans: ['Starter — ₹6,999/yr', 'Business — ₹29,999/yr'],
    highlights: [
      'Up to 120 social media posts/month',
      'SEO — up to 10 keywords',
      'Google Business Profile management',
      'Up to 150 poster designs/month',
      '10 blog articles + campaign reports',
    ],
    href: '/domain-campaign',
    cta: 'Explore DomainCampaign',
    demoHref: '/book-demo',
    image: 'https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg?auto=compress&cs=tinysrgb&w=800',
    liveUrl: null,
    liveLabel: null,
  },
];

export default function ProductsOverview() {
  return (
    <section className="section-py bg-gradient-to-b from-slate-50 to-white">
      <div className="container-mx container-px">
        <SectionHeading
          eyebrow="Our Products"
          title="Two Powerful Products. One Platform."
          description="Get4Domain offers two independent SaaS products built for Indian SMBs. Use one or both — they work seamlessly together."
        />
        <div className="grid gap-8 lg:grid-cols-2">
          {products.map((product) => {
            const Icon = product.icon;
            return (
              <div key={product.id} className="card-base overflow-hidden group">
                {/* Image */}
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={product.image}
                    alt={product.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
                  {product.liveUrl && (
                    <a
                      href={product.liveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg bg-white/90 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-white transition-colors"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-success-500 animate-pulse" />
                      {product.liveLabel}
                    </a>
                  )}
                </div>

                {/* Content */}
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${product.accentBg}`}>
                      <Icon className="h-4.5 w-4.5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{product.title}</h3>
                      <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${product.badgeBg}`}>{product.badge}</span>
                    </div>
                  </div>

                  <p className="text-sm text-slate-600 leading-relaxed mb-4">{product.desc}</p>

                  <ul className="space-y-1.5 mb-5">
                    {product.highlights.map((h) => (
                      <li key={h} className="flex items-center gap-2 text-xs text-slate-700">
                        <Check className="h-3.5 w-3.5 text-success-500 flex-shrink-0" />
                        {h}
                      </li>
                    ))}
                  </ul>

                  <div className="border-t border-slate-100 pt-4 mb-4">
                    <div className="flex gap-3 text-xs text-slate-500">
                      {product.plans.map((p) => (
                        <span key={p} className="rounded-lg bg-slate-50 px-2.5 py-1 font-medium">{p}</span>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Link href={product.demoHref} className="flex-1">
                      <Button size="sm" fullWidth>Book a Demo</Button>
                    </Link>
                    <Link href={product.href}>
                      <Button size="sm" variant="outline" rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>
                        {product.cta}
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
