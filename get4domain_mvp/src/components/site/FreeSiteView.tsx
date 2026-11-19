import type { FreeView } from '@/lib/v3-public/site-state';

/**
 * The page of a Free site: information only. By rule it has no contact form, no chat widget, no button, no link and no e-mail address
 * (the phone number is plain text). Do not add any of those here; a test scans this file for them.
 */
export default function FreeSiteView({ view }: { view: FreeView }) {
  return (
    <div className="min-h-screen bg-white" data-testid="free-site">
      <header className="border-b border-slate-200">
        <div className="mx-auto max-w-3xl px-5 py-8">
          {view.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={view.logo} alt={`${view.name} logo`} className="mb-3 h-14 w-14 rounded-xl object-contain" />
          ) : null}
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{view.name}</h1>
          {view.tagline ? <p className="mt-2 text-lg text-slate-600">{view.tagline}</p> : null}
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-10 px-5 py-10">
        {view.banner ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={view.banner} alt={view.name} className="max-h-72 w-full rounded-2xl object-cover" />
        ) : null}
        {view.about ? (
          <section>
            <h2 className="text-xl font-semibold text-slate-900">About {view.name}</h2>
            <p className="mt-2 whitespace-pre-line text-slate-700">{view.about}</p>
          </section>
        ) : null}
        {view.items.length > 0 ? (
          <section>
            <h2 className="text-xl font-semibold text-slate-900">What we offer</h2>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              {view.items.map((x, i) => (
                <li key={`${x.name}-${i}`} className="rounded-xl border border-slate-200 p-4">
                  {x.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={x.image} alt={x.name} className="mb-3 h-36 w-full rounded-lg object-cover" />
                  ) : null}
                  <p className="font-semibold text-slate-900">{x.name}</p>
                  {x.price ? <p className="text-sm text-slate-700">{x.price}</p> : null}
                  {x.description ? <p className="mt-1 text-sm text-slate-600">{x.description}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {view.address || view.phone ? (
          <section>
            <h2 className="text-xl font-semibold text-slate-900">Find us</h2>
            {view.address ? <p className="mt-2 text-slate-700">{view.address}</p> : null}
            {view.phone ? <p className="mt-1 text-slate-700">Phone: {view.phone}</p> : null}
          </section>
        ) : null}
      </main>
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <p>{view.name}. Website by Get4Domain.</p>
      </footer>
    </div>
  );
}
