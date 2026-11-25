// Sawdust: door-step carpenters. Forest green, oak tan and cream; a split hero with an animated workshop bench (moving hand saw, falling
// wood curls, swinging lamp, drifting sawdust); call-first layout with areas served and a quick quote; a page for every job type.
import content from './content.mjs';

const mark = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="10" fill="#1f4d3a"/><path d="M10 44h44M14 44V30l18-12 18 12v14" fill="none" stroke="#e3b66b" stroke-width="3.5" stroke-linejoin="round"/><path d="M20 52h24" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M26 34h12v10H26z" fill="#e3b66b"/></svg>`;

const plank = (x, y, w, c) => `<rect x="${x}" y="${y}" width="${w}" height="26" fill="${c}"/><path d="M${x + 14} ${y + 8}q${w / 3} -8 ${w / 2} 0M${x + 30} ${y + 18}q${w / 3} 6 ${w / 2.4} 0" fill="none" stroke="#a8742f" stroke-width="2" opacity=".6"/>`;
const tool = (x, body) => `<g transform="translate(${x} 60)">${body}</g>`;

const scene = `<svg viewBox="0 0 1200 600" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" focusable="false">
<defs><linearGradient id="sd-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4ead6"/><stop offset="1" stop-color="#e8d7b6"/></linearGradient></defs>
<rect width="1200" height="600" fill="url(#sd-wall)"/>
<rect x="140" y="40" width="920" height="250" rx="8" fill="#d9c398" stroke="#8a5a26" stroke-width="6"/>
<path d="M140 100h920M140 165h920M140 230h920" stroke="#8a5a26" stroke-width="2" opacity=".5"/>
${tool(190, '<path d="M0 0v110M0 0h40" stroke="#1f4d3a" stroke-width="5" fill="none"/><path d="M30 20l30 70" stroke="#6b7a82" stroke-width="12" stroke-linecap="round"/>')}
${tool(330, '<rect x="0" y="0" width="22" height="120" rx="6" fill="#a8742f"/><rect x="0" y="0" width="22" height="28" rx="6" fill="#1f4d3a"/>')}
${tool(450, '<path d="M0 0h90l-14 26H14z" fill="#6b7a82"/><rect x="40" y="26" width="10" height="70" fill="#a8742f"/>')}
${tool(640, '<circle cx="0" cy="30" r="24" fill="none" stroke="#1f4d3a" stroke-width="8"/><rect x="-6" y="52" width="12" height="60" fill="#a8742f"/>')}
${tool(760, '<path d="M0 0v100" stroke="#6b7a82" stroke-width="8"/><rect x="-14" y="100" width="28" height="22" fill="#a8742f"/>')}
${tool(880, '<path d="M0 10h70" stroke="#6b7a82" stroke-width="7"/><path d="M0 10l12 100M70 10l-12 100" stroke="#1f4d3a" stroke-width="5"/>')}
<g class="sc-lamp"><path d="M1010 0v120" stroke="#3a2a17" stroke-width="4"/><path d="M970 120h80l-14-38h-52z" fill="#1f4d3a"/><ellipse cx="1010" cy="124" rx="30" ry="8" fill="#ffe29a"/></g>
<rect y="470" width="1200" height="130" fill="#a8742f"/><path d="M0 470h1200" stroke="#6d4618" stroke-width="6"/>
<path d="M0 520h1200M0 570h1200" stroke="#8a5a26" stroke-width="3"/>
<rect x="180" y="360" width="760" height="40" fill="#8a5a26"/><rect x="200" y="400" width="30" height="110" fill="#6d4618"/><rect x="890" y="400" width="30" height="110" fill="#6d4618"/>
<g>${plank(270, 334, 360, '#e3b66b')}</g>
<g class="sc-saw"><path d="M560 262l176 52-16 24-176-52z" fill="#aeb8bf" stroke="#6b7a82" stroke-width="3"/><path d="M566 290l160 46" stroke="#6b7a82" stroke-width="3" stroke-dasharray="5 5"/><rect x="722" y="300" width="70" height="40" rx="12" fill="#1f4d3a" transform="rotate(16 722 300)"/></g>
<g class="sc-curl sc-curl--a" fill="none" stroke="#f3d79c" stroke-width="5" stroke-linecap="round"><path d="M520 380c-14 10-14 24 0 26"/></g>
<g class="sc-curl sc-curl--b" fill="none" stroke="#f3d79c" stroke-width="5" stroke-linecap="round"><path d="M580 388c-14 10-14 24 0 26"/></g>
<g class="sc-curl sc-curl--c" fill="none" stroke="#f3d79c" stroke-width="5" stroke-linecap="round"><path d="M640 384c-14 10-14 24 0 26"/></g>
<rect x="320" y="456" width="140" height="14" fill="#e3b66b"/><rect x="320" y="440" width="140" height="14" fill="#f0cb83"/>
<rect x="960" y="400" width="130" height="80" rx="6" fill="#1f4d3a"/><path d="M975 420h100M975 440h100M975 460h60" stroke="#e3b66b" stroke-width="4"/>
</svg>`;

const motionCss = `@keyframes sd-saw{from{transform:translate(-26px,-8px)}to{transform:translate(26px,8px)}}
@keyframes sd-curl{from{opacity:1;transform:translateY(-14px)}to{opacity:.15;transform:translateY(56px)}}
@keyframes sd-lamp{from{transform:rotate(-3deg)}to{transform:rotate(3deg)}}
.g4d-theme:not([data-motion="Off"]) .sc-saw{animation:sd-saw calc(1.3s / var(--g4d-motion-speed)) ease-in-out infinite alternate}
.g4d-theme:not([data-motion="Off"]) .sc-curl{animation:sd-curl calc(3s / var(--g4d-motion-speed)) ease-in infinite}
.g4d-theme:not([data-motion="Off"]) .sc-curl--b{animation-delay:1s}
.g4d-theme:not([data-motion="Off"]) .sc-curl--c{animation-delay:2s}
.g4d-theme:not([data-motion="Off"]) .sc-lamp{transform-box:fill-box;transform-origin:50% 0;animation:sd-lamp calc(4s / var(--g4d-motion-speed)) ease-in-out infinite alternate}
.g4d-theme[data-motion="Medium"] .card,.g4d-theme[data-motion="Rich"] .card{transition:transform .25s var(--g4d-motion-ease)}
.g4d-theme[data-motion="Medium"] .card:hover,.g4d-theme[data-motion="Rich"] .card:hover{transform:translateY(calc(var(--g4d-motion-distance) * -.5))}`;

const motionReduce = `  .g4d-theme .sc-saw,.g4d-theme .sc-curl,.g4d-theme .sc-lamp,.g4d-theme .card{animation:none;transition:none}`;

const extraCss = `.g4d-theme .card-art{background-image:url(../assets/pattern-grain.svg);background-size:cover}
.g4d-theme .tile-ic{background-image:url(../assets/motif-chair.svg)}
.g4d-theme .tile:nth-child(2) .tile-ic{background-image:url(../assets/motif-door.svg)}
.g4d-theme .tile:nth-child(3) .tile-ic{background-image:url(../assets/motif-hammer.svg)}
.g4d-theme .hero-eyebrow::before{content:"";display:inline-block;width:26px;height:6px;background:var(--g4d-accent);margin-right:10px;vertical-align:middle;border-radius:3px}
.g4d-theme .section--tint{background-color:var(--tp-tint)}
@media(min-width:900px){.g4d-theme .hero--split .hero-art{bottom:auto;height:min(100%,620px)}.g4d-theme .hero--split .hero-copy{max-width:min(520px,50%)}}`;

const ic = (extra) => `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#1f4d3a" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${extra}</svg>`;

export default {
  id: 'sawdust-carpenters',
  name: 'Sawdust: door-step carpenters',
  version: 1,
  description: 'Forest green and oak tan for door-step carpenters: a split banner with an animated workshop bench (hand saw, falling wood curls, swinging lamp), call-first layout with areas served and a quick quote, and a page for every job from wardrobes and doors to repairs.',
  categories: ['carpenter'],
  marketplace: { packs: ['SERVICES'], catalogueCategories: ['carpenter'], tags: ['call-first', 'door-step'] },
  previewAlt: ['Sawdust home page on a desktop screen: animated carpenter workshop banner and job cards', 'Sawdust home page on a phone: workshop scene, job links and call bar', 'Sawdust job page: what is included, key facts, indicative price and quick quote'],
  fontHeading: 'Merriweather', fontBody: 'Nunito',
  look: { header: 'dark', hero: 'split', card: 'tile', button: 'sharp', ornament: 'bracket', radius: '8px', headWeight: 800, headTracking: '-.01em', hue: 'forest-oak' },
  palette: {
    light: { primary: '#1f4d3a', primaryContrast: '#ffffff', accent: '#8a5a1a', onAccent: '#ffffff', bg: '#faf5ea', surface: '#ffffff', text: '#22201a', muted: '#554f43', border: '#e2d6bb', deep: '#14352a', tint: '#f0e5cc', ink: '#1f4d3a', warm: '#e3b66b' },
    dark: { primary: '#8fd1ae', primaryContrast: '#0d2218', accent: '#e3b66b', onAccent: '#1d1408', bg: '#13201a', surface: '#1c2d25', text: '#f3efe3', muted: '#b9c4b8', border: '#33493d', deep: '#0b1711', tint: '#182720', ink: '#f3efe3', warm: '#e3b66b' },
  },
  mark, scene, motionCss, motionReduce, extraCss,
  slides: false,
  home: ['trust', 'groups', 'items', 'blocks', 'about', 'steps', 'gallery', 'reviews', 'faq', 'areas', 'contact'],
  listPage: { slug: 'portfolio', title: 'Our work' },
  cardMeta: ['location', 'area', 'bedrooms'],
  itemFacts: [['category', 'Job type'], ['location', 'Where we work'], ['area', 'Typical size'], ['bedrooms', 'Wood and materials'], ['duration', 'Typical time']],
  labels: {
    linkRow: 'Jobs we do', slidesSection: 'Featured work', groupsSection: 'What we do', itemsSection: 'Our jobs', blocksSection: 'Rates and areas', aboutSection: 'About the carpenter',
    stepsSection: 'How a job works', teamSection: 'Our crew', areasSection: 'Areas we serve', contactSection: 'Call or send a message', detailSection: 'Job details',
    summary: 'Overview', highlights: 'What is included', keyFacts: 'Key facts', regNo: 'Registration number', priceWord: 'Indicative price', priceHeading: 'Indicative price',
    noPrice: 'Price after a quick look. Call or send an enquiry.', relatedSection: 'More jobs', relatedHeading: 'More jobs', findUs: 'Find us',
  },
  assets: {
    'favicon.svg': mark,
    'pattern-grain.svg': `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#1f4d3a"/><path d="M0 24q40-14 80 0t80 0M0 50q40-14 80 0t80 0M0 76q40-14 80 0t80 0" fill="none" stroke="#e3b66b" stroke-width="2.5" opacity=".7"/><circle cx="124" cy="32" r="12" fill="none" stroke="#e3b66b" stroke-width="2.5"/></svg>`,
    'motif-chair.svg': ic('<path d="M18 8v30h28V8M14 38h36M18 38v18M46 38v18M18 20h28"/>'),
    'motif-door.svg': ic('<path d="M16 54V8h32v46M12 54h40M40 32v2"/>'),
    'motif-hammer.svg': ic('<path d="M10 16h30l6 8-6 6H10zM30 30l16 24"/>'),
  },
  content,
};
