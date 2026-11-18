import { getJson, unwrap } from './api';
import { apiBase, defaultRevalidate } from './config';
import { useMocks } from './flag';
import type { Fetched } from './types';

/**
 * The 16 packs of the product and what each gives a business (from the backend's pack summary sheet, PACK_SUMMARY_V1: key, name, vendor tabs), and the categories a business
 * registers under (GET /v3/public/pack-categories, which exists). The pack list is data in this file because no public route lists packs with their tabs (see PUBLIC_GAPS);
 * the categories come from the API. A tab named "offers" on the retail sheet is left out of the public copy: no offer wording on the public site.
 */
export interface Pack { key: string; name: string; gives: readonly string[] }

export const PACKS: readonly Pack[] = [
  { key: 'PROPERTY', name: 'Property and real estate', gives: ['Listings', 'Projects and units', 'Site visits', 'Owners and tenants', 'Rent roll'] },
  { key: 'CLINIC', name: 'Clinic and patient care', gives: ['Patients', 'Appointments', 'Visit notes', 'Prescriptions', 'Billing', 'Follow-ups'] },
  { key: 'LAB', name: 'Lab and diagnostics', gives: ['Test catalogue', 'Orders', 'Sample tracking', 'Reports'] },
  { key: 'PHARMACY', name: 'Pharmacy and medical store', gives: ['Stock with batches and expiry', 'Prescriptions', 'Billing', 'Refills'] },
  { key: 'RETAIL', name: 'Retail and ecommerce', gives: ['Products', 'Stock', 'Cart and orders', 'Returns'] },
  { key: 'FOOD_SERVICE', name: 'Food service', gives: ['Menu', 'Table or online orders', 'Kitchen status', 'Delivery'] },
  { key: 'FIELD_SERVICE', name: 'Field services and trades', gives: ['Jobs', 'Technician dispatch', 'Quotes', 'AMC contracts', 'Service history'] },
  { key: 'VEHICLE_SERVICE', name: 'Vehicle services', gives: ['Job cards', 'Vehicle records', 'Service history', 'Reminders', 'Parts'] },
  { key: 'LOGISTICS', name: 'Logistics and freight', gives: ['Shipments', 'Trips', 'Vehicles', 'Drivers', 'Tracking', 'Proof of delivery'] },
  { key: 'MEMBERSHIP_WELLNESS', name: 'Gym, salon and wellness', gives: ['Members', 'Plans and renewals', 'Attendance', 'Appointments', 'Product sales'] },
  { key: 'EDUCATION', name: 'Education and training', gives: ['Courses', 'Batches', 'Admissions', 'Fees', 'Attendance', 'Results'] },
  { key: 'PRACTICE_LEGAL_FINANCE', name: 'Legal and finance practice', gives: ['Clients', 'Matters or files', 'Documents', 'Deadlines', 'Fees'] },
  { key: 'AGENCY_CONSULTING', name: 'Consulting and creative', gives: ['Projects', 'Proposals', 'Retainers', 'Deliverables', 'Time'] },
  { key: 'HOSPITALITY_EVENTS', name: 'Hospitality, travel and events', gives: ['Packages', 'Availability calendar', 'Bookings', 'Advance payments'] },
  { key: 'RENTAL_FLEET', name: 'Rentals and fleet', gives: ['Assets or vehicles', 'Availability', 'Per-day pricing', 'Deposit', 'Handover and return'] },
  { key: 'B2B_DEALER', name: 'B2B supplier and dealer', gives: ['Catalogue', 'Quotations', 'Bulk price tiers', 'Vehicle or equipment listings', 'Test drives'] },
];

export interface Category { categoryKey: string; name: string; family: string; packKey: string; minTier: string }

// Sample categories for review (mock mode only), one or two per pack.
const SAMPLE: Array<[string, string, string]> = [
  ['PROPERTY', 'real-estate-agent', 'Real estate agent'], ['CLINIC', 'general-clinic', 'General clinic'], ['CLINIC', 'dental-clinic', 'Dental clinic'], ['LAB', 'diagnostic-lab', 'Diagnostic lab'],
  ['PHARMACY', 'pharmacy', 'Pharmacy'], ['RETAIL', 'general-store', 'General store'], ['FOOD_SERVICE', 'restaurant', 'Restaurant'], ['FIELD_SERVICE', 'plumber', 'Plumber'],
  ['FIELD_SERVICE', 'electrician', 'Electrician'], ['VEHICLE_SERVICE', 'car-workshop', 'Car workshop'], ['LOGISTICS', 'transport-company', 'Transport company'], ['MEMBERSHIP_WELLNESS', 'gym', 'Gym'],
  ['MEMBERSHIP_WELLNESS', 'salon', 'Salon'], ['EDUCATION', 'tuition-centre', 'Tuition centre'], ['PRACTICE_LEGAL_FINANCE', 'chartered-accountant', 'Chartered accountant'],
  ['AGENCY_CONSULTING', 'design-studio', 'Design studio'], ['HOSPITALITY_EVENTS', 'travel-agency', 'Travel agency'], ['RENTAL_FLEET', 'car-rental', 'Car rental'], ['B2B_DEALER', 'machinery-dealer', 'Machinery dealer'],
];
// the sample tier of each pack, so the picker by track and the plan switch can be reviewed (the real list carries its own minTier)
const SAMPLE_TIER: Readonly<Record<string, string>> = { PROPERTY: 'PROFESSIONAL', CLINIC: 'PROFESSIONAL', LAB: 'PROFESSIONAL', PRACTICE_LEGAL_FINANCE: 'PROFESSIONAL', AGENCY_CONSULTING: 'PROFESSIONAL', PHARMACY: 'ECOMMERCE', RETAIL: 'ECOMMERCE', FOOD_SERVICE: 'ECOMMERCE', B2B_DEALER: 'ECOMMERCE' };
export const MOCK_CATEGORIES: readonly Category[] = SAMPLE.map(([packKey, categoryKey, name]) => ({ categoryKey, name, family: packKey.toLowerCase(), packKey, minTier: SAMPLE_TIER[packKey] ?? 'HANDYMAN' }));

/** The categories a business can register under. */
export async function fetchCategories(): Promise<Fetched<Category[]>> {
  if (useMocks()) return { kind: 'ok', data: [...MOCK_CATEGORIES] };
  const base = apiBase();
  if (!base) return { kind: 'error', status: null };
  const r = await getJson<unknown>(`${base}/v3/public/pack-categories`, defaultRevalidate());
  if (r.kind !== 'ok') return r;
  const raw = unwrap<unknown>(r.data);
  if (!Array.isArray(raw)) return { kind: 'error', status: null };
  const data = raw
    .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object' && typeof (c as Record<string, unknown>).categoryKey === 'string' && typeof (c as Record<string, unknown>).name === 'string')
    .map((c): Category => ({ categoryKey: String(c.categoryKey), name: String(c.name), family: String(c.family ?? ''), packKey: String(c.packKey ?? ''), minTier: String(c.minTier ?? '') }));
  return { kind: 'ok', data };
}

/** Categories grouped by pack key (for the industries page). */
export function categoriesByPack(list: readonly Category[]): Map<string, Category[]> {
  const m = new Map<string, Category[]>();
  for (const c of list) { const a = m.get(c.packKey) ?? []; a.push(c); m.set(c.packKey, a); }
  return m;
}
