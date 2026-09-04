import { createElement, type ReactNode } from 'react';
import type { EngineMode, EngineSiteData, IndustryWebsite } from './types';
import type { KitSiteModel } from './kit/model';
import { realEstateWebsite } from './industries/real-estate/config';
import RealEstateSite from './industries/real-estate/RealEstateSite';
import KitRenderer from './kit/KitRenderer';
import { kitConfig } from './kit/config';
import { buildClinic, buildSalon, buildGym, buildCoaching, buildEducation, buildProfessional, buildFinance, buildDiagnostics, buildPhotography } from './industries/kit/appointments';
import { buildHotel, buildEvents, buildTravel } from './industries/kit/hospitality';
import { buildRestaurant, buildRetail, buildAgriculture, buildAutomobile } from './industries/kit/commerce';
import { buildConstruction, buildTechnology, buildLogistics } from './industries/kit/projects';

/**
 * The Industry Website Engine registry — the single extension point across BOTH the
 * live vendor route and the demo-visit route. Each entry pairs an IndustryWebsite
 * config (metadata + readiness) with a `render` that returns the bespoke site for a
 * given site-data + mode (live | demo | preview).
 *
 * Real Estate is the fully hand-built reference; every other main industry is composed
 * from the shared kit with its OWN theme + hero/showcase variants + section order +
 * content, so each reads as bespoke, not a recoloured template. Sub-categories flow
 * through their parent industry's builder via the demo content injected as CMS.
 */
export interface EngineIndustryEntry {
  config: IndustryWebsite;
  render: (site: EngineSiteData, mode: EngineMode) => ReactNode;
}

type Builder = (site: EngineSiteData) => KitSiteModel;
const kit = (config: IndustryWebsite, build: Builder): EngineIndustryEntry => ({
  config,
  render: (site, mode) => createElement(KitRenderer, { model: build(site), mode }),
});

const REGISTRY: Record<string, EngineIndustryEntry> = {
  // Reference industry — fully bespoke, hand-built.
  realestate: { config: realEstateWebsite, render: (site, mode) => createElement(RealEstateSite, { site, mode }) },

  // Appointment / practitioner
  clinic: kit(kitConfig('clinic', 'Clinic & Healthcare', { intent: 'engine.enquiry', label: 'Book appointment', kind: 'booking' }), buildClinic),
  salon: kit(kitConfig('salon', 'Salon & Beauty', { intent: 'engine.enquiry', label: 'Book appointment', kind: 'booking' }), buildSalon),
  gym: kit(kitConfig('gym', 'Gym & Fitness', { intent: 'engine.enquiry', label: 'Start free trial', kind: 'booking' }), buildGym),
  coaching: kit(kitConfig('coaching', 'Coaching & Training', { intent: 'engine.enquiry', label: 'Book a call', kind: 'booking' }), buildCoaching),
  education: kit(kitConfig('education', 'Education & Schools', { intent: 'engine.enquiry', label: 'Admission enquiry', kind: 'enquiry' }), buildEducation),
  professional: kit(kitConfig('professional', 'Professional Services', { intent: 'engine.enquiry', label: 'Book a consultation', kind: 'booking' }), buildProfessional),
  finance: kit(kitConfig('finance', 'Finance & Advisory', { intent: 'engine.enquiry', label: 'Book a review', kind: 'booking' }), buildFinance),
  diagnostics: kit(kitConfig('diagnostics', 'Diagnostics & Labs', { intent: 'engine.enquiry', label: 'Book a test', kind: 'booking' }), buildDiagnostics),
  photography: kit(kitConfig('photography', 'Photography & Studio', { intent: 'engine.enquiry', label: 'Check availability', kind: 'booking' }), buildPhotography),

  // Hospitality / booking
  hotel: kit(kitConfig('hotel', 'Hotel & Hospitality', { intent: 'engine.enquiry', label: 'Check availability', kind: 'booking' }), buildHotel),
  events: kit(kitConfig('events', 'Events & Venues', { intent: 'engine.enquiry', label: 'Check your date', kind: 'booking' }), buildEvents),
  travel: kit(kitConfig('travel', 'Travel & Tours', { intent: 'engine.enquiry', label: 'Plan my trip', kind: 'enquiry' }), buildTravel),

  // Commerce / catalogue
  restaurant: kit(kitConfig('restaurant', 'Restaurant & Cafe', { intent: 'engine.enquiry', label: 'Reserve a table', kind: 'booking' }), buildRestaurant),
  retail: kit(kitConfig('retail', 'Retail & Shopping', { intent: 'engine.enquiry', label: 'Enquire / Order', kind: 'enquiry' }), buildRetail),
  agriculture: kit(kitConfig('agriculture', 'Agriculture', { intent: 'engine.enquiry', label: 'Enquire / Order', kind: 'enquiry' }), buildAgriculture),
  automobile: kit(kitConfig('automobile', 'Automobile Services', { intent: 'engine.enquiry', label: 'Book a service', kind: 'booking' }), buildAutomobile),

  // Project / portfolio / B2B
  construction: kit(kitConfig('construction', 'Construction', { intent: 'engine.enquiry', label: 'Request a quote', kind: 'enquiry' }), buildConstruction),
  technology: kit(kitConfig('technology', 'Technology & IT', { intent: 'engine.enquiry', label: 'Book a discovery call', kind: 'booking' }), buildTechnology),
  logistics: kit(kitConfig('logistics', 'Logistics & Transport', { intent: 'engine.enquiry', label: 'Get a quote', kind: 'enquiry' }), buildLogistics),
};

export function getEngineIndustry(key: string): EngineIndustryEntry | null {
  return REGISTRY[key] ?? null;
}
export function hasEngineSite(key: string): boolean {
  return key in REGISTRY;
}
export function listEngineIndustries(): string[] {
  return Object.keys(REGISTRY);
}
