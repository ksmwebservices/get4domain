import type { ReactElement } from 'react';

/**
 * The one "Powered by Get4Domain" mark every vendor site carries, free or paid, on a subdomain or on the vendor's own domain.
 *
 * It has NO switch: no plan flag, no vendor setting and no theme option reaches this component, and it takes no prop that could hide or reword it (only a class name for spacing and colour).
 * Every footer of every design, theme and industry renders THIS component instead of typing the words, so the text, the link text (the brand name only) and the address cannot drift apart.
 * Do not add a "hide" option here: the contract (and its tests) is that the mark is always present.
 */
export const POWERED_BY_HREF = 'https://get4domain.com';
export const POWERED_BY_BRAND = 'Get4Domain';

export function PoweredBy({ className }: { className?: string }): ReactElement {
  return (
    <span className={className} data-g4d-powered-by="">
      Powered by <a href={POWERED_BY_HREF} target="_blank" rel="noopener" className="underline-offset-2 hover:underline">{POWERED_BY_BRAND}</a>
    </span>
  );
}

/** The mark on its own line, for a page whose footer is not ours to edit (an uploaded theme in its own frame): a bar of fixed height under the page. */
export const POWERED_BY_BAR_HEIGHT = '2.25rem';
export function PoweredByBar(): ReactElement {
  return (
    <div data-g4d-powered-by-bar="" className="flex items-center justify-center border-t border-slate-200 bg-white text-xs text-slate-500" style={{ height: POWERED_BY_BAR_HEIGHT }}>
      <PoweredBy />
    </div>
  );
}

export default PoweredBy;
