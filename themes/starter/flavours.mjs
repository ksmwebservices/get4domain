// Layout flavours for starter themes: small, token-only CSS blocks appended to css/base.css after the shared core. Each one changes ONE visible habit of the page (spacing, buttons, cards, hero, titles, header),
// so a recipe that picks two or three of them draws a clearly different page from the same templates. Rules: every selector starts with .g4d-theme (css-scoped), no !important, no colour of its own (only the
// theme's tokens, so contrast stays the palette's job), no outside address, nothing animated. Plain data: add a flavour here and name it in a recipe.
export const FLAVOURS = {
  airy: {
    label: 'generous spacing',
    css: `.g4d-theme .sec { padding-block: clamp(2.5rem, 1.5rem + 4.5vw, 5.5rem); }
.g4d-theme .hero { padding-block: clamp(2.25rem, 1.25rem + 4.5vw, 5rem); }
.g4d-theme .cards { gap: 1.5rem; }
`,
  },
  compact: {
    label: 'tight spacing',
    css: `.g4d-theme .sec { padding-block: clamp(1.1rem, 0.8rem + 1.6vw, 2.25rem); }
.g4d-theme .hero { padding-block: clamp(1rem, 0.75rem + 1.8vw, 2rem); }
.g4d-theme .cards { gap: 0.75rem; }
.g4d-theme .sec-title { margin-bottom: 0.6rem; }
`,
  },
  pill: {
    label: 'pill buttons',
    css: `.g4d-theme :is(.btn, .g4d-btn, .head-phone, .head-wa) { border-radius: 999px; }
.g4d-theme .chips li { padding-inline: 1.1rem; }
`,
  },
  'flat-cards': {
    label: 'flat cards on the surface colour',
    css: `.g4d-theme .card { background: var(--g4d-surface); border-color: transparent; }
.g4d-theme .alt .card { background: var(--g4d-bg); }
`,
  },
  'raised-cards': {
    label: 'raised cards with a soft shadow',
    css: `.g4d-theme .card { border-color: transparent; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1), 0 8px 22px rgba(0, 0, 0, 0.1); }
`,
  },
  'outlined-cards': {
    label: 'cards with a strong outline',
    css: `.g4d-theme .card { border: 2px solid var(--g4d-border); }
.g4d-theme .card-title { font-weight: 700; }
`,
  },
  'centered-hero': {
    label: 'centred hero text',
    css: `.g4d-theme .hero-grid { text-align: center; justify-items: center; }
.g4d-theme .hero .actions { justify-content: center; }
.g4d-theme .hero .lead { margin-inline: auto; max-width: 42rem; }
`,
  },
  'banded-hero': {
    label: 'hero closed by an accent band',
    css: `.g4d-theme .hero { border-bottom: 6px solid var(--g4d-accent); }
.g4d-theme .hero-art img { aspect-ratio: 3 / 2; }
`,
  },
  'ruled-titles': {
    label: 'section titles with an accent rule',
    css: `.g4d-theme .sec-title { display: inline-block; padding-bottom: 0.3rem; border-bottom: 3px solid var(--g4d-accent); }
`,
  },
  'spaced-eyebrow': {
    label: 'small capital eyebrow lines',
    css: `.g4d-theme .eyebrow { text-transform: uppercase; letter-spacing: 0.1em; font-size: 0.85rem; }
`,
  },
  'header-rule': {
    label: 'header closed by a thick rule',
    css: `.g4d-theme .site-header { border-bottom: 3px solid var(--g4d-primary); }
`,
  },
  'wide-measure': {
    label: 'wider page measure',
    css: `.g4d-theme .wrap { max-width: 80rem; }
.g4d-theme .narrow { max-width: 52rem; }
`,
  },
  'tight-measure': {
    label: 'narrower page measure',
    css: `.g4d-theme .wrap { max-width: 64rem; }
`,
  },
};
export const FLAVOUR_IDS = Object.keys(FLAVOURS);
