import Link from 'next/link';
import JsonLd from '@/components/directory/JsonLd';
import { breadcrumbLd } from '@/lib/v3-public/site-jsonld';
import { SITE } from '@/lib/v3-public/site-strings';

/** Visible breadcrumbs plus their JSON-LD (the JSON-LD is left out when the main host is not set: no address is guessed). */
export default function Crumbs({ here, path }: { here: string; path: string }) {
  const ld = breadcrumbLd([{ name: SITE.crumbs.home, path: '/' }, { name: here, path }]);
  return (
    <>
      {ld ? <JsonLd items={[ld]} /> : null}
      <nav aria-label={SITE.crumbs.label} className="mb-4 text-sm text-slate-600">
        <ol className="flex gap-2">
          <li><Link href="/" className="hover:underline">{SITE.crumbs.home}</Link></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">{here}</li>
        </ol>
      </nav>
    </>
  );
}
