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
import EngagementsView from '@/domainapp/professional/EngagementsView';
import DocumentsView from '@/domainapp/professional/DocumentsView';
import ProjectsView from '@/domainapp/construction/ProjectsView';
import MaterialsView from '@/domainapp/construction/MaterialsView';
import BookingsView from '@/domainapp/events/BookingsView';
import EventVendorsView from '@/domainapp/events/VendorsView';
import CasesView from '@/domainapp/finance/CasesView';
import FinanceDocumentsView from '@/domainapp/finance/DocumentsView';
import JobsView from '@/domainapp/automobile/JobsView';
import PartsInventoryView from '@/domainapp/automobile/PartsInventoryView';
import ShipmentsView from '@/domainapp/logistics/ShipmentsView';
import TestOrdersView from '@/domainapp/diagnostics/TestOrdersView';
import ReportsView from '@/domainapp/diagnostics/ReportsView';
import ShootsView from '@/domainapp/photography/ShootsView';
import DeliveryView from '@/domainapp/photography/DeliveryView';
import ProduceOrdersView from '@/domainapp/agriculture/OrdersView';
import ProduceInventoryView from '@/domainapp/agriculture/ProduceInventoryView';
import CoachingBatchesView from '@/domainapp/coaching/BatchesView';
import CoachingStudentsView from '@/domainapp/coaching/StudentsView';
import TechProjectsView from '@/domainapp/technology/ProjectsView';
import TechTasksView from '@/domainapp/technology/TasksView';
import ClinicAppointmentsView from '@/domainapp/clinic/AppointmentsView';
import DoctorsView from '@/domainapp/clinic/DoctorsView';
import PrescriptionsView from '@/domainapp/clinic/PrescriptionsView';
import RestaurantOrdersView from '@/domainapp/restaurant/OrdersView';
import TablesView from '@/domainapp/restaurant/TablesView';
import KitchenView from '@/domainapp/restaurant/KitchenView';
import PosView from '@/domainapp/retail/PosView';
import RetailProductsView from '@/domainapp/retail/ProductsView';
import RetailInventoryView from '@/domainapp/retail/InventoryView';
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

  // Direct-URL addon guard — industry-agnostic, so it must sit ABOVE the
  // per-industry dispatch below. It previously lived inside the travel branch,
  // which meant every industry added afterwards (hotel rooms/housekeeping,
  // restaurant tables, photography gallery, the inventory/documents/vendors
  // tabs) was reachable by URL even while the sidebar showed it locked. Locked
  // only when the addon is EXPLICITLY disabled for this vendor — undefined means
  // "not restricted", matching the nav's isLocked().
  const requiredAddon = TAB_ADDON_REQUIREMENT[tabKey];
  if (requiredAddon && cfg.addons[requiredAddon] === false) {
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

  // Phase 1 — Travel Operations: dedicated screens replace the generic shell.
  // Fleet/Drivers/Contracts addon gating is handled by the shared guard above.
  // Bookings/Invoicing still use the shared views below.
  if (cfg.industry.key === 'travel') {
    if (tabKey === 'fleet') return <FleetView />;
    if (tabKey === 'drivers') return <DriversView />;
    if (tabKey === 'contracts') return <ContractsView />;
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

  // Phase 2 — Professional Services: engagement tracking + document checklist.
  if (cfg.industry.key === 'professional') {
    if (tabKey === 'engagements') return <EngagementsView />;
    if (tabKey === 'documents') return <DocumentsView />;
  }

  // Phase 3 — Construction: project + milestone tracking, materials.
  if (cfg.industry.key === 'construction') {
    if (tabKey === 'projects') return <ProjectsView />;
    if (tabKey === 'materials') return <MaterialsView />;
  }

  // Phase 3 — Events: bookings + vendor coordination.
  if (cfg.industry.key === 'events') {
    if (tabKey === 'bookings') return <BookingsView />;
    if (tabKey === 'vendors') return <EventVendorsView />;
  }

  // Phase 3 — Finance: case tracking + document checklist per case type.
  if (cfg.industry.key === 'finance') {
    if (tabKey === 'cases') return <CasesView />;
    if (tabKey === 'documents') return <FinanceDocumentsView />;
  }

  // Phase 3 — Automobile: service-job tracking + parts inventory.
  if (cfg.industry.key === 'automobile') {
    if (tabKey === 'jobs') return <JobsView />;
    if (tabKey === 'inventory') return <PartsInventoryView />;
  }

  // Phase 3 — Logistics: shipment tracking; fleet/drivers reuse Travel's ops views.
  if (cfg.industry.key === 'logistics') {
    if (tabKey === 'shipments') return <ShipmentsView />;
    if (tabKey === 'fleet') return <FleetView />;
    if (tabKey === 'drivers') return <DriversView />;
  }

  // Phase 3 — Diagnostics: test-order tracking + report delivery board.
  if (cfg.industry.key === 'diagnostics') {
    if (tabKey === 'bookings') return <TestOrdersView />;
    if (tabKey === 'reports') return <ReportsView />;
  }

  // Phase 3 — Photography: shoot scheduling + delivery tracking.
  if (cfg.industry.key === 'photography') {
    if (tabKey === 'bookings') return <ShootsView />;
    if (tabKey === 'gallery') return <DeliveryView />;
  }

  // Phase 3 — Agriculture: produce order + inventory tracking.
  if (cfg.industry.key === 'agriculture') {
    if (tabKey === 'orders') return <ProduceOrdersView />;
    if (tabKey === 'inventory') return <ProduceInventoryView />;
  }

  // Phase 3 — Coaching: batch/session scheduling + student tracking.
  if (cfg.industry.key === 'coaching') {
    if (tabKey === 'batches') return <CoachingBatchesView />;
    if (tabKey === 'students') return <CoachingStudentsView />;
  }

  // Phase 3 — Technology: project + sprint/task tracking.
  if (cfg.industry.key === 'technology') {
    if (tabKey === 'projects') return <TechProjectsView />;
    if (tabKey === 'tasks') return <TechTasksView />;
  }

  // Final 3 — Clinic: appointment scheduling + doctor assignment + visit tracking.
  if (cfg.industry.key === 'clinic') {
    if (tabKey === 'appointments') return <ClinicAppointmentsView />;
    if (tabKey === 'doctors') return <DoctorsView />;
    if (tabKey === 'prescriptions') return <PrescriptionsView />;
  }

  // Final 3 — Restaurant: menu-linked orders, table floor, kitchen display.
  if (cfg.industry.key === 'restaurant') {
    if (tabKey === 'orders') return <RestaurantOrdersView />;
    if (tabKey === 'tables') return <TablesView />;
    if (tabKey === 'kitchen') return <KitchenView />;
  }

  // Final 3 — Retail: point-of-sale, product catalog, stock inventory.
  if (cfg.industry.key === 'retail') {
    if (tabKey === 'orders') return <PosView />;
    if (tabKey === 'products') return <RetailProductsView />;
    if (tabKey === 'inventory') return <RetailInventoryView />;
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
