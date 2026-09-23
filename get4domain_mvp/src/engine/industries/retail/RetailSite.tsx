import EngineSiteFrame from '../../components/EngineSiteFrame';
import Reveal from '../../components/Reveal';
import KitHero from '../../kit/KitHero';
import KitEnquiry from '../../kit/KitEnquiry';
import { IconGrid, Testimonials, Rows } from '../../kit/sections';
import { IMG } from '../../kit/content';
import type { EngineMode, EngineSiteData } from '../../types';
import { retailTheme } from './theme';
import { buildRetailBrand, buildRetailCatalog } from './data';
import { RetailCartProvider } from './cart-context';
import RetailNav from './components/RetailNav';
import ProductGrid from './components/ProductGrid';
import CartDrawer from './components/CartDrawer';

const DEFAULTS: Record<string, { name: string; tagline: string; about: string; gridTitle: string; gridSub: string }> = {
  fashion: { name: 'The Fashion House', tagline: 'Style That Speaks for You', about: 'A boutique with a curated collection — ethnic, western and party wear, picked and priced fairly, with new arrivals every week.', gridTitle: 'New arrivals & collections', gridSub: 'Ethnic, western and party wear — updated every week.' },
  electronics: { name: 'GadgetHub Electronics', tagline: 'Latest Gadgets, Best Prices', about: 'Genuine electronics and mobiles with honest pricing, EMI options and after-sales service you can trust.', gridTitle: 'Phones, gadgets & appliances', gridSub: 'Genuine products, easy EMI and warranty on everything.' },
  grocery: { name: 'SmartMart Supermarket', tagline: 'Your Neighbourhood Store, Online', about: 'Everyday essentials — staples, fresh produce and household items — ordered online, delivered the same day.', gridTitle: 'Everyday essentials', gridSub: 'Staples, produce and home care — restocked daily.' },
  jewellery: { name: 'Aura Jewellers', tagline: 'Timeless Pieces, Honest Pricing', about: 'Hallmarked gold, certified diamonds and bridal collections — crafted for the moments that matter.', gridTitle: 'Our collection', gridSub: 'Gold, diamond and bridal pieces — enquire for today\'s rate.' },
  footwear: { name: 'StrideWorks', tagline: 'Every Step, Sorted', about: 'Sneakers, running shoes and everyday fits in every size and colourway — pick your pair and check out in minutes.', gridTitle: 'Sneakers, running shoes & more', gridSub: 'Every size in stock — pick a size and colourway that fits.' },
  general: { name: 'SmartMart Supermarket', tagline: 'Everything You Need. Shop Online.', about: 'A modern store with a curated range, honest prices and quick delivery — shop in-store or online, your way.', gridTitle: 'Browse the store', gridSub: 'A curated range across every category we carry.' },
};

/**
 * The Retail & Shopping website — the bespoke composition the engine dispatches for
 * `retail` vendors AND the `/demo/retail(/:subId)` demo route. Ported from the Step N
 * Rock reference design (grid → PDP → cart → checkout), restyled onto get4domain's
 * engine tokens so the SAME structure supports any retail sub-vertical via palette +
 * catalogue only (fashion/electronics/grocery/jewellery today) — no component here
 * hardcodes a colour or a product type. Replaces the generic `KitRenderer` + data-only
 * `buildRetail()` this industry used before (see registry.ts).
 */
export default function RetailSite({ site, mode }: { site: EngineSiteData; mode: EngineMode }) {
  const subId = mode.kind === 'demo' ? mode.subId : undefined;
  const seed = DEFAULTS[subId ?? 'general'] ?? DEFAULTS.general;
  const brand = buildRetailBrand(site, seed);
  const products = buildRetailCatalog(site, subId, seed.name);
  const subdomain = mode.kind === 'live' ? mode.subdomain : '';
  const canCheckout = mode.kind === 'live' && !!site.paymentsEnabled && !!subdomain;
  const heroImage = site.cms?.banner || IMG.retail[0];

  const navLinks = [
    { href: '#shop', label: 'Shop' },
    { href: '#why', label: 'Why us' },
    { href: '#visit', label: 'Visit' },
    { href: '#enquiry', label: 'Contact' },
  ];

  return (
    <RetailCartProvider vendorId={site.vendor.id} canCheckout={canCheckout} subdomain={subdomain} brandName={brand.name}>
      <EngineSiteFrame
        tokens={retailTheme}
        bottomNav={[
          { label: 'Home', icon: 'home', href: '#top' },
          { label: 'Shop', icon: 'products', href: '#shop' },
          { label: 'Enquiry', icon: 'enquiry', href: '#enquiry', emphasis: true },
          { label: 'Why us', icon: 'offers', href: '#why' },
          { label: 'Visit', icon: 'visit', href: '#visit' },
        ]}
      >
        <RetailNav brand={brand.name} logo={brand.logo} links={navLinks} />

        <KitHero
          variant="panel"
          eyebrow="Shop in-store or online"
          headline={brand.tagline}
          subline={brand.about}
          image={heroImage}
          ctaPrimary={{ label: 'Shop now', href: '#shop' }}
          ctaSecondary={{ label: 'Contact us', href: '#enquiry' }}
        />

        <ProductGrid products={products} title={seed.gridTitle} sub={seed.gridSub} />

        <Reveal>
          <IconGrid
            id="why" eyebrow="Why shop with us" title="Made for easy shopping"
            items={[
              { label: 'Genuine products', icon: 'ShieldCheck' },
              { label: 'Fast delivery', icon: 'Truck' },
              { label: 'Easy returns', icon: 'Package' },
              { label: 'Secure payments', icon: 'Percent' },
              { label: 'In-store pickup', icon: 'Home' },
              { label: 'Friendly support', icon: 'Phone' },
            ]}
          />
        </Reveal>

        <Reveal>
          <Testimonials
            id="reviews" eyebrow="Shoppers" title="What shoppers say"
            items={[
              { quote: 'Ordered in the morning, delivered by evening. Genuine products too.', author: 'Anita' },
              { quote: 'The offers are unreal. Grabbed three things at a big discount.', author: 'Vivek' },
              { quote: 'Loyalty points actually add up. Been a regular for a year.', author: 'Sana' },
            ]}
          />
        </Reveal>

        <Reveal>
          <Rows
            id="visit" eyebrow="Visit" title="Find the store" note="Open all week; delivery across the city."
            items={[
              { label: 'Store hours', value: brand.businessHours || '10am – 9pm' },
              { label: 'Delivery', value: 'Same day' },
              { label: 'Returns', value: '7 days' },
              { label: 'Parking', value: 'Available' },
            ]}
          />
        </Reveal>

        <Reveal>
          <KitEnquiry
            mode={mode}
            brand={{ name: brand.name, phone: brand.phone, whatsapp: brand.whatsapp }}
            choices={['General enquiry', 'Bulk / wholesale order', 'Product availability', 'Store visit']}
            choiceLabel="I'm interested in"
            eyebrow="Get in touch" title="Questions before you order?" sub="Tell us what you're after — we'll confirm stock, price and delivery."
            points={['Genuine products', 'Same-day delivery', 'Easy returns']}
            tabs={[{ key: 'enquiry', label: 'Ask us', icon: 'MessageSquare', action: { intent: 'engine.enquiry', label: 'Ask us', kind: 'enquiry' }, fields: ['choice', 'message'], submitLabel: 'Send enquiry' }]}
          />
        </Reveal>

        <footer className="border-t border-[var(--eng-border)] bg-[var(--eng-bg)] px-5 py-14">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-10 md:grid-cols-[2fr_1fr_1fr]">
              <div>
                <div className="font-[family-name:var(--eng-fontDisplay)] text-xl">{brand.name}</div>
                <p className="mt-3 max-w-sm text-sm text-[var(--eng-muted)]">{brand.tagline}</p>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-widest text-[var(--eng-muted)]">Contact</div>
                <ul className="mt-3 space-y-2 text-sm">
                  {brand.phone && <li><a href={`tel:${brand.phone}`} className="hover:text-[var(--eng-accent)]">{brand.phone}</a></li>}
                  {brand.email && <li><a href={`mailto:${brand.email}`} className="hover:text-[var(--eng-accent)]">{brand.email}</a></li>}
                  {brand.address && <li className="text-[var(--eng-muted)]">{brand.address}</li>}
                </ul>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-widest text-[var(--eng-muted)]">Shop</div>
                <a href="#shop" className="mt-3 inline-block bg-[var(--eng-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--eng-accent-fg)]" style={{ borderRadius: 'var(--eng-radius)' }}>Browse products</a>
              </div>
            </div>
            <div className="mt-12 flex flex-col items-center justify-between gap-2 border-t border-[var(--eng-border)] pt-6 text-xs text-[var(--eng-muted)] sm:flex-row">
              <p>© {new Date().getFullYear()} {brand.name}. All rights reserved.</p>
              <p>Powered by Get4Domain</p>
            </div>
          </div>
        </footer>

        <CartDrawer />
      </EngineSiteFrame>
    </RetailCartProvider>
  );
}
