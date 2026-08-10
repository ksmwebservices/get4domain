'use client';

import { useEffect, useRef, useState } from 'react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

/**
 * Mobile-first sheet. On < md it slides up from the bottom with a drag handle
 * and swipe-down-to-dismiss; on md+ it renders as a normal centered modal.
 * Backdrop click and Escape both dismiss.
 */
export default function BottomSheet({ isOpen, onClose, title, children }: BottomSheetProps) {
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => { if (isOpen) setDragY(0); }, [isOpen]);

  if (!isOpen) return null;

  const onTouchStart = (e: React.TouchEvent) => { startY.current = e.touches[0].clientY; };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) setDragY(dy);
  };
  const onTouchEnd = () => {
    if (dragY > 120) onClose();
    setDragY(0);
    startY.current = null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 md:items-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ transform: dragY ? `translateY(${dragY}px)` : undefined }}
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl transition-transform duration-200 md:max-w-md md:rounded-2xl"
      >
        <div
          className="mx-auto mb-3 h-1.5 w-10 cursor-grab rounded-full bg-slate-200 md:hidden"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        />
        {title && <h3 className="mb-4 text-base font-bold text-slate-900">{title}</h3>}
        {children}
      </div>
    </div>
  );
}
