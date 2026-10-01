import { Star, Quote } from 'lucide-react';

const testimonials = [
  {
    name: 'Priya & Karthik',
    location: 'Madurai',
    text: 'Boopathi and his team captured our wedding like no one else could. Every photo tells a story. The cinematic film made our families cry happy tears. Truly worth every rupee.',
    rating: 5,
    image: 'https://images.pexels.com/photos/37797085/pexels-photo-37797085.jpeg?auto=compress&cs=tinysrgb&w=400',
  },
  {
    name: 'Divya & Arun',
    location: 'Chennai',
    text: 'We were blown away by the quality and creativity. The team was so unobtrusive that we forgot they were there — yet they captured every single emotion perfectly.',
    rating: 5,
    image: 'https://images.pexels.com/photos/31531918/pexels-photo-31531918.jpeg?auto=compress&cs=tinysrgb&w=400',
  },
  {
    name: 'Lakshmi & Suresh',
    location: 'Coimbatore',
    text: 'Deebi Wedding Stories gave us memories we will cherish forever. The pre-wedding shoot was so fun and relaxed. The album is absolutely stunning — pure art.',
    rating: 5,
    image: 'https://images.pexels.com/photos/38644048/pexels-photo-38644048.jpeg?auto=compress&cs=tinysrgb&w=400',
  },
  {
    name: 'Ananya & Vikram',
    location: 'Trichy',
    text: 'From the mehendi to the reception, every moment was beautifully documented. Boopathi has an incredible eye for detail. Highly recommended for any couple.',
    rating: 5,
    image: 'https://images.pexels.com/photos/26960744/pexels-photo-26960744.jpeg?auto=compress&cs=tinysrgb&w=400',
  },
];

export default function Testimonials() {
  return (
    <section id="testimonials" className="relative py-20 sm:py-32 px-5 sm:px-8 bg-ink-light overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px gold-line opacity-30" />

      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-4 mb-4">
            <span className="h-px w-10 bg-gold" />
            <p className="font-cinzel text-gold tracking-[0.3em] text-xs uppercase">Couples Speak</p>
            <span className="h-px w-10 bg-gold" />
          </div>
          <h2 className="font-playfair text-3xl sm:text-4xl md:text-5xl text-cream">
            Love Stories We've
            <span className="gold-gradient-text italic"> Had the Honour to Tell</span>
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.name}
              className="relative p-8 border border-white/8 hover:border-gold/30 transition-all duration-500 rounded-sm bg-ink/60 group"
            >
              <Quote className="absolute top-6 right-6 w-10 h-10 text-gold/10 group-hover:text-gold/20 transition-colors" />

              <div className="flex gap-1 mb-4">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-gold text-gold" />
                ))}
              </div>

              <p className="text-warm/75 leading-relaxed text-sm sm:text-base mb-6 italic">
                "{testimonial.text}"
              </p>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full overflow-hidden border border-gold/30 flex-shrink-0">
                  <img
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="font-playfair text-cream text-base">{testimonial.name}</p>
                  <p className="text-warm-dark text-xs tracking-wide">{testimonial.location}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
