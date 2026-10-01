'use client';

import { useBooking } from '@/components/site/BookingModal';

export default function ServiceBookingButton({ service, children, className }: { service: string; children: React.ReactNode; className?: string }) {
  const { openBooking } = useBooking();
  return <button onClick={() => openBooking(service)} className={className}>{children}</button>;
}
