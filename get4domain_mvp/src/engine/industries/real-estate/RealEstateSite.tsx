import EngineSiteFrame from '../../components/EngineSiteFrame';
import Reveal from '../../components/Reveal';
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
      bottomNav={[
        { label: 'Home', icon: 'home', href: '#top' },
        { label: 'Properties', icon: 'building', href: '#featured' },
        { label: 'Enquiry', icon: 'enquiry', href: '#enquiry' },
        { label: 'Visit', icon: 'visit', href: '#enquiry', emphasis: true },
        { label: 'More', icon: 'more', href: '#gallery' },
      ]}
    >
      <ReNav brand={model.brand.name} logo={model.brand.logo} phone={model.brand.phone} />
      <ReHero model={model} />
      <Reveal><ReFeaturedProjects projects={model.projects} /></Reveal>
      <Reveal><RePropertyTypes model={model} /></Reveal>
      <Reveal><ReLocation model={model} /></Reveal>
      <Reveal><ReAmenities model={model} /></Reveal>
      <Reveal><ReFloorPlans model={model} /></Reveal>
      <Reveal><ReGallery images={model.gallery} brand={model.brand.name} /></Reveal>
      <Reveal><ReConstruction model={model} /></Reveal>
      <Reveal>
        <ReEnquiry
          mode={mode}
          brand={{ name: model.brand.name, phone: model.brand.phone, whatsapp: model.brand.whatsapp }}
          projects={projectOptions}
        />
      </Reveal>
      <ReFooter model={model} />
    </EngineSiteFrame>
  );
}
