'use client';

import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useDashboardConfig, TAB_ADDON_REQUIREMENT } from '@/lib/dashboard-config';
import { resolveView } from '@/domainapp/tab-registry';
import RecordsView from '@/domainapp/shared/RecordsView';
import ContactsView from '@/domainapp/shared/ContactsView';
import CatalogView from '@/domainapp/shared/CatalogView';
import InvoicingView from '@/domainapp/shared/InvoicingView';
import ComingSoon from '@/domainapp/shared/ComingSoon';
import FleetView from '@/domainapp/travel/FleetView';
import DriversView from '@/domainapp/travel/DriversView';
import TripsView from '@/domainapp/travel/TripsView';
import VisaView from '@/domainapp/travel/VisaView';
import ContractsView from '@/domainapp/travel/ContractsView';
import StylistsView from '@/domainapp/salon/StylistsView';
import SalonScheduleView from '@/domainapp/salon/SalonScheduleView';
import GymClassesView from '@/domainapp/gym/GymClassesView';
import MembershipsView from '@/domainapp/gym/MembershipsView';
import RoomsView from '@/domainapp/hotel/RoomsView';
import HousekeepingView from '@/domainapp/hotel/HousekeepingView';
import ReservationsView from '@/domainapp/hotel/ReservationsView';
import ListingsView from '@/domainapp/realestate/ListingsView';
import DealsView from '@/domainapp/realestate/DealsView';
import VisitsView from '@/domainapp/realestate/VisitsView';
import BatchesView from '@/domainapp/education/BatchesView';
import EnrollmentsView from '@/domainapp/education/EnrollmentsView';
import Card from '@/components/ui/Card';
import { Lock } from 'lucide-react';

export default function DomainAppTabPage() {
  const params = useParams();
  const tabKey = String(params.tab);
  const { user } = useAuth();
  const cfg = useDashboardConfig(user?.industry);

  if (cfg.loading && !cfg.industry) {
    return <div className="py-16 text-center text-sm text-slate-400">Loading workspace…</div>;
  }
  if (!cfg.industry) {
    return <div className="py-16 text-center text-sm text-slate-400">Unable to load your industry workspace.</div>;
  }

  // Direct-URL guard: DomainApp core must be enabled for this vendor.
  if (cfg.modules.domainapp === false) {
    return (
      <Card className="mx-auto mt-10 max-w-lg text-center" padded>
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50">
          <Lock className="h-6 w-6 text-primary-600" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">DomainApp is not active</h2>
        <p className="mt-2 text-sm text-slate-500">
          Your plan doesn&apos;t include the DomainApp workspace yet. Book a demo to enable it.
        </p>
        <a href="/#contact" className="mt-5 inline-block rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700">
          Book a Demo
        </a>
      </Card>
    );
  }

  const tab = cfg.industry.dashboardTabs.find((t) => t.key === tabKey);
  const icon = tab?.icon ?? cfg.industry.icon;

  // Phase 1 — Travel Operations: dedicated screens replace the generic shell.
  // Fleet + Drivers keep the existing addon gating (fleet/driver flags); Trips +
  // Visa are core. Bookings/Invoicing still use the shared views below.
  if (cfg.industry.key === 'travel') {
    if (tabKey === 'fleet' || tabKey === 'drivers' || tabKey === 'contracts') {
      const addonKey = TAB_ADDON_REQUIREMENT[tabKey]; // fleet/contracts -> 'fleet', drivers -> 'driver'
      // Locked only if the addon was explicitly disabled for this vendor (matches
      // the nav's isLocked). Direct-URL guard — the nav already hides the tab.
      if (addonKey && cfg.addons[addonKey] === false) {
        return (
          <Card className="mx-auto mt-10 max-w-lg text-center" padded>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50">
              <Lock className="h-6 w-6 text-primary-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">{tab?.label ?? tabKey} is not enabled</h2>
            <p className="mt-2 text-sm text-slate-500">
              This is an optional add-on for your workspace. Contact support to enable it.
            </p>
          </Card>
        );
      }
      return tabKey === 'fleet' ? <FleetView /> : tabKey === 'drivers' ? <DriversView /> : <ContractsView />;
    }
    if (tabKey === 'trip-sheets') return <TripsView />;
    if (tabKey === 'visa') return <VisaView />;
  }

  // Phase 2 — Salon: real scheduling + stylist/chair management (dedicated models).
  if (cfg.industry.key === 'salon') {
    if (tabKey === 'appointments') return <SalonScheduleView />;
    if (tabKey === 'stylists') return <StylistsView />;
  }

  // Phase 2 — Gym: class scheduling + membership status tracking.
  if (cfg.industry.key === 'gym') {
    if (tabKey === 'classes') return <GymClassesView />;
    if (tabKey === 'members') return <MembershipsView />;
  }

  // Phase 2 — Hotel: room inventory, reservations, housekeeping board.
  if (cfg.industry.key === 'hotel') {
    if (tabKey === 'rooms') return <RoomsView />;
    if (tabKey === 'reservations') return <ReservationsView />;
    if (tabKey === 'housekeeping') return <HousekeepingView />;
  }

  // Phase 2 — Real Estate: listings, deal pipeline, site-visit scheduling.
  if (cfg.industry.key === 'realestate') {
    if (tabKey === 'properties') return <ListingsView />;
    if (tabKey === 'enquiries') return <DealsView />;
    if (tabKey === 'visits') return <VisitsView />;
  }

  // Phase 2 — Education: batch scheduling + enrollment/fee roster.
  if (cfg.industry.key === 'education') {
    if (tabKey === 'batches') return <BatchesView />;
    if (tabKey === 'students') return <EnrollmentsView />;
  }

  const view = resolveView(tabKey);

  switch (view) {
    case 'contacts':
      return <ContactsView industry={cfg.industry} icon={icon} />;
    case 'catalog':
      return <CatalogView industry={cfg.industry} icon={icon} />;
    case 'billing':
      return <InvoicingView industry={cfg.industry} actionLabel={tabKey === 'fees' ? 'Fee Receipt' : 'Invoice'} />;
    case 'addon':
      return <ComingSoon label={tab?.label ?? tabKey} icon={icon} />;
    default:
      return <RecordsView industry={cfg.industry} icon={icon} />;
  }
}
