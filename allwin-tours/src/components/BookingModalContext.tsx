'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

type BookingModalContextValue = {
  isOpen: boolean;
  openModal: (service?: string) => void;
  closeModal: () => void;
  prefilledService: string;
};

const BookingModalContext = createContext<BookingModalContextValue | null>(null);

export function BookingModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [prefilledService, setPrefilledService] = useState('');

  const openModal = (service?: string) => {
    setPrefilledService(service ?? '');
    setIsOpen(true);
  };

  const closeModal = () => setIsOpen(false);

  return (
    <BookingModalContext.Provider value={{ isOpen, openModal, closeModal, prefilledService }}>
      {children}
    </BookingModalContext.Provider>
  );
}

export function useBookingModal() {
  const ctx = useContext(BookingModalContext);
  if (!ctx) {
    throw new Error('useBookingModal must be used within BookingModalProvider');
  }
  return ctx;
}
