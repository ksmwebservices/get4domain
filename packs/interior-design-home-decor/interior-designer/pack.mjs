// Atelier: interior designers. Plum, blush and brass; a split hero with an animated living room (swaying curtain, swinging pendant,
// glowing floor lamp, moving plant and a cloud in the window); soft cards; a landing page for every design service.
import content from './content.mjs';

const mark = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="16" fill="#5b2145"/><path d="M14 40h36v8H14zM18 40v-8a6 6 0 016-6h16a6 6 0 016 6v8" fill="none" stroke="#e8c38a" stroke-width="3.5" stroke-linejoin="round"/><path d="M32 8v10" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M24 18h16l-3 8H27z" fill="#e8c38a"/></svg>`;

const scene = `<svg viewBox="0 0 1200 600" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" focusable="false">
<defs><linearGradient id="at-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7e9e2"/><stop offset="1" stop-color="#efd6cc"/></linearGradient><clipPath id="at-win"><rect x="450" y="120" width="190" height="230"/></clipPath><radialGradient id="at-glow"><stop offset="0" stop-color="#ffe7a8" stop-opacity=".9"/><stop offset="1" stop-color="#ffe7a8" stop-opacity="0"/></radialGradient></defs>
<rect width="1200" height="600" fill="url(#at-wall)"/>
<rect x="450" y="120" width="190" height="230" fill="#bfe3f0" stroke="#5b2145" stroke-width="8"/>
<g clip-path="url(#at-win)"><g class="sc-cloud sc-cloud--a" fill="#fff"><ellipse cx="510" cy="190" rx="50" ry="16"/><ellipse cx="545" cy="178" rx="30" ry="14"/></g><path d="M450 350q60-70 120-30t70-20v50z" fill="#9bcf9d"/></g>
<path d="M545 120v230M450 235h190" stroke="#5b2145" stroke-width="5"/>
<g class="sc-curtain" ><path d="M420 100h50v270q-25-20-50 0z" fill="#b5476f"/><path d="M436 100v265M452 100v262" stroke="#8c2f52" stroke-width="2"/></g>
<path d="M630 100h50v270q-25-20-50 0z" fill="#b5476f"/><path d="M646 100v265M662 100v262" stroke="#8c2f52" stroke-width="2"/>
<rect x="400" y="86" width="310" height="10" rx="5" fill="#c8932f"/>
<g><rect x="760" y="140" width="110" height="140" fill="#fff" stroke="#c8932f" stroke-width="6"/><circle cx="815" cy="190" r="26" fill="#e8a7a0"/><path d="M770 270l36-50 24 30 20-20 10 40z" fill="#5b2145"/></g>
<g><rect x="300" y="170" width="64" height="86" fill="#fff" stroke="#c8932f" stroke-width="5"/><path d="M310 246l22-36 14 20 10-12 6 28z" fill="#8c2f52"/></g>
<g class="sc-pend"><path d="M545 0v90" stroke="#5b2145" stroke-width="3"/><path d="M515 90h60l12 34h-84z" fill="#c8932f"/><circle cx="545" cy="128" r="22" fill="url(#at-glow)"/></g>
<rect y="470" width="1200" height="130" fill="#b98a63"/><path d="M0 470h1200" stroke="#9a6f4b" stroke-width="5"/>
<ellipse cx="560" cy="540" rx="300" ry="40" fill="#e7cdb7"/><ellipse cx="560" cy="540" rx="250" ry="30" fill="none" stroke="#8c2f52" stroke-width="4" stroke-dasharray="14 10"/>
<g><rect x="360" y="400" width="400" height="74" rx="18" fill="#6b2c4f"/><rect x="380" y="352" width="360" height="66" rx="22" fill="#7d3860"/><rect x="340" y="378" width="46" height="96" rx="18" fill="#6b2c4f"/><rect x="734" y="378" width="46" height="96" rx="18" fill="#6b2c4f"/><rect x="410" y="372" width="62" height="52" rx="12" fill="#e8c38a"/><rect x="640" y="374" width="62" height="50" rx="12" fill="#e8a7a0"/><rect x="380" y="474" width="14" height="14" fill="#3a1230"/><rect x="726" y="474" width="14" height="14" fill="#3a1230"/></g>
<g><circle cx="900" cy="300" r="90" fill="url(#at-glow)" class="sc-glow"/><path d="M900 470V300" stroke="#3a1230" stroke-width="6"/><path d="M868 300h64l-10-50h-44z" fill="#e8c38a"/><ellipse cx="900" cy="472" rx="30" ry="7" fill="#3a1230"/></g>
<g><rect x="978" y="430" width="54" height="42" rx="6" fill="#8c2f52"/><g class="sc-plant"><path d="M1005 430c-40-40-54-90-30-130M1005 430c10-50 40-90 60-110M1005 430c-6-60-4-110 6-150" stroke="#2f8f5a" stroke-width="7" fill="none" stroke-linecap="round"/><ellipse cx="972" cy="300" rx="16" ry="30" fill="#3aa56d"/><ellipse cx="1066" cy="318" rx="14" ry="28" fill="#3aa56d"/><ellipse cx="1012" cy="276" rx="14" ry="30" fill="#2f8f5a"/></g></g>
</svg>`;

const motionCss = `@keyframes at-drift{from{transform:translateX(-30px)}to{transform:translateX(70px)}}
@keyframes at-sway{from{transform:skewX(-2deg)}to{transform:skewX(3deg)}}
@keyframes at-pend{from{transform:rotate(-3deg)}to{transform:rotate(3deg)}}
@keyframes at-glow{from{opacity:.6}to{opacity:1}}
@keyframes at-plant{from{transform:rotate(-3deg)}to{transform:rotate(3deg)}}
.g4d-theme:not([data-motion="Off"]) .sc-cloud--a{animation:at-drift calc(30s / var(--g4d-motion-speed)) ease-in-out infinite alternate}
.g4d-theme:not([data-motion="Off"]) .sc-curtain{transform-box:fill-box;transform-origin:50% 0;animation:at-sway calc(5s / var(--g4d-motion-speed)) ease-in-out infinite alternate}
.g4d-theme:not([data-motion="Off"]) .sc-pend{transform-box:fill-box;transform-origin:50% 0;animation:at-pend calc(4s / var(--g4d-motion-speed)) ease-in-out infinite alternate}
.g4d-theme:not([data-motion="Off"]) .sc-glow{animation:at-glow 2.8s ease-in-out infinite alternate}
.g4d-theme:not([data-motion="Off"]) .sc-plant{transform-box:fill-box;transform-origin:50% 100%;animation:at-plant calc(5.5s / var(--g4d-motion-speed)) ease-in-out infinite alternate}
.g4d-theme[data-motion="Medium"] .card,.g4d-theme[data-motion="Rich"] .card{transition:transform .25s var(--g4d-motion-ease)}
.g4d-theme[data-motion="Medium"] .card:hover,.g4d-theme[data-motion="Rich"] .card:hover{transform:translateY(calc(var(--g4d-motion-distance) * -.5))}`;

const motionReduce = `  .g4d-theme .sc-cloud--a,.g4d-theme .sc-curtain,.g4d-theme .sc-pend,.g4d-theme .sc-glow,.g4d-theme .sc-plant,.g4d-theme .card{animation:none;transition:none}`;

const extraCss = `.g4d-theme .card-art{background-image:url(../assets/pattern-atelier.svg);background-size:cover}
.g4d-theme .tile-ic{background-image:url(../assets/motif-sofa.svg)}
.g4d-theme .tile:nth-child(2) .tile-ic{background-image:url(../assets/motif-shop.svg)}
.g4d-theme .tile:nth-child(3) .tile-ic{background-image:url(../assets/motif-plan.svg)}
.g4d-theme .hero-eyebrow::before{content:"";display:inline-block;width:22px;height:2px;background:var(--g4d-accent);margin-right:10px;vertical-align:middle}
.g4d-theme .section--tint{background-color:var(--tp-tint)}
@media(min-width:900px){.g4d-theme .hero--split .hero-art{bottom:auto;height:min(100%,620px)}.g4d-theme .hero--split .hero-copy{max-width:min(520px,50%)}}`;

const ic = (extra) => `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#5b2145" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${extra}</svg>`;

export default {
  id: 'atelier-interior-designers',
  name: 'Atelier: interior designers',
  version: 1,
  description: 'Plum, blush and brass for interior designers: a split banner with an animated living room (swaying curtain, swinging pendant, glowing lamp, moving plant), soft cards, and a landing page for every design service from living rooms and kitchens to offices and shops.',
  categories: ['interior-designer-architect'],
  marketplace: { packs: ['PROPERTY'], catalogueCategories: ['interior-designer-architect'], tags: ['portfolio-landing-pages', 'interiors'] },
  previewAlt: ['Atelier home page on a desktop screen: animated living-room banner and design service cards', 'Atelier home page on a phone: living-room scene, service links and bottom bar', 'Atelier service page: key facts, what is included, indicative price and enquiry'],
  fontHeading: 'Lora', fontBody: 'DM Sans',
  look: { header: 'bar', hero: 'split', card: 'soft', button: 'pill', ornament: 'dots', radius: '20px', headWeight: 700, headTracking: '-.01em', hue: 'plum-brass' },
  palette: {
    light: { primary: '#5b2145', primaryContrast: '#ffffff', accent: '#8f5a12', onAccent: '#ffffff', bg: '#fbf5f1', surface: '#ffffff', text: '#2a1a24', muted: '#5d4a56', border: '#e6d5cc', deep: '#3a1230', tint: '#f3e6df', ink: '#5b2145', warm: '#e8c38a' },
    dark: { primary: '#e7b3d0', primaryContrast: '#2a0f20', accent: '#e8c38a', onAccent: '#201408', bg: '#1d1119', surface: '#2a1a25', text: '#f6ecf1', muted: '#c9b2c0', border: '#46303f', deep: '#150b11', tint: '#241520', ink: '#f6ecf1', warm: '#e8c38a' },
  },
  mark, scene, motionCss, motionReduce, extraCss,
  slides: false,
  home: ['trust', 'groups', 'items', 'blocks', 'about', 'steps', 'gallery', 'team', 'reviews', 'faq', 'areas', 'contact'],
  listPage: { slug: 'portfolio', title: 'Our designs' },
  cardMeta: ['location', 'area', 'bedrooms'],
  itemFacts: [['category', 'Service'], ['location', 'Where we work'], ['area', 'Typical size'], ['bedrooms', 'What is included'], ['duration', 'Typical timeline']],
  labels: {
    linkRow: 'Our design services', slidesSection: 'Featured designs', groupsSection: 'What we design', itemsSection: 'Design services', blocksSection: 'Packages and areas', aboutSection: 'About the studio',
    stepsSection: 'How we work', teamSection: 'Our team', areasSection: 'Where we work', contactSection: 'Visit the studio', detailSection: 'Service details',
    summary: 'Overview', highlights: 'What is included', keyFacts: 'Key facts', regNo: 'Registration or membership number', priceWord: 'Indicative price', priceHeading: 'Indicative price',
    noPrice: 'Price after a design consultation. Send an enquiry.', relatedSection: 'More design services', relatedHeading: 'More design services', findUs: 'Find us',
  },
  assets: {
    'favicon.svg': mark,
    'pattern-atelier.svg': `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#5b2145"/><path d="M28 70h104v14H28zM36 70V52a10 10 0 0110-10h68a10 10 0 0110 10v18" fill="#7d3860" stroke="#e8c38a" stroke-width="2" stroke-linejoin="round"/><path d="M80 8v18" stroke="#e8c38a" stroke-width="2"/><path d="M66 26h28l-6 14H72z" fill="#e8c38a"/></svg>`,
    'motif-sofa.svg': ic('<path d="M8 38h48v12H8zM12 38v-8a6 6 0 016-6h28a6 6 0 016 6v8M14 50v6M50 50v6"/>'),
    'motif-shop.svg': ic('<path d="M8 22h48l-4-12H12zM12 22v32h40V22M26 54V36h12v18"/>'),
    'motif-plan.svg': ic('<path d="M10 12h44v40H10zM10 28h20M30 12v24M38 36h16M46 36v16"/>'),
  },
  content,
};
