'use client';

import { Suspense, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/auth-context';
import { useDashboardConfig } from '@/lib/dashboard-config';
import { resolveView } from '@/domainapp/tab-registry';
import DomainAppTab from '@/domainapp/DomainAppTab';
import ContactsView from '@/domainapp/shared/ContactsView';
import InvoicingView from '@/domainapp/shared/InvoicingView';
import { tabOwner, type Feature } from '@/lib/nav.generated';
import { WebsiteSectionContext } from '@/dashboard-v2/section-context';
import { SCREENS, type IndustryOwner } from '@/dashboard-v2/screens';
import { Loader2 } from 'lucide-react';

const MyWebsite = dynamic(() => import('@/app/dashboard/my-website/page'), { loading: () => <Spinner /> });
const MyProducts = dynamic(() => import('@/app/dashboard/my-products/page'), { loading: () => <Spinner /> });
const WebOrders = dynamic(() => import('@/app/dashboard/orders/page'), { loading: () => <Spinner /> });

function Spinner() { return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>; }

interface HubTab { key: string; label: string; node: React.ReactNode }

/** Industry operation tabs that belong to a v2 screen, for THIS vendor's industry (existing editors, unchanged, add-on rules unchanged). */
function useIndustryTabs(owner: IndustryOwner): { tabs: HubTab[]; loading: boolean } {
  const { user } = useAuth();
  const cfg = useDashboardConfig(user?.industry);
  return useMemo(() => {
    if (cfg.loading && !cfg.industry) return { tabs: [], loading: true };
    const industry = cfg.industry;
    const own = (industry?.dashboardTabs ?? []).filter((t) => tabOwner(t.key) === owner && resolveView(t.key) !== 'addon'); // stub tabs ("coming soon" placeholders) do not appear
    const fromIndustry: HubTab[] = own.map((t) => ({ key: t.key, label: owner === 'products' ? `${t.label} (back office)` : t.label, node: <DomainAppTab tabKey={t.key} /> }));
    const lead: HubTab[] = owner === 'products' ? [{ key: 'catalogue', label: 'Your products', node: <MyProducts /> }]
      : owner === 'orders' ? [{ key: 'website', label: 'Website orders', node: <WebOrders /> }] : [];
    const tabs = [...lead, ...fromIndustry];
    if (tabs.length === 0 && owner === 'customers' && industry) tabs.push({ key: 'customers', label: 'Customers', node: <ContactsView industry={industry} icon={industry.icon} /> });
    if (tabs.length === 0 && owner === 'invoices' && industry) tabs.push({ key: 'invoices', label: 'Customer invoices', node: <InvoicingView industry={industry} actionLabel="Invoice" /> });
    return { tabs, loading: false };
  }, [cfg.loading, cfg.industry, owner]);
}

function TabBar({ tabs, active, base }: { tabs: { key: string; label: string }[]; active: string; base: string }) {
  return (
    <div role="tablist" aria-label="Sections" className="mb-5 flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
      {tabs.map((t) => (
        <Link key={t.key} role="tab" aria-selected={t.key === active} href={`${base}?tab=${encodeURIComponent(t.key)}`} replace scroll={false}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${t.key === active ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{t.label}</Link>
      ))}
    </div>
  );
}

function Tabbed({ tabs, base }: { tabs: HubTab[]; base: string }) {
  const params = useSearchParams();
  const want = params.get('tab');
  const active = tabs.find((t) => t.key === want) ?? tabs[0];
  if (!active) return null;
  return (
    <div>
      {tabs.length > 1 && <TabBar tabs={tabs} active={active.key} base={base} />}
      <div key={active.key}>{active.node}</div>
    </div>
  );
}

function IndustryHub({ owner, base }: { owner: IndustryOwner; base: string }) {
  const { tabs, loading } = useIndustryTabs(owner);
  if (loading) return <Spinner />;
  if (tabs.length === 0) return <p className="py-16 text-center text-sm text-slate-500">There is nothing to show here for your business yet.</p>;
  return <Tabbed tabs={tabs} base={base} />;
}

/** Mounts the existing screen(s) for one v2 feature. */
export default function HubPage({ feature }: { feature: Feature }) {
  const pathname = usePathname();
  const screen = SCREENS[feature.id];
  const base = pathname || feature.route;
  if (!screen) return <p className="py-16 text-center text-sm text-slate-500">This screen is not available yet.</p>;
  return (
    <Suspense fallback={<Spinner />}>
      {screen.kind === 'page' && <screen.Component />}
      {screen.kind === 'website' && <WebsiteSectionContext.Provider value={screen.section}><MyWebsite /></WebsiteSectionContext.Provider>}
      {screen.kind === 'tabs' && <Tabbed base={base} tabs={screen.tabs.map((t) => ({ key: t.key, label: t.label, node: <t.Component /> }))} />}
      {screen.kind === 'industry' && <IndustryHub owner={screen.owner} base={base} />}
    </Suspense>
  );
}
