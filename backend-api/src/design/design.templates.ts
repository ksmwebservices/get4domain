/**
 * Built-in sample Polotno templates — enough to prove the in-app editor works end
 * to end. The full library is an ongoing design task (each template is authored
 * once directly in Polotno's own JSON format, never imported/flattened).
 *
 * Element `name`s tag the placeholders that get pre-filled from the vendor's
 * profile (see `fields[].prefillFrom`): the editor matches an element's name to a
 * field key and sets its text/image before the vendor starts editing.
 *
 * Licensing: Polotno production use requires a valid Polotno subscription (key set
 * in Admin → Integrations → Design Editor). These sample scenes are original
 * layouts (plain shapes + text), not recreations of any premium/purchased asset.
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
  /** Polotno scene JSON (store.toJSON() shape). */
  editorJson: Record<string, unknown>;
}

// A 1080×1080 festival/offer poster.
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
    width: 1080,
    height: 1080,
    fonts: [],
    pages: [
      {
        id: 'page1',
        children: [
          { id: 'bg', type: 'figure', subType: 'rect', x: 0, y: 0, width: 1080, height: 1080, fill: '#0f766e' },
          { id: 'band', type: 'figure', subType: 'rect', x: 0, y: 430, width: 1080, height: 240, fill: '#d97706' },
          { id: 'business_name', name: 'business_name', type: 'text', x: 90, y: 150, width: 900, text: 'Your Business', fontSize: 72, fontFamily: 'Roboto', fontWeight: 'bold', align: 'center', fill: '#ffffff' },
          { id: 'offer_text', name: 'offer_text', type: 'text', x: 90, y: 470, width: 900, text: 'Special Festival Offer', fontSize: 96, fontFamily: 'Roboto', fontWeight: 'bold', align: 'center', fill: '#ffffff' },
          { id: 'phone', name: 'phone', type: 'text', x: 90, y: 900, width: 900, text: 'Call: +91 ', fontSize: 48, fontFamily: 'Roboto', align: 'center', fill: '#ffffff' },
        ],
      },
    ],
  },
};

// A 1050×600 visiting card (≈3.5in × 2in at 300 dpi).
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
    width: 1050,
    height: 600,
    fonts: [],
    pages: [
      {
        id: 'page1',
        children: [
          { id: 'bg', type: 'figure', subType: 'rect', x: 0, y: 0, width: 1050, height: 600, fill: '#ffffff' },
          { id: 'accent', type: 'figure', subType: 'rect', x: 0, y: 0, width: 24, height: 600, fill: '#0f766e' },
          { id: 'business_name', name: 'business_name', type: 'text', x: 70, y: 70, width: 900, text: 'Your Business', fontSize: 56, fontFamily: 'Roboto', fontWeight: 'bold', fill: '#0f766e' },
          { id: 'person_name', name: 'person_name', type: 'text', x: 70, y: 300, width: 900, text: 'Your Name', fontSize: 44, fontFamily: 'Roboto', fontWeight: 'bold', fill: '#0f172a' },
          { id: 'designation', name: 'designation', type: 'text', x: 70, y: 360, width: 900, text: 'Proprietor', fontSize: 30, fontFamily: 'Roboto', fill: '#d97706' },
          { id: 'phone', name: 'phone', type: 'text', x: 70, y: 470, width: 900, text: '+91 ', fontSize: 28, fontFamily: 'Roboto', fill: '#334155' },
          { id: 'email', name: 'email', type: 'text', x: 70, y: 515, width: 900, text: 'you@example.com', fontSize: 28, fontFamily: 'Roboto', fill: '#334155' },
        ],
      },
    ],
  },
};

export const SAMPLE_DESIGN_TEMPLATES: DesignTemplateDef[] = [OFFER_POSTER, VISITING_CARD];
