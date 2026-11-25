// Doorstep: property agents and portals. Deep teal, warm gold and mint white; a split hero with an animated street of homes,
// a swinging For Sale board, a passing car and a floating key; sale, rent and lease groups; one landing page per property.
import content from './content.mjs';

const mark = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="14" fill="#0e5a57"/><path d="M12 32L32 14l20 18" fill="none" stroke="#f2c46b" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 30v20h28V30" fill="none" stroke="#fff" stroke-width="3.5" stroke-linejoin="round"/><circle cx="32" cy="38" r="4" fill="#f2c46b"/><path d="M32 42v6" stroke="#f2c46b" stroke-width="3" stroke-linecap="round"/></svg>`;

const house = (x, w, h, wall, roof) => `<g><rect x="${x}" y="${470 - h}" width="${w}" height="${h}" fill="${wall}"/><path d="M${x - 10} ${470 - h}L${x + w / 2} ${470 - h - 46}L${x + w + 10} ${470 - h}z" fill="${roof}"/><rect x="${x + w / 2 - 12}" y="${470 - 44}" width="24" height="44" rx="2" fill="#0a3b39"/><rect x="${x + 12}" y="${470 - h + 22}" width="20" height="22" fill="#ffe3a3" class="sc-win"/><rect x="${x + w - 32}" y="${470 - h + 22}" width="20" height="22" fill="#ffe3a3" class="sc-win sc-win--2"/></g>`;
const tree = (x, s) => `<g><rect x="${x - 4}" y="${440 - 14 * s}" width="8" height="${30 * s}" fill="#5a3d24"/><circle cx="${x}" cy="${430 - 24 * s}" r="${26 * s}" fill="#2f8f68"/><circle cx="${x - 16 * s}" cy="${440 - 18 * s}" r="${18 * s}" fill="#3aa57a"/><circle cx="${x + 16 * s}" cy="${440 - 18 * s}" r="${18 * s}" fill="#3aa57a"/></g>`;

const scene = `<svg viewBox="0 0 1200 600" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" focusable="false">
<defs><linearGradient id="dp-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd3cf"/><stop offset=".7" stop-color="#d8f0e6"/><stop offset="1" stop-color="#fbf0cf"/></linearGradient></defs>
<rect width="1200" height="600" fill="url(#dp-sky)"/>
<circle cx="1010" cy="120" r="54" fill="#ffe18a"/><circle cx="1010" cy="120" r="84" fill="#ffe18a" opacity=".25"/>
<g class="sc-cloud sc-cloud--a" fill="#fff" opacity=".85"><ellipse cx="240" cy="110" rx="80" ry="22"/><ellipse cx="290" cy="96" rx="48" ry="18"/></g>
<g class="sc-cloud sc-cloud--b" fill="#fff" opacity=".7"><ellipse cx="700" cy="170" rx="90" ry="20"/><ellipse cx="750" cy="158" rx="46" ry="16"/></g>
<path d="M0 400q150-70 300-20t300-10 300 30 300-20v90H0z" fill="#b6dccb"/>
${tree(60, 1.2)}${house(110, 150, 120, '#f6e3c1', '#c4572f')}${house(300, 130, 150, '#fff6e4', '#0e5a57')}${tree(470, 1)}
${house(520, 170, 190, '#e8f1ee', '#8a4b1e')}${house(730, 140, 130, '#f9e6c9', '#0e5a57')}${tree(910, 1.3)}${house(960, 150, 160, '#fff1d6', '#b5482a')}${tree(1150, 1)}
<g><path d="M690 470V368" stroke="#5a3d24" stroke-width="6"/><path d="M690 372h70" stroke="#5a3d24" stroke-width="5"/><g class="sc-board"><rect x="700" y="372" width="86" height="46" rx="5" fill="#fff" stroke="#0e5a57" stroke-width="3"/><rect x="700" y="372" width="86" height="16" rx="3" fill="#c2410c"/><text x="743" y="385" font-family="Arial,sans-serif" font-size="11" font-weight="700" fill="#fff" text-anchor="middle">FOR SALE</text><path d="M712 404h62M712 411h40" stroke="#0e5a57" stroke-width="3" stroke-linecap="round"/></g></g>
<rect y="470" width="1200" height="130" fill="#5f7b78"/><rect y="470" width="1200" height="8" fill="#9db8b3"/><path d="M0 538h1200" stroke="#f2c46b" stroke-width="4" stroke-dasharray="46 32"/>
<g class="sc-car"><rect x="-260" y="500" width="110" height="30" rx="8" fill="#0e5a57"/><path d="M-244 500l14-22h52l16 22z" fill="#14766f"/><rect x="-232" y="484" width="18" height="14" fill="#cdeee9"/><rect x="-206" y="484" width="22" height="14" fill="#cdeee9"/><circle cx="-232" cy="532" r="10" fill="#10282a"/><circle cx="-180" cy="532" r="10" fill="#10282a"/></g>
<g class="sc-key"><circle cx="1090" cy="260" r="20" fill="none" stroke="#c98a14" stroke-width="7"/><path d="M1090 280v58M1090 316h16M1090 332h12" stroke="#c98a14" stroke-width="7" stroke-linecap="round"/></g>
</svg>`;

const motionCss = `@keyframes dp-drift{from{transform:translateX(-40px)}to{transform:translateX(60px)}}
@keyframes dp-swing{from{transform:rotate(-5deg)}to{transform:rotate(5deg)}}
@keyframes dp-car{from{transform:translateX(0)}to{transform:translateX(1500px)}}
@keyframes dp-bob{from{transform:translateY(0) rotate(-6deg)}to{transform:translateY(-14px) rotate(6deg)}}
@keyframes dp-glow{from{opacity:.55}to{opacity:1}}
.g4d-theme:not([data-motion="Off"]) .sc-cloud--a{animation:dp-drift calc(40s / var(--g4d-motion-speed)) ease-in-out infinite alternate}
.g4d-theme:not([data-motion="Off"]) .sc-cloud--b{animation:dp-drift calc(52s / var(--g4d-motion-speed)) ease-in-out infinite alternate-reverse}
.g4d-theme:not([data-motion="Off"]) .sc-board{transform-box:fill-box;transform-origin:0 0;animation:dp-swing calc(3.4s / var(--g4d-motion-speed)) ease-in-out infinite alternate}
.g4d-theme:not([data-motion="Off"]) .sc-key{transform-box:fill-box;transform-origin:50% 0;animation:dp-bob calc(4s / var(--g4d-motion-speed)) ease-in-out infinite alternate}
.g4d-theme:not([data-motion="Off"]) .sc-win--2{animation:dp-glow 3.6s ease-in-out infinite alternate}
.g4d-theme[data-motion="Medium"] .sc-car,.g4d-theme[data-motion="Rich"] .sc-car{animation:dp-car calc(24s / var(--g4d-motion-speed)) linear infinite}
.g4d-theme[data-motion="Medium"] .card,.g4d-theme[data-motion="Rich"] .card{transition:transform .25s var(--g4d-motion-ease)}
.g4d-theme[data-motion="Medium"] .card:hover,.g4d-theme[data-motion="Rich"] .card:hover{transform:translateY(calc(var(--g4d-motion-distance) * -.5))}`;

const motionReduce = `  .g4d-theme .sc-cloud--a,.g4d-theme .sc-cloud--b,.g4d-theme .sc-board,.g4d-theme .sc-key,.g4d-theme .sc-win--2,.g4d-theme .sc-car,.g4d-theme .card{animation:none;transition:none}`;

const extraCss = `.g4d-theme .card-art{background-image:url(../assets/pattern-doorstep.svg);background-size:cover}
.g4d-theme .tile-ic{background-image:url(../assets/motif-sale.svg)}
.g4d-theme .tile:nth-child(2) .tile-ic{background-image:url(../assets/motif-rent.svg)}
.g4d-theme .tile:nth-child(3) .tile-ic{background-image:url(../assets/motif-lease.svg)}
.g4d-theme .hero-eyebrow::before{content:"";display:inline-block;width:12px;height:12px;border-radius:50%;background:var(--g4d-accent);margin-right:10px;vertical-align:middle}
.g4d-theme .c-tile{box-shadow:0 8px 22px rgba(10,59,57,.08)}
.g4d-theme .section--tint{background-color:var(--tp-tint)}`;

const ic = (extra) => `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#0e5a57" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${extra}</svg>`;

export default {
  id: 'doorstep-property-agents',
  name: 'Doorstep: property agents and portals',
  version: 1,
  description: 'Deep teal and warm gold for property agents and local portals: a split banner with an animated street of homes, a swinging For Sale board and a passing car, sale, rent and lease groups, a landing page for every property and a locality focus.',
  categories: ['real-estate-agent'],
  marketplace: { packs: ['PROPERTY'], catalogueCategories: ['real-estate-agent'], tags: ['property-landing-pages', 'local-areas'] },
  previewAlt: ['Doorstep home page on a desktop screen: split banner with an animated street of homes and property cards', 'Doorstep home page on a phone: banner scene, listing links and bottom bar', 'Doorstep property landing page: key facts, highlights, price and enquiry'],
  fontHeading: 'Playfair Display', fontBody: 'Manrope',
  look: { header: 'dark', hero: 'split', card: 'tile', button: 'pill', ornament: 'rule', radius: '14px', headWeight: 700, headTracking: '-.01em', hue: 'teal-gold' },
  palette: {
    light: { primary: '#0e5a57', primaryContrast: '#ffffff', accent: '#9a5b06', onAccent: '#ffffff', bg: '#f3f8f6', surface: '#ffffff', text: '#14262a', muted: '#46595c', border: '#cfe0da', deep: '#0a3b39', tint: '#e2efeb', ink: '#0e5a57', warm: '#f2c46b' },
    dark: { primary: '#6fd0c8', primaryContrast: '#062a29', accent: '#f2c46b', onAccent: '#1b1405', bg: '#0b1f20', surface: '#122b2d', text: '#eaf4f2', muted: '#a6c0bd', border: '#244244', deep: '#071819', tint: '#10282a', ink: '#eaf4f2', warm: '#f2c46b' },
  },
  mark, scene, motionCss, motionReduce, extraCss,
  slides: false,
  home: ['trust', 'groups', 'items', 'blocks', 'about', 'steps', 'gallery', 'team', 'reviews', 'faq', 'areas', 'contact'],
  listPage: { slug: 'properties', title: 'Properties' },
  cardMeta: ['location', 'area', 'bedrooms'],
  itemFacts: [['category', 'Listing'], ['location', 'Locality'], ['area', 'Size'], ['bedrooms', 'Configuration'], ['duration', 'Availability']],
  labels: {
    linkRow: 'Find a property', slidesSection: 'Featured properties', groupsSection: 'Browse by listing type', itemsSection: 'Properties', blocksSection: 'Rates and localities', aboutSection: 'About us',
    stepsSection: 'How we help you', teamSection: 'Our team', areasSection: 'Localities we cover', contactSection: 'Visit our office', detailSection: 'Property details',
    summary: 'Overview', highlights: 'Features and highlights', keyFacts: 'Key facts', regNo: 'RERA agent registration number', priceWord: 'Price (indicative)', priceHeading: 'Price, indicative',
    noPrice: 'Price on request. Send an enquiry for the latest rate.', relatedSection: 'Similar properties', relatedHeading: 'Similar properties', findUs: 'Find us',
  },
  assets: {
    'favicon.svg': mark,
    'pattern-doorstep.svg': `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#0e5a57"/><circle cx="130" cy="24" r="12" fill="#f2c46b"/><path d="M10 90V54l24-18 24 18v36zM70 90V62l20-14 20 14v28zM120 90V70l16-12 16 12v20z" fill="#14766f" stroke="#f2c46b" stroke-width="1.6" stroke-linejoin="round"/><path d="M0 90h160" stroke="#f2c46b" stroke-width="2"/></svg>`,
    'motif-sale.svg': ic('<path d="M10 30L32 10l22 20M16 28v24h32V28M26 52V40h12v12M44 8h14v10H44z"/>'),
    'motif-rent.svg': ic('<circle cx="22" cy="24" r="10"/><path d="M30 31l22 22M42 43l6-6M48 49l6-6M22 14v-4"/><path d="M8 54h20"/>'),
    'motif-lease.svg': ic('<path d="M10 54V22l22-10 22 10v32zM10 54h44M22 30h8v8h-8zM34 30h8v8h-8zM22 42h8v12M34 42h8v12"/>'),
  },
  content,
};
