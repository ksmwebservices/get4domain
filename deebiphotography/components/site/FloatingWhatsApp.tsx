'use client';

import { useEffect, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';

const WHATSAPP_NUMBER = '919566621288';

export default function FloatingWhatsApp() {
  const [visible, setVisible] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => setTooltipOpen(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 right-4 z-40 md:bottom-6 flex flex-col items-end gap-2">
      {tooltipOpen && (
        <div className="relative bg-ink-light border border-gold/30 rounded-sm px-4 py-3 shadow-xl max-w-[200px] animate-fade-in">
          <button
            onClick={() => setTooltipOpen(false)}
            className="absolute -top-2 -right-2 w-5 h-5 bg-ink border border-gold/30 rounded-full flex items-center justify-center"
          >
            <X className="w-3 h-3 text-warm" />
          </button>
          <p className="text-cream text-sm font-medium">Planning your wedding?</p>
          <p className="text-warm/60 text-xs mt-1">Chat with us on WhatsApp!</p>
        </div>
      )}

      <a
        href={`https://wa.me/${WHATSAPP_NUMBER}?text=Hello%20Deebi%20Wedding%20Stories!%20I%20would%20like%20to%20enquire%20about%20your%20services.`}
        target="_blank"
        rel="noopener noreferrer"
        className="w-14 h-14 rounded-full bg-[#25D366] flex items-center justify-center shadow-lg shadow-[#25D366]/30 hover:scale-110 transition-transform animate-float"
        aria-label="WhatsApp"
      >
        <MessageCircle className="w-6 h-6 text-white" />
      </a>
    </div>
  );
}
