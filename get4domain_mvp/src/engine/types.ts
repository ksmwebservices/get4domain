/**
 * Get4Domain Industry Website Engine — core contracts.
 *
 * The engine provides reusable CAPABILITIES, never a reusable visual template.
 * An industry contributes its OWN bespoke section components + a theme token set +
 * a config; the engine only supplies the plumbing (theme scope, action dispatch,
 * site-data adapters, publishing/revenue readiness). Two industries built on this
 * engine must be able to look like two different agencies designed them.
 */

/** Design tokens applied as CSS custom properties by ThemeScope. Industry-specific. */
export interface ThemeTokens {
  /** Page background + primary foreground. */
  bg: string;
  fg: string;
  /** A softer surface (cards/sections) and its border. */
  surface: string;
  border: string;
  /** Muted text. */
  muted: string;
  /** Primary + secondary accents (industry brand). */
  accent: string;
  accentFg: string;
  accent2: string;
  /** Display (headings) and body font stacks. */
  fontDisplay: string;
  fontBody: string;
  /** Base corner radius, e.g. '2px' (sharp/architectural) … '16px' (soft). */
  radius: string;
  /** light | dark — informs default section treatments and image overlays. */
  mode: 'light' | 'dark';
}

/** Raw site data as resolved from the backend (mirrors GET /cms/site/:subdomain). */
export interface EngineSiteData {
  vendor: { id: string; businessName: string; industry: string; subdomain: string | null };
  cms: {
    businessName: string | null; tagline: string | null; about: string | null;
    logo: string | null; banner: string | null; phone: string | null; whatsapp: string | null;
    email: string | null; address: string | null; seoTitle: string | null; seoDesc: string | null;
    seoKeywords: string | null; businessHours?: string | null;
  } | null;
  products: {
    id: string; name: string; description: string | null; price: string | null;
    image: string | null; category: string | null; customFields: Record<string, string> | null;
  }[];
}

/** A revenue/launch readiness check evaluated against resolved site data. */
export interface ReadinessCheck {
  key: string;
  label: string;
  /** 'required' blocks a confident launch; 'recommended' is a soft nudge. */
  weight: 'required' | 'recommended';
  passed: boolean;
  hint?: string;
}

/** A public action this industry's website can fire, mapped to an Action Registry intent. */
export interface EngineActionSpec {
  intent: string; // e.g. 'realestate.site_visit'
  label: string;
  kind: 'enquiry' | 'booking' | 'payment' | 'whatsapp';
}

/**
 * An industry's website module. Only the reference industry (Real Estate) is fully
 * populated in this pass; others fall back to the generic renderer via the registry.
 */
export interface IndustryWebsite {
  key: string;
  label: string;
  theme: ThemeTokens;
  /** Primary + secondary conversion actions surfaced across the site. */
  primaryCta: EngineActionSpec;
  secondaryCtas: EngineActionSpec[];
  /** Ordered section ids this industry composes (documentation + config, the
   *  component wiring lives in the industry's own Site component). */
  sectionOrder: string[];
  /** Compute the revenue-readiness checklist from resolved site data. */
  readiness: (site: EngineSiteData) => ReadinessCheck[];
}
