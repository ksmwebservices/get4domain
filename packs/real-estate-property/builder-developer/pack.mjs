// Blueprint: builders and project developers. Blueprint navy, safety orange and cement sand; a full-bleed construction-site scene
// (tower crane, building going up, trucks) behind the headline; a swipe slideshow of projects; one landing page per project.
import content from './content.mjs';

const mark = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="8" fill="#12304A"/><path d="M12 52V30h14v22M26 52V18h14v34M40 52V26h12v26" fill="none" stroke="#F4B56A" stroke-width="3" stroke-linejoin="round"/><path d="M8 52h48" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M33 8v10M24 11h18" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>`;

// The hero scene: dusk sky, skyline, a tower rising inside a tower crane, finished blocks, a site road with a truck.
const win = (x, y, c) => `<rect class="sc-win sc-win--${c}" x="${x}" y="${y}" width="9" height="12" fill="#ffd58a"/>`;
const scene = `<svg viewBox="0 0 1200 600" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" focusable="false">
<defs>
<linearGradient id="bd-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1d2e"/><stop offset=".55" stop-color="#27567c"/><stop offset=".9" stop-color="#f1b36a"/><stop offset="1" stop-color="#f6c98a"/></linearGradient>
<pattern id="bd-win" width="18" height="24" patternUnits="userSpaceOnUse"><rect x="5" y="6" width="8" height="11" fill="#f4c77a" opacity=".7"/></pattern>
</defs>
<rect width="1200" height="600" fill="url(#bd-sky)"/>
<circle cx="930" cy="450" r="112" fill="#ffd89b" opacity=".18"/><circle cx="930" cy="450" r="62" fill="#ffd89b" opacity=".92"/>
<g class="sc-cloud sc-cloud--a" fill="#fff" opacity=".17"><ellipse cx="220" cy="130" rx="86" ry="22"/><ellipse cx="270" cy="116" rx="54" ry="20"/><ellipse cx="170" cy="120" rx="46" ry="16"/></g>
<g class="sc-cloud sc-cloud--b" fill="#fff" opacity=".13"><ellipse cx="620" cy="210" rx="96" ry="20"/><ellipse cx="672" cy="198" rx="52" ry="18"/></g>
<g class="sc-cloud sc-cloud--c" fill="#fff" opacity=".15"><ellipse cx="1010" cy="96" rx="80" ry="18"/><ellipse cx="1050" cy="84" rx="44" ry="16"/></g>
<g fill="#1d4466" opacity=".95"><rect x="30" y="400" width="64" height="130"/><rect x="104" y="360" width="52" height="170"/><rect x="166" y="420" width="74" height="110"/><rect x="250" y="380" width="58" height="150"/><rect x="320" y="410" width="92" height="120"/><rect x="430" y="440" width="60" height="90"/></g>
<g><rect x="1000" y="330" width="96" height="200" fill="#143451"/><rect x="1000" y="330" width="96" height="200" fill="url(#bd-win)"/><rect x="1106" y="270" width="84" height="260" fill="#173b5b"/><rect x="1106" y="270" width="84" height="260" fill="url(#bd-win)"/><rect x="996" y="324" width="104" height="8" fill="#6f8aa3"/><rect x="1102" y="264" width="92" height="8" fill="#6f8aa3"/></g>
<g id="bd-tower"><rect x="700" y="420" width="190" height="110" fill="#244f75"/><rect x="700" y="420" width="190" height="110" fill="url(#bd-win)"/>
<g fill="#8fa6ba"><rect x="696" y="414" width="198" height="7"/><rect x="696" y="386" width="198" height="6"/><rect x="696" y="358" width="198" height="6"/><rect x="696" y="330" width="198" height="6"/><rect x="696" y="302" width="198" height="6"/></g>
<g fill="#a9bccd"><rect x="700" y="302" width="7" height="118"/><rect x="745" y="302" width="7" height="118"/><rect x="790" y="302" width="7" height="118"/><rect x="835" y="302" width="7" height="118"/><rect x="883" y="302" width="7" height="118"/></g>
<g fill="none" stroke="#f4b56a" stroke-width="1.5" opacity=".5"><path d="M700 302h190v118H700zM700 330h190M700 358h190M700 386h190M745 302v118M790 302v118M835 302v118"/></g>
${win(716, 436, 1)}${win(764, 468, 2)}${win(812, 440, 3)}${win(858, 482, 4)}
</g>
<g id="bd-crane"><path d="M806 520V128M834 520V128" stroke="#f4b56a" stroke-width="5"/><path d="M806 520l28-30-28-30 28-30-28-30 28-30-28-30 28-30-28-30 28-30-28-30 28-30-28-30 28-30-28-30 28-30" fill="none" stroke="#f4b56a" stroke-width="2.2" opacity=".85"/>
<rect x="560" y="112" width="500" height="12" fill="#f4b56a"/><path d="M560 124l20-12 20 12 20-12 20 12 20-12 20 12 20-12 20 12 20-12 20 12 20-12 20 12 20-12 20 12 20-12 20 12 20-12 20 12" fill="none" stroke="#c77d1d" stroke-width="2"/>
<path d="M820 64L580 112M820 64L1040 112" stroke="#c9d6e2" stroke-width="2"/><path d="M820 64l-10 48h20z" fill="#f4b56a"/><rect x="1010" y="124" width="46" height="30" fill="#6e8296"/><rect x="796" y="86" width="40" height="26" rx="3" fill="#ffd58a"/><rect x="802" y="92" width="14" height="12" fill="#27567c"/>
<g class="sc-trolley"><rect x="610" y="124" width="26" height="9" fill="#2b3f52"/><path d="M623 133V256" stroke="#12263a" stroke-width="2"/><g class="sc-load"><rect x="598" y="256" width="50" height="22" fill="#c2410c"/><path d="M598 256l25-14 25 14" fill="none" stroke="#12263a" stroke-width="2"/><rect x="598" y="256" width="50" height="5" fill="#8f2f06"/></g></g>
</g>
<rect y="520" width="1200" height="80" fill="#08131e"/><rect y="520" width="1200" height="5" fill="#173b5b"/><path d="M0 566h1200" stroke="#f4b56a" stroke-width="3" stroke-dasharray="40 30" opacity=".7"/>
<g fill="#f4b56a" opacity=".75"><rect x="40" y="505" width="4" height="18"/><rect x="80" y="505" width="4" height="18"/><rect x="120" y="505" width="4" height="18"/><rect x="160" y="505" width="4" height="18"/><rect x="200" y="505" width="4" height="18"/><rect x="240" y="505" width="4" height="18"/><path d="M40 510h204" stroke="#f4b56a" stroke-width="3"/></g>
<g class="sc-truck"><rect x="-300" y="538" width="86" height="34" rx="3" fill="#f4b56a"/><path d="M-214 548h28l12 14v10h-40z" fill="#e08a2b"/><rect x="-206" y="552" width="14" height="10" fill="#27567c"/><circle cx="-278" cy="574" r="9" fill="#12263a"/><circle cx="-232" cy="574" r="9" fill="#12263a"/><circle cx="-190" cy="574" r="9" fill="#12263a"/></g>
</svg>`;

const motionCss = `@keyframes bd-drift{from{transform:translateX(-50px)}to{transform:translateX(70px)}}
@keyframes bd-trolley{from{transform:translateX(0)}to{transform:translateX(190px)}}
@keyframes bd-lift{from{transform:translateY(0)}to{transform:translateY(-52px)}}
@keyframes bd-blink{from{opacity:.25}to{opacity:1}}
@keyframes bd-truck{from{transform:translateX(0)}to{transform:translateX(1520px)}}
.g4d-theme:not([data-motion="Off"]) .sc-cloud--a{animation:bd-drift calc(46s / var(--g4d-motion-speed)) ease-in-out infinite alternate}
.g4d-theme:not([data-motion="Off"]) .sc-cloud--b{animation:bd-drift calc(58s / var(--g4d-motion-speed)) ease-in-out infinite alternate-reverse}
.g4d-theme:not([data-motion="Off"]) .sc-trolley{animation:bd-trolley calc(14s / var(--g4d-motion-speed)) ease-in-out infinite alternate}
.g4d-theme:not([data-motion="Off"]) .sc-load{animation:bd-lift calc(5s / var(--g4d-motion-speed)) ease-in-out infinite alternate}
.g4d-theme:not([data-motion="Off"]) .sc-win--1{animation:bd-blink 2.6s ease-in-out infinite alternate}
.g4d-theme:not([data-motion="Off"]) .sc-win--3{animation:bd-blink 3.4s ease-in-out infinite alternate-reverse}
.g4d-theme[data-motion="Medium"] .sc-truck,.g4d-theme[data-motion="Rich"] .sc-truck{animation:bd-truck calc(26s / var(--g4d-motion-speed)) linear infinite}
.g4d-theme[data-motion="Medium"] .card,.g4d-theme[data-motion="Rich"] .card,.g4d-theme[data-motion="Medium"] .slide-link,.g4d-theme[data-motion="Rich"] .slide-link{transition:transform .25s var(--g4d-motion-ease)}
.g4d-theme[data-motion="Medium"] .card:hover,.g4d-theme[data-motion="Rich"] .card:hover,.g4d-theme[data-motion="Medium"] .slide-link:hover,.g4d-theme[data-motion="Rich"] .slide-link:hover{transform:translateY(calc(var(--g4d-motion-distance) * -.5))}`;

const motionReduce = `  .g4d-theme .sc-cloud--a,.g4d-theme .sc-cloud--b,.g4d-theme .sc-trolley,.g4d-theme .sc-load,.g4d-theme .sc-win--1,.g4d-theme .sc-win--3,.g4d-theme .sc-truck,.g4d-theme .card,.g4d-theme .slide-link{animation:none;transition:none}`;

const extraCss = `.g4d-theme .aside-booking h2{font-size:1.15rem}
.g4d-theme .scene svg{transform-origin:50% 100%}
.g4d-theme .card-art{background-image:url(../assets/pattern-blueprint.svg);background-size:cover}
.g4d-theme .tile-ic{background-image:url(../assets/motif-crane.svg)}
.g4d-theme .tile:nth-child(2) .tile-ic{background-image:url(../assets/motif-plan.svg)}
.g4d-theme .tile:nth-child(3) .tile-ic{background-image:url(../assets/motif-keys.svg)}
.g4d-theme .hero-eyebrow::before{content:"";display:inline-block;width:28px;height:3px;background:var(--g4d-accent);margin-right:10px;vertical-align:middle}
.g4d-theme .c-line .card-art{aspect-ratio:16/9}
.g4d-theme .section--tint{background-image:linear-gradient(var(--g4d-border) 1px,transparent 1px),linear-gradient(90deg,var(--g4d-border) 1px,transparent 1px);background-size:32px 32px;background-color:var(--tp-tint)}`;

const bp = (extra) => `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#12304a" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${extra}</svg>`;

export default {
  id: 'blueprint-builders',
  name: 'Blueprint: builders and project developers',
  version: 1,
  description: 'Blueprint navy and safety orange for builders and project developers: a full-bleed construction-site scene with a working tower crane, a swipe slideshow of projects, ongoing, upcoming and completed project groups, and a full landing page for every project.',
  categories: ['real-estate-agent'],
  marketplace: { packs: ['PROPERTY'], catalogueCategories: ['property-developer-builder'], tags: ['projects-landing-pages'] },
  previewAlt: ['Blueprint home page on a desktop screen: construction-site banner with a crane and project slideshow', 'Blueprint home page on a phone: banner, project links and bottom bar', 'Blueprint project landing page: key facts, amenities, price card and enquiry'],
  fontHeading: 'Montserrat', fontBody: 'Work Sans',
  look: { header: 'bar', hero: 'band', card: 'line', button: 'sharp', ornament: 'bracket', radius: '4px', headWeight: 800, headTracking: '-.02em', hue: 'navy-orange' },
  palette: {
    light: { primary: '#12304a', primaryContrast: '#ffffff', accent: '#b8400a', onAccent: '#ffffff', bg: '#f5f2ea', surface: '#ffffff', text: '#16222e', muted: '#4a5a68', border: '#d9d3c5', deep: '#0e2438', tint: '#ebe6d8', ink: '#12304a', warm: '#f4b56a' },
    dark: { primary: '#6aa8dc', primaryContrast: '#0f1a25', accent: '#ff9a5c', onAccent: '#0f1a25', bg: '#0f1a25', surface: '#172635', text: '#eef2f6', muted: '#a9b9c8', border: '#2a3d50', deep: '#0a1722', tint: '#162636', ink: '#eef2f6', warm: '#f4b56a' },
  },
  mark, scene, motionCss, motionReduce, extraCss,
  slides: true,
  home: ['slides', 'trust', 'groups', 'blocks', 'about', 'steps', 'stats', 'gallery', 'team', 'reviews', 'faq', 'areas', 'contact'],
  listPage: { slug: 'portfolio', title: 'Projects' },
  cardMeta: ['location', 'area', 'bedrooms'],
  itemFacts: [['category', 'Project type'], ['location', 'Location'], ['area', 'Sizes'], ['bedrooms', 'Configurations'], ['duration', 'Possession']],
  labels: {
    linkRow: 'Explore our projects', slidesSection: 'Featured projects', groupsSection: 'Project status', itemsSection: 'Projects', blocksSection: 'Listings and areas', aboutSection: 'About us',
    stepsSection: 'How buying works', teamSection: 'Our team', areasSection: 'Where we build', contactSection: 'Visit our site office', detailSection: 'Project details',
    summary: 'Overview', highlights: 'Amenities and highlights', keyFacts: 'Key facts', regNo: 'RERA registration number', priceWord: 'Starting price (indicative)', priceHeading: 'Starting price, indicative',
    noPrice: 'Price on request. Send an enquiry for the latest rates.', relatedSection: 'More projects', relatedHeading: 'More projects', findUs: 'Find us',
  },
  assets: {
    'favicon.svg': mark,
    'pattern-blueprint.svg': `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#12304a"/><path d="M0 20h160M0 40h160M0 60h160M0 80h160M20 0v100M40 0v100M60 0v100M80 0v100M100 0v100M120 0v100M140 0v100" stroke="#2f5d86" stroke-width=".6"/><path d="M30 80V46l22-14 22 14v34zM74 80V58h26v22M52 80V62h12v18" fill="none" stroke="#f4b56a" stroke-width="1.6" stroke-linejoin="round"/><path d="M104 80V30M104 30h38M142 30v12" fill="none" stroke="#f4b56a" stroke-width="1.6"/></svg>`,
    'motif-crane.svg': bp('<path d="M20 56V12M26 56V12M20 20l6 6-6 6 6 6-6 6 6 6M8 12h48M14 12L23 4l9 8M50 12v18M44 30h12v8H44"/><path d="M10 56h44"/>'),
    'motif-plan.svg': bp('<path d="M10 12h44v40H10zM10 28h20M30 12v24M38 36h16M46 36v16"/>'),
    'motif-keys.svg': bp('<path d="M10 30l18-18 6 6M12 34l-4 4 6 6 4-4M26 22l-8 8M28 12l20 20M40 24l8-8M52 36l-8 8-12-12"/><circle cx="16" cy="48" r="8"/><path d="M22 42l22-22M38 26l6 6M44 20l6 6"/>'),
  },
  content,
};
