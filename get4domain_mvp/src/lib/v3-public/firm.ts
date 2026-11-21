/**
 * The firm identity shown on the legal pages: one typed settings object, read in one place.
 * An admin setting will replace it later (docs/v3/PUBLIC_GAPS.md, G6): only `getFirm` changes, the pages do not.
 * The GSTIN is shown only when it is set; today it is pending, so nothing is shown for it.
 */
export interface FirmSettings {
  name: string;
  /** the registered address as one line */
  address: string;
  /** null while pending; never shown as a placeholder */
  gstin: string | null;
}

const FIRM: FirmSettings = {
  name: 'KSM QUANTUM TECHNOLOGIES',
  address: 'Tidel Park, Chennai',
  gstin: null,
};

export function getFirm(): FirmSettings {
  return FIRM;
}

/** The GSTIN as a display line, or null when it is not set (so that nothing about it is rendered). */
export function gstinLine(f: FirmSettings): string | null {
  const g = (f.gstin ?? '').trim();
  return g ? g : null;
}
