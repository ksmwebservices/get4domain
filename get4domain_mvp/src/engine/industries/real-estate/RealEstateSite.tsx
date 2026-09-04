import EngineSiteFrame from '../../components/EngineSiteFrame';
import type { EngineMode, EngineSiteData } from '../../types';
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
 * for `realestate` vendors AND the demo route. It merges real CMS/catalogue data with
 * premium seed content (model.ts), applies the architectural theme + base engine frame
 * (mobile bottom-nav), and lays out the RE-native section order. NOT the generic
 * DemoCatalogGrid template. Where it submits (live vendor / real demo lead / preview)
 * is decided purely by `mode`, with no change to any section code.
 */
export default function RealEstateSite({ site, mode }: { site: EngineSiteData; mode: EngineMode }) {
  const model = buildReModel(site);
  const projectOptions = model.projects.map((p) => ({ id: p.id, name: p.name }));

  return (
    <EngineSiteFrame
      tokens={realEstateTheme}
      bottomNav={{
        primaryLabel: 'Book a visit',
        primaryHref: '#enquiry',
        phone: model.brand.phone,
        whatsapp: model.brand.whatsapp,
        whatsappText: `Hi ${model.brand.name}, I'm interested in your properties. Please share details.`,
      }}
    >
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
        mode={mode}
        brand={{ name: model.brand.name, phone: model.brand.phone, whatsapp: model.brand.whatsapp }}
        projects={projectOptions}
      />
      <ReFooter model={model} />
    </EngineSiteFrame>
  );
}
