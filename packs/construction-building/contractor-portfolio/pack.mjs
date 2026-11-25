// Foundation: contractor portfolios (building, civil, electrical). Graphite, safety yellow and concrete grey; a centred hero with an
// animated work site (excavator, rising wall, welding sparks, power line); plated project cards; a landing page for every project.
import content from './content.mjs';

const mark = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="6" fill="#23272b"/><path d="M10 50h44M14 50V30h12v20M26 50V18h12v32M38 50V26h12v24" fill="none" stroke="#ffc400" stroke-width="3.5" stroke-linejoin="round"/><path d="M8 14h48" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-dasharray="8 6"/></svg>`;

const brick = (x, y, w) => `<rect x="${x}" y="${y}" width="${w}" height="14" fill="#c8693a" stroke="#8f4524" stroke-width="1.5"/>`;
const wall = (() => { let s = ''; for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) s += brick(640 + c * 40 + (r % 2 ? -20 : 0), 456 - r * 14, 40); return s; })();

const scene = `<svg viewBox="0 0 1200 520" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" focusable="false">
<defs><linearGradient id="fd-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfd6db"/><stop offset="1" stop-color="#f3efe3"/></linearGradient></defs>
<rect width="1200" height="520" fill="url(#fd-sky)"/>
<g class="sc-cloud sc-cloud--a" fill="#fff" opacity=".8"><ellipse cx="200" cy="90" rx="86" ry="20"/><ellipse cx="250" cy="78" rx="50" ry="16"/></g>
<g class="sc-cloud sc-cloud--b" fill="#fff" opacity=".7"><ellipse cx="860" cy="60" rx="90" ry="18"/></g>
<g fill="#9aa3aa"><rect x="40" y="250" width="80" height="220"/><rect x="130" y="300" width="70" height="170"/><rect x="900" y="280" width="90" height="190"/><rect x="1000" y="230" width="70" height="240"/></g>
<g stroke="#23272b" stroke-width="5" fill="none"><path d="M1120 470V150M1180 470V150"/><path d="M1090 150h120M1100 190l80-40M1100 230l80-40"/></g>
<path d="M1150 150L60 224" stroke="#23272b" stroke-width="2"/><path d="M1150 156L60 232" stroke="#23272b" stroke-width="2" opacity=".6"/>
<g>${wall}</g>
<path d="M630 372h250" stroke="#ffc400" stroke-width="6"/>
<rect y="470" width="1200" height="50" fill="#6b6f6a"/><rect y="470" width="1200" height="6" fill="#8d918b"/>
<g class="sc-digger"><rect x="250" y="436" width="130" height="30" rx="6" fill="#ffc400"/><rect x="262" y="466" width="106" height="14" rx="7" fill="#23272b"/><rect x="262" y="400" width="52" height="38" fill="#ffd84d"/><rect x="270" y="408" width="30" height="22" fill="#8fc4e8"/><g class="sc-arm"><path d="M350 436L440 380L500 420" stroke="#ffc400" stroke-width="12" fill="none" stroke-linejoin="round"/><path d="M500 420l20 24h-34z" fill="#23272b"/></g></g>
<g class="sc-spark" fill="#ffd84d"><circle cx="906" cy="452" r="4"/><circle cx="918" cy="444" r="3"/><circle cx="896" cy="442" r="3"/></g>
<g class="sc-bolt"><path d="M1150 100l-12 26h14l-10 24" stroke="#ffc400" stroke-width="4" fill="none" stroke-linejoin="round"/></g>
<g class="sc-truck"><rect x="-240" y="486" width="86" height="26" rx="3" fill="#ffc400"/><rect x="-154" y="494" width="34" height="18" fill="#e5a800"/><circle cx="-220" cy="514" r="8" fill="#23272b"/><circle cx="-140" cy="514" r="8" fill="#23272b"/></g>
</svg>`;

const motionCss = `@keyframes fd-drift{from{transform:translateX(-40px)}to{transform:translateX(60px)}}
@keyframes fd-dig{from{transform:rotate(-8deg)}to{transform:rotate(10deg)}}
@keyframes fd-spark{from{opacity:.1;transform:translateY(0)}to{opacity:1;transform:translateY(-10px)}}
@keyframes fd-bolt{0%,70%{opacity:.2}80%,100%{opacity:1}}
@keyframes fd-truck{from{transform:translateX(0)}to{transform:translateX(1500px)}}
.g4d-theme:not([data-motion="Off"]) .sc-cloud--a{animation:fd-drift calc(44s / var(--g4d-motion-speed)) ease-in-out infinite alternate}
.g4d-theme:not([data-motion="Off"]) .sc-cloud--b{animation:fd-drift calc(56s / var(--g4d-motion-speed)) ease-in-out infinite alternate-reverse}
.g4d-theme:not([data-motion="Off"]) .sc-arm{transform-box:fill-box;transform-origin:0 100%;animation:fd-dig calc(4s / var(--g4d-motion-speed)) ease-in-out infinite alternate}
.g4d-theme:not([data-motion="Off"]) .sc-spark{animation:fd-spark 1.1s ease-in infinite alternate}
.g4d-theme:not([data-motion="Off"]) .sc-bolt{animation:fd-bolt 2.4s steps(1) infinite}
.g4d-theme[data-motion="Medium"] .sc-truck,.g4d-theme[data-motion="Rich"] .sc-truck{animation:fd-truck calc(24s / var(--g4d-motion-speed)) linear infinite}
.g4d-theme[data-motion="Medium"] .card,.g4d-theme[data-motion="Rich"] .card{transition:transform .25s var(--g4d-motion-ease)}
.g4d-theme[data-motion="Medium"] .card:hover,.g4d-theme[data-motion="Rich"] .card:hover{transform:translateY(calc(var(--g4d-motion-distance) * -.5))}`;

const motionReduce = `  .g4d-theme .sc-cloud--a,.g4d-theme .sc-cloud--b,.g4d-theme .sc-arm,.g4d-theme .sc-spark,.g4d-theme .sc-bolt,.g4d-theme .sc-truck,.g4d-theme .card{animation:none;transition:none}`;

const extraCss = `.g4d-theme .card-art{background-image:url(../assets/pattern-site.svg);background-size:cover}
.g4d-theme .tile-ic{background-image:url(../assets/motif-building.svg)}
.g4d-theme .tile:nth-child(2) .tile-ic{background-image:url(../assets/motif-civil.svg)}
.g4d-theme .tile:nth-child(3) .tile-ic{background-image:url(../assets/motif-electrical.svg)}
.g4d-theme .hero-eyebrow::before{content:"";display:inline-block;width:34px;height:8px;margin-right:10px;vertical-align:middle;background:repeating-linear-gradient(-45deg,var(--g4d-accent) 0 6px,var(--tp-ink) 6px 12px)}
.g4d-theme .section--tint{background-color:var(--tp-tint)}`;

const ic = (extra) => `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#23272b" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${extra}</svg>`;

export default {
  id: 'foundation-contractors',
  name: 'Foundation: contractors and civil works',
  version: 1,
  description: 'Graphite and safety yellow for building, civil and electrical contractors: a centred banner with an animated work site (excavator, rising brick wall, power line), plated project cards and a full landing page for every job in the portfolio.',
  categories: ['mason-contractor'],
  marketplace: { packs: ['PROPERTY'], catalogueCategories: ['mason-contractor'], tags: ['portfolio-landing-pages', 'contractor'] },
  previewAlt: ['Foundation home page on a desktop screen: work-site banner with an excavator and project cards', 'Foundation home page on a phone: banner scene, job links and bottom bar', 'Foundation project page: scope, key facts, indicative rate and enquiry'],
  fontHeading: 'Montserrat', fontBody: 'Inter',
  look: { header: 'center', hero: 'center', card: 'plate', button: 'sharp', ornament: 'rule', radius: '6px', headWeight: 800, headTracking: '-.02em', hue: 'graphite-yellow' },
  palette: {
    light: { primary: '#23272b', primaryContrast: '#ffffff', accent: '#8a5a00', onAccent: '#ffffff', bg: '#f4f3ee', surface: '#ffffff', text: '#1d2024', muted: '#4b5057', border: '#d6d4cb', deep: '#181b1e', tint: '#e8e6dc', ink: '#23272b', warm: '#ffc400' },
    dark: { primary: '#ffc400', primaryContrast: '#14161a', accent: '#ffd84d', onAccent: '#14161a', bg: '#14161a', surface: '#1e2126', text: '#f1f1ec', muted: '#b4b7bc', border: '#34383e', deep: '#0e0f12', tint: '#1a1d21', ink: '#f1f1ec', warm: '#ffc400' },
  },
  mark, scene, motionCss, motionReduce, extraCss,
  slides: false,
  home: ['trust', 'groups', 'items', 'blocks', 'about', 'steps', 'gallery', 'team', 'reviews', 'faq', 'areas', 'contact'],
  listPage: { slug: 'portfolio', title: 'Our work' },
  cardMeta: ['location', 'area', 'bedrooms'],
  itemFacts: [['category', 'Work type'], ['location', 'Location'], ['area', 'Size'], ['bedrooms', 'Scope of work'], ['duration', 'Typical duration']],
  labels: {
    linkRow: 'See our work', slidesSection: 'Featured work', groupsSection: 'What we build', itemsSection: 'Our work', blocksSection: 'Rates and areas', aboutSection: 'About us',
    stepsSection: 'How a job runs', teamSection: 'Our team', areasSection: 'Where we work', contactSection: 'Get a site visit and quote', detailSection: 'Job details',
    summary: 'Overview', highlights: 'What is included', keyFacts: 'Key facts', regNo: 'Contractor licence or registration number', priceWord: 'Indicative rate', priceHeading: 'Indicative rate',
    noPrice: 'Quote after a site visit. Send an enquiry.', relatedSection: 'More of our work', relatedHeading: 'More of our work', findUs: 'Find us',
  },
  assets: {
    'favicon.svg': mark,
    'pattern-site.svg': `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#23272b"/><path d="M0 90h160" stroke="#ffc400" stroke-width="3"/><path d="M20 90V40h30v50M50 90V24h30v66M80 90V50h30v40" fill="none" stroke="#ffc400" stroke-width="1.8" stroke-linejoin="round"/><path d="M0 12h160" stroke="#fff" stroke-width="2" stroke-dasharray="10 8" opacity=".6"/></svg>`,
    'motif-building.svg': ic('<path d="M8 54h48M12 54V28h16v26M28 54V14h16v40M44 54V24h12v30M18 36h4M18 44h4M34 22h4M34 30h4M34 38h4"/>'),
    'motif-civil.svg': ic('<path d="M6 46h52M10 46c0-14 10-22 22-22s22 8 22 22M32 24V12M20 54h24"/>'),
    'motif-electrical.svg': ic('<path d="M36 6L18 34h14l-6 24 22-32H34z"/>'),
  },
  content,
};
