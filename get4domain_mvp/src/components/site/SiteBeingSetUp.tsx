/** Shown for an address that has a site which cannot be shown yet (a draft, or a build that is not ready). Plain: no form, no link, no e-mail, no chat. */
export default function SiteBeingSetUp() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-5 py-16" data-testid="site-being-set-up">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">This site is being set up</h1>
      <p className="mt-3 text-slate-600">This address belongs to a business that is getting its website ready. Please check back in a little while.</p>
    </main>
  );
}
