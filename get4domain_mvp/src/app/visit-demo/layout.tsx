import type { Metadata } from 'next';

// The OTP gate entry for demos. page.tsx is a client component and cannot export metadata, so it lives here.
// Not disallowed in robots.txt on purpose: crawlers must be able to fetch it and read this noindex.
export const metadata: Metadata = {
  title: 'Verify to view the demo',
  robots: { index: false, follow: false },
};

export default function VisitDemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
