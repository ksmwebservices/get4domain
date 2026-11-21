import Link from 'next/link';
import { SITE } from '@/lib/v3-public/site-strings';

/** "By continuing, you accept the Terms of Service and the Privacy Policy." with both links. No checkbox and no state: the sign-up form keeps its own accept box. */
export default function AcceptNotice({ className = 'mt-4 text-sm text-slate-600' }: { className?: string }) {
  const N = SITE.acceptNotice;
  return (
    <p className={className} data-accept-notice="">
      {N.before}
      <Link href="/terms" className="text-slate-700 underline">{N.terms}</Link>
      {N.between}
      <Link href="/privacy-policy" className="text-slate-700 underline">{N.privacy}</Link>
      {N.after}
    </p>
  );
}
