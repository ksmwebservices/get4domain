'use client';

import { ClipboardList, Home, Info, LayoutGrid, Scissors, ShoppingBag, UtensilsCrossed } from 'lucide-react';
import type { GoalId, Theme, TradeId } from './model';
import { hexToRgba } from './ui';

export type TabId = 'home' | 'services' | 'about' | 'enquire';
type IconType = React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
export interface TabConfig { id: TabId; label: string; icon: IconType }

const servicesLabel = (t: TradeId): string => (t === 'shop-retail' ? 'Products' : t === 'restaurant-food' ? 'Menu' : t === 'real-estate' ? 'Listings' : 'Services');
const servicesIcon = (t: TradeId): IconType => (t === 'shop-retail' ? ShoppingBag : t === 'restaurant-food' ? UtensilsCrossed : t === 'salon-beauty' ? Scissors : LayoutGrid);
const enquireLabel = (g: GoalId): string => (g === 'BOOKING' ? 'Book' : g === 'APPOINTMENT' ? 'Appointment' : g === 'SITE_VISIT' ? 'Site visit' : g === 'CART_ORDER' ? 'Order' : 'Enquire');

/** Home, Services (word set by the trade), About, and the one action (word set by the goal). */
export function getTabs(tradeId: TradeId, goal: GoalId): TabConfig[] {
  return [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'services', label: servicesLabel(tradeId), icon: servicesIcon(tradeId) },
    { id: 'about', label: 'About', icon: Info },
    { id: 'enquire', label: enquireLabel(goal), icon: ClipboardList },
  ];
}

interface NavProps { tabs: TabConfig[]; activeTab: TabId; onTabChange: (t: TabId) => void; theme: Theme; cartCount?: number }

export function MobileNavBar({ tabs, activeTab, onTabChange, theme, cartCount }: NavProps): React.ReactElement {
  return (
    <nav aria-label="Page sections" className="fixed bottom-0 left-0 right-0 z-40 lg:hidden" style={{ backgroundColor: '#fff', borderTop: `1px solid ${hexToRgba(theme.ink, 0.06)}`, paddingBottom: 'env(safe-area-inset-bottom, 0px)', boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.06)' }}>
      <div className="flex items-stretch justify-around px-2 py-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          const badge = tab.id === 'enquire' && !!cartCount && cartCount > 0;
          return (
            <button key={tab.id} type="button" onClick={() => onTabChange(tab.id)} className="relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5" style={{ minHeight: '52px' }} aria-label={tab.label} aria-current={active ? 'page' : undefined}>
              <div className="relative">
                <Icon size={22} style={{ color: active ? theme.accent : '#6b7280', transform: active ? 'scale(1.1)' : 'scale(1)', transition: 'all 0.2s' }} />
                {badge ? <span className="absolute -right-2 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white" style={{ backgroundColor: theme.accent }}>{cartCount}</span> : null}
              </div>
              <span className="text-[10px] font-medium" style={{ color: active ? theme.accent : '#6b7280' }}>{tab.label}</span>
              {active ? <div className="absolute -top-px h-0.5 w-8 rounded-full" style={{ backgroundColor: theme.accent }} /> : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function DesktopTopBar({ tabs, activeTab, onTabChange, theme, businessName, cartCount }: NavProps & { businessName: string }): React.ReactElement {
  return (
    <header className="sticky top-0 z-40 hidden items-center justify-between bg-white px-8 py-3 lg:flex" style={{ borderBottom: `1px solid ${hexToRgba(theme.ink, 0.06)}` }}>
      <span className="text-base font-bold" style={{ color: theme.ink }}>{businessName}</span>
      <nav aria-label="Page sections" className="flex items-center gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          const badge = tab.id === 'enquire' && !!cartCount && cartCount > 0;
          return (
            <button key={tab.id} type="button" onClick={() => onTabChange(tab.id)} aria-current={active ? 'page' : undefined} className="relative flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200" style={{ color: active ? theme.accent : '#4b5563', backgroundColor: active ? hexToRgba(theme.accent, 0.08) : 'transparent' }}>
              <Icon size={16} />
              {tab.label}
              {badge ? <span className="ml-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white" style={{ backgroundColor: theme.accent }}>{cartCount}</span> : null}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
