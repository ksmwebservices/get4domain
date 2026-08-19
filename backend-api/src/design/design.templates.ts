/**
 * Built-in sample design templates — Fabric.js scenes (MIT, no subscription).
 *
 * Storage shape is unchanged from before: each template is metadata + a scene JSON
 * in `editorJson` + `fields[]` prefill definitions. Only the scene format switched
 * from Polotno's to Fabric's (fabric v6 `canvas.toJSON()` shape: an `objects` array
 * of typed shapes). The editor loads these via `canvas.loadFromJSON`.
 *
 * Placeholders are tagged with a custom `fieldKey` (+ `fieldLabel`) on the object —
 * that's how vendor-fill mode knows which objects to prefill from profile data, and
 * how admin-authored templates record their data fields. Original layouts, not
 * recreations of any premium asset.
 */

export interface DesignFieldDef {
  key: string;
  label: string;
  type?: 'text' | 'textarea';
  prefillFrom?: 'businessName' | 'name' | 'email';
}

export interface DesignTemplateDef {
  id: string;
  name: string;
  category: string;
  width: number;
  height: number;
  fields: DesignFieldDef[];
  /** Fabric.js scene JSON (loadFromJSON shape). */
  editorJson: Record<string, unknown>;
}

// Small helpers to keep the scenes readable.
const rect = (o: Record<string, unknown>) => ({ type: 'Rect', ...o });
const text = (t: string, o: Record<string, unknown>) => ({ type: 'Textbox', text: t, fontFamily: 'Arial', ...o });

// 1080×1080 festival/offer poster.
const OFFER_POSTER: DesignTemplateDef = {
  id: 'builtin-poster-offer',
  name: 'Festival Offer Poster',
  category: 'poster',
  width: 1080,
  height: 1080,
  fields: [
    { key: 'business_name', label: 'Business name', prefillFrom: 'businessName' },
    { key: 'offer_text', label: 'Offer headline' },
    { key: 'phone', label: 'Phone' },
  ],
  editorJson: {
    version: '6.9.1',
    background: '#ffffff',
    objects: [
      rect({ left: 0, top: 0, width: 1080, height: 1080, fill: '#0f766e' }),
      rect({ left: 0, top: 430, width: 1080, height: 240, fill: '#d97706' }),
      text('Your Business', { left: 90, top: 150, width: 900, fontSize: 72, fontWeight: 'bold', fill: '#ffffff', textAlign: 'center', fieldKey: 'business_name', fieldLabel: 'Business name' }),
      text('Special Festival Offer', { left: 90, top: 460, width: 900, fontSize: 96, fontWeight: 'bold', fill: '#ffffff', textAlign: 'center', fieldKey: 'offer_text', fieldLabel: 'Offer headline' }),
      text('Call: +91 ', { left: 90, top: 900, width: 900, fontSize: 48, fill: '#ffffff', textAlign: 'center', fieldKey: 'phone', fieldLabel: 'Phone' }),
    ],
  },
};

// 1050×600 visiting card (≈3.5in × 2in at 300 dpi).
const VISITING_CARD: DesignTemplateDef = {
  id: 'builtin-card-visiting',
  name: 'Visiting Card',
  category: 'business_card',
  width: 1050,
  height: 600,
  fields: [
    { key: 'business_name', label: 'Business name', prefillFrom: 'businessName' },
    { key: 'person_name', label: 'Person name', prefillFrom: 'name' },
    { key: 'designation', label: 'Designation' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email', prefillFrom: 'email' },
  ],
  editorJson: {
    version: '6.9.1',
    background: '#ffffff',
    objects: [
      rect({ left: 0, top: 0, width: 24, height: 600, fill: '#0f766e' }),
      text('Your Business', { left: 70, top: 70, width: 900, fontSize: 56, fontWeight: 'bold', fill: '#0f766e', fieldKey: 'business_name', fieldLabel: 'Business name' }),
      text('Your Name', { left: 70, top: 300, width: 900, fontSize: 44, fontWeight: 'bold', fill: '#0f172a', fieldKey: 'person_name', fieldLabel: 'Person name' }),
      text('Proprietor', { left: 70, top: 360, width: 900, fontSize: 30, fill: '#d97706', fieldKey: 'designation', fieldLabel: 'Designation' }),
      text('+91 ', { left: 70, top: 470, width: 900, fontSize: 28, fill: '#334155', fieldKey: 'phone', fieldLabel: 'Phone' }),
      text('you@example.com', { left: 70, top: 515, width: 900, fontSize: 28, fill: '#334155', fieldKey: 'email', fieldLabel: 'Email' }),
    ],
  },
};

export const SAMPLE_DESIGN_TEMPLATES: DesignTemplateDef[] = [OFFER_POSTER, VISITING_CARD];
