'use client';

import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

const slides = [
  {
    image: 'https://images.pexels.com/photos/17657612/pexels-photo-17657612.jpeg?auto=compress&cs=tinysrgb&w=1920',
    caption: 'Every love story is beautiful, but yours should be unforgettable',
  },
  {
    image: 'https://images.pexels.com/photos/30184675/pexels-photo-30184675.jpeg?auto=compress&cs=tinysrgb&w=1920',
    caption: 'We don\'t just take photos. We craft heirlooms.',
  },
  {
    image: 'https://images.pexels.com/photos/18361996/pexels-photo-18361996.jpeg?auto=compress&cs=tinysrgb&w=1920',
    caption: 'From the first look to the last dance — every moment, preserved.',
  },
];

export default function Hero() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const scrollToContent = () => {
    document.querySelector('#about')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section id="home" className="relative h-screen min-h-[600px] w-full overflow-hidden">
      {slides.map((slide, index) => (
        <div
          key={index}
          className="absolute inset-0 transition-opacity duration-[2000ms]"
          style={{ opacity: index === current ? 1 : 0 }}
        >
          <div
            className={cn(
              'absolute inset-0 bg-cover bg-center',
              index === current && 'animate-ken-burns'
            )}
            style={{ backgroundImage: `url(${slide.image})` }}
          />
        </div>
      ))}

      <div className="absolute inset-0 hero-overlay" />

      <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-6">
        <div className="animate-fade-up" style={{ animationDelay: '0.3s', opacity: 0 }}>
          <div className="flex items-center justify-center gap-4 mb-6">
            <span className="h-px w-12 bg-gold/60" />
            <p className="font-cinzel text-gold tracking-[0.4em] text-xs sm:text-sm uppercase">
              Madurai · Tamil Nadu
            </p>
            <span className="h-px w-12 bg-gold/60" />
          </div>
        </div>

        <h1
          className="font-playfair text-4xl sm:text-6xl md:text-7xl lg:text-8xl text-cream leading-[1.1] max-w-4xl animate-fade-up"
          style={{ animationDelay: '0.5s', opacity: 0 }}
        >
          Deebi
          <span className="block gold-gradient-text italic">Wedding Stories</span>
        </h1>

        <p
          className="mt-6 text-warm/80 text-base sm:text-lg md:text-xl max-w-2xl leading-relaxed font-light animate-fade-up"
          style={{ animationDelay: '0.7s', opacity: 0 }}
        >
          {slides[current].caption}
        </p>

        <div
          className="mt-10 flex flex-col sm:flex-row gap-4 animate-fade-up"
          style={{ animationDelay: '0.9s', opacity: 0 }}
        >
          <button
            onClick={() => document.querySelector('#portfolio')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-8 py-3.5 bg-gold text-ink text-sm tracking-[0.15em] uppercase font-medium hover:bg-gold-light transition-colors duration-300 rounded-sm"
          >
            View Portfolio
          </button>
          <button
            onClick={() => document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-8 py-3.5 border border-cream/30 text-cream text-sm tracking-[0.15em] uppercase font-medium hover:border-gold hover:text-gold transition-all duration-300 rounded-sm"
          >
            Enquire Now
          </button>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 hidden sm:flex flex-col items-center gap-2">
        <span className="text-warm/50 text-xs tracking-[0.3em] uppercase">Scroll</span>
        <ChevronDown className="w-4 h-4 text-gold/60 animate-bounce" />
      </div>

      <div className="absolute bottom-6 right-6 z-10 hidden sm:flex gap-2">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrent(index)}
            className={`h-1 transition-all duration-300 rounded-full ${
              index === current ? 'w-8 bg-gold' : 'w-4 bg-cream/30'
            }`}
            aria-label={`Slide ${index + 1}`}
          />
        ))}
      </div>
    </section>
  );
}

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
