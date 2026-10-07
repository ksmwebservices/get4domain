import type { Metadata } from 'next';

// Pay links are private: never indexed, never cached by crawlers, no referrer leak of the token.
export const metadata: Metadata = {
  title: 'Pay your invoice | Get4Domain',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

export default function PayLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-50">{children}</div>;
}
