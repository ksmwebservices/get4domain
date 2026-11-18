import { Briefcase, Building2, Car, ChevronDown, Dumbbell, Factory, FlaskConical, GraduationCap, KeyRound, Pill, Plane, Scale, ShoppingBag, Stethoscope, Truck, UtensilsCrossed, Wrench, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { NavPack } from '@/components/portal/nav-data';
import { CARD, FOCUS } from '@/components/portal/ui';
import { PORTAL } from '@/lib/v3-public/portal-strings';

const ICONS: Readonly<Record<string, LucideIcon>> = {
  PROPERTY: Building2, CLINIC: Stethoscope, LAB: FlaskConical, PHARMACY: Pill, RETAIL: ShoppingBag, FOOD_SERVICE: UtensilsCrossed, FIELD_SERVICE: Wrench, VEHICLE_SERVICE: Car,
  LOGISTICS: Truck, MEMBERSHIP_WELLNESS: Dumbbell, EDUCATION: GraduationCap, PRACTICE_LEGAL_FINANCE: Scale, AGENCY_CONSULTING: Briefcase, HOSPITALITY_EVENTS: Plane, RENTAL_FLEET: KeyRound, B2B_DEALER: Factory,
};

/** The order the areas are shown in: everyday local services first. An editorial order, not a measured one (no popularity data exists yet). */
const FIRST: readonly string[] = ['FIELD_SERVICE', 'RETAIL', 'FOOD_SERVICE', 'MEMBERSHIP_WELLNESS', 'VEHICLE_SERVICE', 'EDUCATION', 'PROPERTY', 'HOSPITALITY_EVENTS'];
export const orderPacks = (packs: readonly NavPack[]): NavPack[] => [...packs].sort((a, b) => {
  const ia = FIRST.indexOf(a.key); const ib = FIRST.indexOf(b.key);
  return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
});

/**
 * The visual category grid: one card per business area, each an expandable group (a native details element, so it works without scripts and from the keyboard)
 * that opens to every category of the area, each a link to its page. `prefix` is '' on the main host and the main origin on the directory host.
 */
export default function CategoryGrid({ packs, prefix, preview = 3 }: { packs: readonly NavPack[]; prefix: string; preview?: number }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {orderPacks(packs).map((p) => {
        const Icon = ICONS[p.key] ?? Briefcase;
        return (
          <li key={p.key} className="min-w-0">
            <details className={`${CARD} group open:shadow-card-hover`}>
              <summary className={`flex cursor-pointer list-none items-start gap-3 rounded-2xl p-4 ${FOCUS}`}>
                <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Icon className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-ink-900">{p.name}</span>
                  <span className="mt-0.5 block truncate text-xs text-slate-600">{p.categories.slice(0, preview).map((c) => c.name).join(', ')}</span>
                </span>
                <ChevronDown aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-slate-500 motion-safe:transition-transform group-open:rotate-180" />
                <span className="sr-only">{PORTAL.home.expand}</span>
              </summary>
              <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                <ul className="flex flex-wrap gap-1.5">
                  {p.categories.map((c) => (
                    <li key={c.id}><Link href={`${prefix}${c.path}`} className={`inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-800 hover:bg-brand-50 hover:text-brand-800 ${FOCUS}`}>{c.name}</Link></li>
                  ))}
                </ul>
                <Link href={`${prefix}${p.path}`} className={`mt-3 inline-block text-sm font-semibold text-brand-700 hover:underline ${FOCUS}`}>{p.name}</Link>
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
