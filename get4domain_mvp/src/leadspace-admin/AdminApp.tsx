'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import CreditsTab from './CreditsTab';
import PricesTab from './PricesTab';
import PromotionTab from './PromotionTab';
import ReportsTab from './ReportsTab';
import VendorsTab from './VendorsTab';
import WhatsappTab from './WhatsappTab';

const TABS = [
  { key: 'vendors', label: 'Vendors', money: false },
  { key: 'promotion', label: 'Promotion', money: false },
  { key: 'prices', label: 'Prices and rules', money: true },
  { key: 'credits', label: 'Credits, refunds and packs', money: true },
  { key: 'reports', label: 'Cost per lead', money: true },
  { key: 'whatsapp', label: 'WhatsApp number', money: true },
] as const;
type Key = (typeof TABS)[number]['key'];

/**
 * The LeadSpace console. Any staff role may work the vendor queue and the promotion queue; prices, credits, refunds, packs, the cost report and the common
 * WhatsApp number are money screens, so MARKETING staff do not see them (the server refuses them too).
 */
export default function LeadSpaceAdmin() {
  const { user } = useAuth();
  const role = user?.adminRole ?? 'SUPER_ADMIN';
  const tabs = TABS.filter((t) => !t.money || role !== 'MARKETING');
  const [tab, setTab] = useState<Key>('vendors');
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('tab');
    if (q && tabs.some((t) => t.key === q)) setTab(q as Key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);
  const pick = (k: Key): void => { setTab(k); const u = new URL(window.location.href); u.searchParams.set('tab', k); window.history.replaceState(null, '', u.toString()); };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">LeadSpace</h1>
        <p className="mt-1 text-sm text-slate-400">Free pages, verified leads, the prepaid wallet and our own promotion. Campaigns and Managed Ads now live here.</p>
      </div>
      <div role="tablist" aria-label="LeadSpace sections" className="flex flex-wrap gap-1 rounded-xl bg-slate-900 p-1">
        {tabs.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => pick(t.key)} className={`rounded-lg px-3.5 py-1.5 text-sm font-medium ${tab === t.key ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white'}`}>{t.label}</button>
        ))}
      </div>
      <div key={tab}>
        {tab === 'vendors' && <VendorsTab />}
        {tab === 'promotion' && <PromotionTab />}
        {tab === 'prices' && <PricesTab />}
        {tab === 'credits' && <CreditsTab />}
        {tab === 'reports' && <ReportsTab />}
        {tab === 'whatsapp' && <WhatsappTab />}
      </div>
    </div>
  );
}
