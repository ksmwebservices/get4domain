import { permanentRedirect } from 'next/navigation';
import { assertV3Public } from '@/lib/v3-public/guard';
import { portalLinks } from '@/lib/v3-public/portal-links';

export const dynamic = 'force-dynamic';

/**
 * The old directory sign-up address. Registration is one flow on the main site (/register: plan, category, address and the "Is this your business?" step),
 * so this address only forwards there (a permanent redirect, absolute when the directory is its own host).
 */
export default function AccountRegisterPage(): never {
  assertV3Public();
  permanentRedirect(portalLinks('directory').main('/register'));
}
