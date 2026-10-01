'use client';

import { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { portfolioCategories as categories } from '@/lib/portfolio';
import { usePortfolio } from '@/lib/use-services';

export default function Portfolio() {
  const { photos } = usePortfolio();
  const [activeCategory, setActiveCategory] = useState('All');
  const [lightbox, setLightbox] = useState<number | null>(null);

  const filtered = activeCategory === 'All'
    ? photos
    : photos.filter((p) => p.category === activeCategory);

  const openLightbox = (index: number) => setLightbox(index);
  const closeLightbox = () => setLightbox(null);
  const nextPhoto = () => setLightbox((prev) => prev === null ? null : (prev + 1) % filtered.length);
  const prevPhoto = () => setLightbox((prev) => prev === null ? null : (prev - 1 + filtered.length) % filtered.length);

  return (
    <section id="portfolio" className="relative py-20 sm:py-32 px-5 sm:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-4 mb-4">
            <span className="h-px w-10 bg-gold" />
            <p className="font-cinzel text-gold tracking-[0.3em] text-xs uppercase">Our Work</p>
            <span className="h-px w-10 bg-gold" />
          </div>
          <h2 className="font-playfair text-3xl sm:text-4xl md:text-5xl text-cream">
            A Gallery of
            <span className="gold-gradient-text italic"> Love Stories</span>
          </h2>
        </div>

        <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-10">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-5 py-2 text-xs sm:text-sm tracking-wide rounded-sm transition-all duration-300 ${
                activeCategory === cat
                  ? 'bg-gold text-ink font-medium'
                  : 'border border-white/15 text-warm/60 hover:border-gold/50 hover:text-gold'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 auto-rows-[180px] sm:auto-rows-[220px]">
          {filtered.map((photo, index) => (
            <div
              key={`${photo.src}-${index}`}
              onClick={() => openLightbox(index)}
              className={`group relative overflow-hidden rounded-sm cursor-pointer ${photo.span}`}
            >
              <img
                src={photo.src}
                alt={photo.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-ink/70 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col items-center justify-center">
                <p className="font-playfair text-cream text-lg sm:text-xl text-center px-4">
                  {photo.title}
                </p>
                <p className="text-gold text-xs tracking-[0.2em] uppercase mt-2">{photo.category}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {lightbox !== null && (
        <div
          className="fixed inset-0 z-[60] bg-ink/95 backdrop-blur-sm flex items-center justify-center animate-fade-in"
          onClick={closeLightbox}
        >
          <button
            className="absolute top-6 right-6 text-cream/70 hover:text-gold transition-colors"
            onClick={closeLightbox}
          >
            <X className="w-8 h-8" />
          </button>
          <button
            className="absolute left-4 sm:left-8 text-cream/70 hover:text-gold transition-colors"
            onClick={(e) => { e.stopPropagation(); prevPhoto(); }}
          >
            <ChevronLeft className="w-10 h-10" />
          </button>
          <div className="max-w-4xl max-h-[80vh] px-4" onClick={(e) => e.stopPropagation()}>
            <img
              src={filtered[lightbox].src}
              alt={filtered[lightbox].title}
              className="max-w-full max-h-[75vh] object-contain rounded-sm"
            />
            <p className="font-playfair text-cream text-center mt-4 text-lg">{filtered[lightbox].title}</p>
            <p className="text-gold text-center text-xs tracking-[0.2em] uppercase mt-1">{filtered[lightbox].category}</p>
          </div>
          <button
            className="absolute right-4 sm:right-8 text-cream/70 hover:text-gold transition-colors"
            onClick={(e) => { e.stopPropagation(); nextPhoto(); }}
          >
            <ChevronRight className="w-10 h-10" />
          </button>
        </div>
      )}
    </section>
  );
}
