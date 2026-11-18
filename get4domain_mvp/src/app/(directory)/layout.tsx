import PortalShell from '@/components/portal/PortalShell';
import { assertV3Public } from '@/lib/v3-public/guard';

/** The shell of every directory, claim, account and legal page (dispatch J1): the same portal header and footer as the main site, with Directory marked as the current area. */
export default function DirectoryLayout({ children }: { children: React.ReactNode }) {
  assertV3Public();
  return <PortalShell variant="directory">{children}</PortalShell>;
}
