import type { Viewport } from 'next';
import PortalShell from '@/components/portal/PortalShell';
import { assertV3Public } from '@/lib/v3-public/guard';

/** viewport-fit=cover lets the phone bottom bar use the safe area below the page; the width and the colour of the root layout stay. */
export const viewport: Viewport = { viewportFit: 'cover' };

/** The shell of the commercial public pages (dispatch J1): the portal header with the category mega menu and the rich footer. Every link in it is a real page. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  assertV3Public();
  return <PortalShell variant="site">{children}</PortalShell>;
}
