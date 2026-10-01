import { Award, Heart, Camera, Film } from 'lucide-react';

const stats = [
  { number: '500+', label: 'Weddings Captured' },
  { number: '12', label: 'Years of Experience' },
  { number: '50+', label: 'Cities Travelled' },
  { number: '100%', label: 'Happy Couples' },
];

const values = [
  {
    icon: Camera,
    title: 'Candid Storytelling',
    desc: 'We capture the tears, laughter, and stolen glances you didn\'t know happened.',
  },
  {
    icon: Film,
    title: 'Cinematic Films',
    desc: 'Every wedding film is edited to feel like a movie — your love story on screen.',
  },
  {
    icon: Heart,
    title: 'Heartfelt Approach',
    desc: 'We become part of your family for the day, blending in to catch real moments.',
  },
  {
    icon: Award,
    title: 'Award-Winning Quality',
    desc: 'Recognised for excellence in Indian wedding photography across Tamil Nadu.',
  },
];

export default function About() {
  return (
    <section id="about" className="relative py-20 sm:py-32 px-5 sm:px-8 overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px gold-line opacity-30" />

      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div className="relative">
            <div className="relative aspect-[4/5] rounded-sm overflow-hidden">
              <img
                src="https://images.pexels.com/photos/19613670/pexels-photo-19613670.jpeg?auto=compress&cs=tinysrgb&w=900"
                alt="Boopathi Raja R — Founder of Deebi Wedding Stories"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 border border-gold/30 rounded-sm m-3 pointer-events-none" />
            </div>
            <div className="absolute -bottom-6 -right-4 sm:-right-6 bg-ink-light border border-gold/30 px-6 py-4 rounded-sm shadow-xl">
              <p className="font-cinzel text-gold text-sm tracking-[0.2em]">BOOPATHI RAJA.R</p>
              <p className="text-warm-dark text-xs mt-1">Founder & Lead Photographer</p>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-4 mb-6">
              <span className="h-px w-10 bg-gold" />
              <p className="font-cinzel text-gold tracking-[0.3em] text-xs uppercase">Our Story</p>
            </div>

            <h2 className="font-playfair text-3xl sm:text-4xl md:text-5xl text-cream leading-tight mb-6">
              Preserving Love,
              <span className="block gold-gradient-text italic">One Frame at a Time</span>
            </h2>

            <div className="space-y-4 text-warm/75 leading-relaxed">
              <p>
                Deebi Wedding Stories was born from a simple belief — that your wedding
                day deserves more than just photographs. It deserves a visual legacy.
              </p>
              <p>
                Founded by <span className="text-gold-light">Boopathi Raja R</span> in
                Madurai, we have spent over a decade capturing the colours, emotions, and
                traditions of Indian weddings across Tamil Nadu and beyond. From intimate
                ceremonies to grand celebrations, we bring an artist's eye and a
                storyteller's heart to every occasion.
              </p>
              <p>
                Based in <span className="text-cream">Surya Nagar, Madurai</span>, we
                travel wherever love takes us.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6 mt-10">
              {stats.map((stat) => (
                <div key={stat.label} className="border-l border-gold/30 pl-4">
                  <p className="font-playfair text-3xl sm:text-4xl text-gold">{stat.number}</p>
                  <p className="text-warm-dark text-xs sm:text-sm mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-20 sm:mt-28">
          {values.map((value) => (
            <div
              key={value.title}
              className="group p-6 border border-white/10 hover:border-gold/40 transition-all duration-500 rounded-sm bg-ink-light/50"
            >
              <div className="w-12 h-12 rounded-full border border-gold/40 flex items-center justify-center mb-4 group-hover:bg-gold group-hover:border-gold transition-all duration-500">
                <value.icon className="w-5 h-5 text-gold group-hover:text-ink transition-colors" />
              </div>
              <h3 className="font-playfair text-lg text-cream mb-2">{value.title}</h3>
              <p className="text-sm text-warm/60 leading-relaxed">{value.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
