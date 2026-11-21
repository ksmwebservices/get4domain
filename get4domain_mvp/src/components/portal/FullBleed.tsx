import type { ReactNode } from 'react';

/** A band that spans the whole window while the page content stays in the shell's column. The shell clips sideways overflow, so there is no horizontal scroll. */
export default function FullBleed({ children, className = '', as: Tag = 'section', ...rest }: { children: ReactNode; className?: string; as?: 'section' | 'div'; [k: string]: unknown }) {
  return <Tag {...rest} className={`relative left-1/2 right-1/2 -mx-[50vw] w-screen ${className}`}>{children}</Tag>;
}
