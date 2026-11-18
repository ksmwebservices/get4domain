import type { ReactNode } from 'react';
import FullBleed from '@/components/portal/FullBleed';
import SearchBox, { type SearchBoxProps } from '@/components/portal/SearchBox';
import { CONTAINER } from '@/components/portal/ui';

/** The band at the top of the directory pages: the heading, a sentence, and the same search box as the home page (business mode only). */
export default function DirectoryHero({ h1, lead, search, children }: { h1: string; lead: string; search: SearchBoxProps; children?: ReactNode }) {
  return (
    <FullBleed className="-mt-8 overflow-hidden bg-gradient-to-br from-ink-950 via-ink-900 to-brand-900 pb-10 pt-10 sm:pb-14 sm:pt-14">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-radial-glow" />
      <div className={`${CONTAINER} relative`}>
        <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-4xl">{h1}</h1>
        <p className="mt-3 max-w-2xl text-base text-ink-200 sm:text-lg">{lead}</p>
        <div className="mt-6 max-w-4xl"><SearchBox {...search} showDomain={false} /></div>
        {children}
      </div>
    </FullBleed>
  );
}
