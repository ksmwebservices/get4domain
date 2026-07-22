import { BUSINESS } from '@/lib/constants';

export default function WhatsAppButton() {
  return (
    <a
      href={`https://wa.me/${BUSINESS.whatsapp}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-36 right-6 md:bottom-24 z-40 w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center shadow-lg shadow-black/30 transition-colors"
    >
      <span className="text-2xl">💬</span>
    </a>
  );
}
