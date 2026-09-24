import type { Metadata } from 'next';
import Link from 'next/link';
import { Footprints, Clock, Star, MessageCircle, ShoppingBag, MapPin, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'About — Step N Rock · Vadapalani, Chennai',
  description:
    'The story of Step N Rock — a family-run footwear and apparel store on the first floor of Rahaat Plaza, Vadapalani, Chennai. Serving the neighbourhood since 2011 with honest prices and real service.',
  keywords: ['Step N Rock', 'about', 'Vadapalani', 'Chennai', 'Rahaat Plaza', 'footwear store Chennai', 'shoe shop Chennai'],
  alternates: { canonical: 'https://stepnrock.com/about' },
  openGraph: {
    title: 'About — Step N Rock · Vadapalani, Chennai',
    description: 'A family-run footwear and apparel store in Vadapalani, Chennai since 2011.',
    url: 'https://stepnrock.com/about',
  },
};

const storeImg = 'https://images.pexels.com/photos/28271086/pexels-photo-28271086.jpeg?auto=compress&cs=tinysrgb&w=900';
const heroBg = 'https://images.pexels.com/photos/13807630/pexels-photo-13807630.jpeg?auto=compress&cs=tinysrgb&w=1400';

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative min-h-[50vh] flex items-end overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroBg} alt="Step N Rock store" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/90 via-foreground/60 to-foreground/30" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <nav className="text-sm text-background/70 mb-4">
            <Link href="/" className="hover:text-primary">Home</Link> / About
          </nav>
          <h1 className="font-display text-3xl md:text-5xl font-bold text-background mb-3 text-balance">
            Fifteen years of fitting Chennai
          </h1>
          <p className="text-background/80 max-w-xl">
            A family-run footwear and apparel store on the first floor of Rahaat Plaza, Vadapalani — built on comfort, value and a love for good design.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden">
              <img src={storeImg} alt="Step N Rock store interior" className="w-full h-full object-cover" />
            </div>
            <div className="space-y-5">
              <span className="text-primary text-sm font-semibold uppercase tracking-wider">How it started</span>
              <h2 className="font-display text-2xl md:text-3xl font-bold text-balance">
                From a single rack to a neighbourhood favourite
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                In 2011, we opened a small shop on the first floor of Rahaat Plaza with a single rack of sneakers and a simple belief: good footwear shouldn&apos;t cost a fortune, and buying it shouldn&apos;t feel like a chore.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Today Step N Rock stocks over a thousand styles across footwear and apparel — but we still fit every pair ourselves, still remember our regulars, and still price things the way a neighbourhood store should. No mall theatrics, no confusing discounts — just honest shoes and clothes that last.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button asChild><Link href="/shop">Browse the shop</Link></Button>
                <Button asChild variant="outline"><Link href="/contact">Visit the store</Link></Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 md:py-20 bg-secondary/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <span className="text-primary text-sm font-semibold uppercase tracking-wider">What we stand for</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold mt-2">Three things we never compromise on</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { num: '01', title: 'Comfort first', desc: 'If it isn\'t comfortable in the store, it won\'t be comfortable on the road. We fit every pair to your foot, not the other way round.' },
              { num: '02', title: 'Honest pricing', desc: 'Fair, transparent prices all year round — no artificial mark-ups just to mark them down again during a "sale".' },
              { num: '03', title: 'Neighbourhood care', desc: 'We know our regulars by name. Walk in, WhatsApp, or call — you\'ll talk to a person, not a chatbot.' },
            ].map((val) => (
              <div key={val.num} className="p-6 rounded-2xl border border-border hover:shadow-lg transition-shadow bg-background">
                <div className="text-3xl font-bold text-primary/20 mb-3">{val.num}</div>
                <h3 className="font-semibold text-lg mb-2">{val.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{val.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Band */}
      <section className="py-12 border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: ShoppingBag, title: '1,200+ styles', desc: 'Across footwear and apparel.' },
              { icon: Clock, title: '15 years', desc: 'Serving Vadapalani since 2011.' },
              { icon: Star, title: '4.8★ rated', desc: 'By customers across Chennai.' },
              { icon: MapPin, title: '7 days a week', desc: '10:30 AM to 9:00 PM, always.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-primary mx-auto mb-3">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Band */}
      <section className="py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-foreground text-background rounded-3xl p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="font-display text-2xl md:text-3xl font-bold mb-2">Come say hello</h2>
              <p className="text-background/70">We&apos;re on the first floor of Rahaat Plaza, Vadapalani — easy to find, easier to talk to.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <Button asChild size="lg"><Link href="/contact">Contact & directions <ArrowRight className="h-4 w-4 ml-1" /></Link></Button>
              <Button asChild size="lg" variant="outline" className="bg-transparent border-background/30 text-background hover:bg-background/10 hover:text-background"><Link href="/shop">Shop online</Link></Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
