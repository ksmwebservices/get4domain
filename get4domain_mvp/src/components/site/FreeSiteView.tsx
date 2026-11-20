import SiteApp from '@/components/site-kit/SiteApp';
import { themeForSite } from '@/lib/v3-public/site-kit/resolver';
import { siteViewFromFree } from '@/lib/v3-public/site-kit/view';
import type { FreeView } from '@/lib/v3-public/site-state';

/**
 * The page of a Free site: information only. By rule it has no contact form, no chat widget, no call-to-action button, no mailto or tel link and no e-mail address
 * (the phone number is plain text). The design is the kit's: the theme comes from the vendor's category (see lib/v3-public/site-kit/resolver.ts), drawn in "info" mode,
 * which never writes those things. Do not add any of them here; a test scans this file and renders the page.
 */
export default function FreeSiteView({ view }: { view: FreeView }) {
  const { theme, pack } = themeForSite({ vendor: { industry: view.industry }, pack: { key: view.packKey } });
  return <SiteApp view={siteViewFromFree(view, pack)} theme={theme} />;
}
