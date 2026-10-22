'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Content } from '@/lib/content';

const ContentCtx = createContext<Content | null>(null);

/** Hands the page's content (from the vendor's site document, or the service's own words) to the client components. */
export function ContentProvider({ value, children }: { value: Content; children: ReactNode }) {
  return <ContentCtx.Provider value={value}>{children}</ContentCtx.Provider>;
}

export function useContent(): Content {
  const c = useContext(ContentCtx);
  if (!c) throw new Error('useContent must be used inside the ContentProvider in the root layout');
  return c;
}
