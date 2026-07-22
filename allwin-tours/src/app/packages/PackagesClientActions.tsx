'use client';

import { useBookingModal } from '@/components/BookingModalContext';

export default function PackagesClientActions({ serviceName }: { serviceName: string }) {
  const { openModal } = useBookingModal();

  return (
    <button
      onClick={() => openModal(serviceName)}
      className="mt-6 w-full bg-accent hover:bg-accent-hover text-slate-900 font-semibold py-2.5 rounded-lg transition-colors"
    >
      Book This Package
    </button>
  );
}
