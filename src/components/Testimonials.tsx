import { testimonials } from '@/data/content';
import { SectionHeading } from './ui/Accordion';
import { Star, Quote } from 'lucide-react';
import Image from 'next/image';

interface TestimonialsProps {
  limit?: number;
}

export default function Testimonials({ limit }: TestimonialsProps) {
  const items = limit ? testimonials.slice(0, limit) : testimonials;

  return (
    <section id="testimonials">
      <div className="container-mx container-px">
        <SectionHeading
          eyebrow="Client Stories"
          title="What Our Clients Say"
          description="Businesses across India that trusted Get4Domain to launch and grow their online presence."
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div key={item.id} className="card-base p-6 flex flex-col">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex gap-0.5">
                  {Array.from({ length: item.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-secondary-400 text-secondary-400" />
                  ))}
                </div>
                <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700">
                  {item.product}
                </span>
              </div>
              <Quote className="h-6 w-6 text-slate-200 mb-2" />
              <p className="flex-1 text-sm leading-relaxed text-slate-600 mb-5">{item.review}</p>
              <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
                <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full">
                  <Image src={item.avatar} alt={item.ownerName} fill className="object-cover" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">{item.ownerName}</div>
                  <div className="text-xs text-slate-500">{item.businessName} · {item.city}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
