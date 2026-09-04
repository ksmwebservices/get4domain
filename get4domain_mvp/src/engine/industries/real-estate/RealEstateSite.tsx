import ThemeScope from '../../theme/ThemeScope';
import type { EngineSiteData } from '../../types';
import { realEstateTheme } from './theme';
import { buildReModel } from './model';
import ReNav from './sections/ReNav';
import ReHero from './sections/ReHero';
import ReEnquiry from './sections/ReEnquiry';
import {
  ReFeaturedProjects, RePropertyTypes, ReLocation, ReAmenities,
  ReFloorPlans, ReGallery, ReConstruction, ReFooter,
} from './sections/blocks';

/**
 * The Real Estate reference website — the bespoke composition the engine dispatches
 * for `realestate` vendors. It merges real CMS/catalogue data with premium seed
 * content (model.ts), applies the architectural theme (ThemeScope), and lays out
 * the RE-native section order. This is NOT the generic DemoCatalogGrid template.
 */
export default function RealEstateSite({
  site, subdomain, preview = false,
}: {
  site: EngineSiteData;
  subdomain: string;
  preview?: boolean;
}) {
  const model = buildReModel(site);
  const projectOptions = model.projects.map((p) => ({ id: p.id, name: p.name }));

  return (
    <ThemeScope tokens={realEstateTheme} className="min-h-screen">
      <ReNav brand={model.brand.name} logo={model.brand.logo} phone={model.brand.phone} />
      <ReHero model={model} />
      <ReFeaturedProjects projects={model.projects} />
      <RePropertyTypes model={model} />
      <ReLocation model={model} />
      <ReAmenities model={model} />
      <ReFloorPlans model={model} />
      <ReGallery images={model.gallery} brand={model.brand.name} />
      <ReConstruction model={model} />
      <ReEnquiry
        subdomain={subdomain}
        brand={{ name: model.brand.name, phone: model.brand.phone, whatsapp: model.brand.whatsapp }}
        projects={projectOptions}
        preview={preview}
      />
      <ReFooter model={model} />
    </ThemeScope>
  );
}
