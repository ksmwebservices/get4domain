import { Inter } from 'next/font/google';

/** The one typeface of the portal, served from our own host by next/font (no request to a font host from the visitor's browser). */
export const portalFont = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-portal' });
