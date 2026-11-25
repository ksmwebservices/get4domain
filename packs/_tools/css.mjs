// CSS for a factory pack. The core below is the proven structure of the route-board-travels reference (slot sizes reserved, touch targets,
// :target phone menu, fixed bottom nav, wrapping rules) re-expressed with design choices taken from spec.look. A pack adds its own
// scene and motifs through spec.extraCss and spec.motionCss. No !important, no outside address, transform and opacity only in motion.

const hex = (s) => (/^#[0-9a-f]{3,8}$/i.test(s) ? s.toLowerCase() : s);

export function tokensCss(spec) {
  const L = spec.palette.light, D = spec.palette.dark;
  const rows = (p, dark) => [
    ['--g4d-primary', p.primary], ['--g4d-primary-contrast', p.primaryContrast], ['--g4d-accent', p.accent], ['--g4d-bg', p.bg], ['--g4d-surface', p.surface],
    ['--g4d-text', p.text], ['--g4d-muted', p.muted], ['--g4d-border', p.border],
    ...(dark ? [] : [['--g4d-radius', spec.look.radius ?? '12px'], ['--g4d-font-heading', stack(spec.fontHeading, true)], ['--g4d-font-body', stack(spec.fontBody, false)],
      ['--g4d-motion-speed', '1'], ['--g4d-motion-ease', 'cubic-bezier(.2,.8,.2,1)'], ['--g4d-motion-distance', '8px']]),
    ['--tp-on-accent', p.onAccent], ['--tp-deep', p.deep], ['--tp-tint', p.tint], ['--tp-ink', p.ink], ['--tp-warm', p.warm],
  ].map(([k, v]) => `  ${k}:${hex(v)};`).join('\n');
  return `/* ${spec.name} tokens */\n.g4d-theme{\n${rows(L, false)}\n}\n@media (prefers-color-scheme: dark){\n  .g4d-theme{\n${rows(D, true).replace(/^ {2}/gm, '    ')}\n  }\n}\n`;
}

function stack(font, heading) {
  const serif = ['Playfair Display', 'Lora', 'Merriweather'].includes(font);
  const tamil = serif ? '"Noto Serif Tamil"' : '"Noto Sans Tamil"';
  const generic = serif ? 'Georgia,serif' : 'system-ui,sans-serif';
  return `"${font}",${tamil},${generic}`;
}

/** Puts every top-level selector under .g4d-theme (lint rule css-scoped). Keyframe steps and already scoped selectors are left alone. */
export function scope(input) {
  const css = input.replace(/\/\*[\s\S]*?\*\//g, '');
  const splitTop = (s) => { const parts = []; let d = 0, cur = ''; for (const ch of s) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { parts.push(cur); cur = ''; } else cur += ch; } parts.push(cur); return parts; };
  let out = '', i = 0; const stack = [];
  while (i < css.length) {
    const open = css.indexOf('{', i); const close = css.indexOf('}', i);
    if (open === -1 && close === -1) { out += css.slice(i); break; }
    if (close !== -1 && (open === -1 || close < open)) { out += css.slice(i, close + 1); stack.pop(); i = close + 1; continue; }
    const prelude = css.slice(i, open); const lead = prelude.match(/^\s*/)[0]; const sel = prelude.trim();
    if (sel.startsWith('@')) { stack.push(/^@(-\w+-)?keyframes/.test(sel) ? 'kf' : 'at'); out += prelude + '{'; }
    else if (stack.includes('kf')) { stack.push('step'); out += prelude + '{'; }
    else { stack.push('rule'); out += lead + splitTop(sel).map((s) => { const t = s.trim(); return t.startsWith('.g4d-theme') || t.startsWith(':root') ? t : `.g4d-theme ${t}`; }).join(',') + '{'; }
    i = open + 1;
  }
  return out;
}

export function baseCss(spec) {
  return scope(baseCssRaw(spec));
}

function baseCssRaw(spec) {
  const k = spec.look;
  const btnR = k.button === 'pill' ? '999px' : k.button === 'sharp' ? '4px' : '10px';
  const cardCss = {
    tile: `.c-tile{background:var(--g4d-surface);border:1.5px solid var(--g4d-border);border-radius:var(--g4d-radius);overflow:hidden}
.c-tile .card-art{border-bottom:1.5px solid var(--g4d-border)}`,
    plate: `.c-plate{background:var(--g4d-surface);border:2px solid var(--tp-ink);border-radius:6px;box-shadow:6px 6px 0 var(--g4d-accent);overflow:hidden}
.c-plate .card-art{border-bottom:2px solid var(--tp-ink)}`,
    line: `.c-line{background:var(--g4d-surface);border:1px solid var(--g4d-border);border-left:6px solid var(--g4d-primary);border-radius:2px;overflow:hidden}`,
    soft: `.c-soft{background:var(--g4d-surface);border-radius:22px;box-shadow:0 10px 30px rgba(20,30,40,.10);overflow:hidden}`,
  }[k.card];
  const heroCss = {
    split: `.hero--split .hero-art{position:relative;height:clamp(210px,54vw,300px)}
.hero--split .hero-grid{padding-block:28px 40px}
@media(min-width:900px){
  .hero--split{min-height:560px;display:flex;align-items:center}
  .hero--split .hero-art{position:absolute;inset:0 0 0 44%;height:auto}
  .hero--split .hero-grid{padding-block:56px;position:relative}
  .hero--split .hero-copy{max-width:min(540px,52%)}
  .hero--split .hero-shade{background:linear-gradient(90deg,var(--tp-deep) 0,rgba(0,0,0,0) 38%)}
}`,
    band: `.hero--band{min-height:560px;display:flex;align-items:flex-end}
.hero--band .hero-art{position:absolute;inset:0}
.hero--band .hero-shade{background:linear-gradient(180deg,rgba(0,0,0,.05) 0,var(--tp-deep) 92%)}
.hero--band .hero-grid{position:relative;padding-block:200px 44px}
@media(min-width:900px){.hero--band .hero-grid{padding-block:140px 56px}.hero--band .hero-copy{max-width:640px}.hero--band .hero-shade{background:linear-gradient(90deg,var(--tp-deep) 0,rgba(0,0,0,.35) 55%,rgba(0,0,0,0) 100%)}}`,
    center: `.hero--center{text-align:center}
.hero--center .hero-art{position:relative;height:clamp(200px,46vw,340px);order:2}
.hero--center{display:flex;flex-direction:column}
.hero--center .hero-grid{order:1;padding-block:40px 24px}
.hero--center .hero-copy{margin-inline:auto;max-width:760px}
.hero--center .hero-cta,.hero--center .svc-links{justify-content:center}
.hero--center .lede{margin-inline:auto}`,
  }[k.hero];
  const headerCss = {
    bar: `.h-bar{background:var(--g4d-surface);border-bottom:1.5px solid var(--g4d-border)}`,
    dark: `.h-dark{background:var(--tp-deep);color:#fff}.h-dark .brand,.h-dark .g4d-slot--header-nav ul a,.h-dark .g4d-menu-open{color:#fff}.h-dark .g4d-menu-open{border-color:#fff}.h-dark .g4d-slot--header-nav ul a[aria-current]{background:rgba(255,255,255,.14);color:#fff}`,
    center: `.h-center{background:var(--g4d-surface);border-bottom:3px double var(--g4d-border)}.h-center .head-row{flex-wrap:wrap;justify-content:center;padding-block:8px}.h-center .brand{margin:0 auto}
@media(min-width:900px){.h-center .g4d-slot--header-nav{order:3;width:100%}.h-center .g4d-slot--header-nav ul{justify-content:center}.h-center .g4d-slot--action{position:absolute;right:16px}}`,
  }[k.header];
  const orn = {
    rule: `.sec-head h2::after{content:"";display:block;width:56px;height:4px;background:var(--g4d-accent);margin-top:10px;border-radius:2px}`,
    dots: `.sec-head h2::after{content:"";display:block;width:64px;height:8px;margin-top:10px;background:radial-gradient(circle,var(--g4d-accent) 3px,transparent 3.5px) 0 0/16px 8px repeat-x}`,
    bracket: `.sec-head h2::before{content:"";display:block;width:34px;height:34px;margin-bottom:8px;border-top:4px solid var(--g4d-accent);border-left:4px solid var(--g4d-accent)}`,
  }[k.ornament ?? 'rule'];

  return `/* ${spec.name} layout */
.g4d-theme{background:var(--g4d-bg);color:var(--g4d-text);font:400 15.5px/1.65 var(--g4d-font-body);overflow-wrap:anywhere;padding-bottom:calc(72px + env(safe-area-inset-bottom))}
.g4d-theme *,.g4d-theme *::before,.g4d-theme *::after{box-sizing:border-box}
.g4d-theme img,.g4d-theme svg{max-width:100%;display:block;height:auto}
.g4d-theme a{color:var(--g4d-primary);text-underline-offset:3px}
.g4d-theme h1,.g4d-theme h2,.g4d-theme h3{font-family:var(--g4d-font-heading);font-weight:${k.headWeight ?? 700};line-height:1.12;letter-spacing:${k.headTracking ?? '-.01em'};margin:0}
.g4d-theme h1{font-size:clamp(2rem,6.4vw,3.5rem)}
.g4d-theme h2{font-size:clamp(1.55rem,4.2vw,2.3rem)}
.g4d-theme h3{font-size:1.2rem}
.g4d-theme p{margin:0}
.g4d-theme ul,.g4d-theme ol{margin:0;padding:0;list-style:none}
.g4d-theme .wrap{width:min(100% - 32px,1160px);margin-inline:auto}
.g4d-theme .wrap>*{min-width:0}
.g4d-theme .lede{font-size:1.04rem;color:var(--g4d-muted);max-width:60ch}
.g4d-theme .skip-link{position:absolute;left:-999px;top:8px;background:var(--g4d-accent);color:var(--tp-on-accent);padding:10px 14px;border-radius:8px;z-index:100}
.g4d-theme .skip-link:focus{left:8px}
.g4d-theme :focus-visible{outline:3px solid var(--g4d-accent);outline-offset:2px}
.g4d-theme :is(a,button,summary,input,textarea){min-height:44px}
.g4d-theme .g4d-slot--header-nav,.g4d-theme .g4d-slot--action,.g4d-theme .g4d-slot--social-links{min-height:44px}
.g4d-theme .g4d-slot--bottom-nav{min-height:64px}
.g4d-theme .g4d-slot--whatsapp-float{min-height:54px;min-width:54px}
.g4d-theme .g4d-slot--footer{min-height:240px}
.g4d-theme .g4d-slot--map{min-height:280px;border-radius:var(--g4d-radius);overflow:hidden;max-width:100%}
.g4d-theme .g4d-slot--enquiry-form{min-height:340px}
.g4d-theme .g4d-slot--hours{min-height:120px;font-size:.92rem;color:var(--g4d-muted)}
.g4d-theme .g4d-slot--reviews{min-height:120px}
.g4d-theme .g4d-slot--listed-on-badge{min-height:36px}
.g4d-theme .g4d-slot--open-now{min-height:32px}
.g4d-theme .g4d-slot--share-qr{min-height:44px}
.g4d-theme .g4d-slot--claim-banner{min-height:1px}
.g4d-theme .g4d-slot--booking{min-height:120px}
.g4d-theme .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;min-width:48px;padding:10px 20px;border-radius:${btnR};font:700 .95rem/1.2 var(--g4d-font-body);text-decoration:none;border:2px solid var(--tp-ink);background:transparent;color:var(--g4d-text);cursor:pointer;text-align:center}
.g4d-theme .btn--go{background:var(--g4d-accent);border-color:var(--g4d-accent);color:var(--tp-on-accent)}
.g4d-theme .btn--wa{background:#157a3c;border-color:#157a3c;color:#fff}
.g4d-theme .btn--sm{min-height:44px;padding:8px 16px;font-size:.88rem}
.g4d-theme .btn--ghost{border-color:#fff;color:#fff}
/* header and menu */
.g4d-theme .site-header{position:sticky;top:0;z-index:30}
${headerCss}
.g4d-theme .head-row{display:flex;align-items:center;gap:12px;min-height:64px}
.g4d-theme .brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--g4d-text);margin-right:auto;min-height:44px;min-width:0}
.g4d-theme .brand img{width:auto;height:40px;max-width:160px}
.g4d-theme .brand-mark{width:40px;height:40px;flex:none}
.g4d-theme .brand-name{font:700 1.02rem/1.15 var(--g4d-font-heading);overflow-wrap:anywhere}
.g4d-theme .g4d-slot--header-nav ul{display:flex;gap:4px}
.g4d-theme .g4d-slot--header-nav ul a{display:inline-flex;align-items:center;padding:0 12px;min-height:44px;text-decoration:none;color:var(--g4d-text);font-weight:600;font-size:.92rem;border-radius:8px}
.g4d-theme .g4d-slot--header-nav ul a[aria-current]{color:var(--g4d-primary);background:var(--tp-tint)}
.g4d-theme .g4d-menu-open{flex:none;min-width:max-content;display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border:2px solid var(--g4d-text);border-radius:${btnR};font-weight:600;font-size:.9rem;color:var(--g4d-text);text-decoration:none}
.g4d-theme .g4d-menu{display:none}
.g4d-theme .g4d-menu:target{display:block;position:fixed;inset:0;z-index:80;background:var(--g4d-surface);padding:20px 24px;overflow:auto}
.g4d-theme .g4d-menu-close{display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border:2px solid var(--g4d-text);border-radius:${btnR};font-weight:600;color:var(--g4d-text);text-decoration:none;margin-bottom:12px}
.g4d-theme .g4d-menu:target ul{display:grid;gap:4px}
.g4d-theme .g4d-menu:target ul a{min-height:56px;font:700 1.4rem/1.2 var(--g4d-font-heading);border-bottom:1.5px solid var(--g4d-border);border-radius:0;color:var(--g4d-text)}
@media(min-width:900px){
  .g4d-theme .g4d-menu-open,.g4d-theme .g4d-menu-close{display:none}
  .g4d-theme .g4d-menu,.g4d-theme .g4d-menu:target{display:block;position:static;inset:auto;padding:0;background:none;overflow:visible}
  .g4d-theme .g4d-menu:target ul{display:flex;gap:4px}
  .g4d-theme .g4d-menu:target ul a{min-height:44px;font:600 .92rem/1.2 var(--g4d-font-body);border-bottom:0;border-radius:8px}
}
@media(max-width:599px){.g4d-theme .site-header .g4d-slot--action{display:none}.g4d-theme .g4d-slot--header-nav{margin-left:auto;flex:none}.g4d-theme .brand{margin-right:0}}
/* app shell: fixed bottom bar and WhatsApp float */
.g4d-theme .g4d-slot--bottom-nav{position:fixed;left:0;right:0;bottom:0;z-index:40;background:var(--g4d-surface);border-top:2px solid var(--tp-ink)}
.g4d-theme .g4d-slot--bottom-nav ul{display:grid;grid-auto-flow:column;grid-auto-columns:1fr}
.g4d-theme .g4d-slot--bottom-nav a{display:flex;align-items:center;justify-content:center;min-height:64px;text-align:center;font-weight:700;font-size:.82rem;color:var(--g4d-text);text-decoration:none;border-left:1.5px solid var(--g4d-border)}
.g4d-theme .g4d-slot--bottom-nav li:first-child a{border-left:0;color:var(--g4d-primary-contrast);background:var(--g4d-primary)}
.g4d-theme .g4d-slot--whatsapp-float{position:fixed;right:14px;bottom:78px;z-index:45;display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 18px;border-radius:999px;background:#157a3c;color:#fff;font-weight:700;font-size:.88rem;text-decoration:none;box-shadow:0 4px 12px rgba(0,0,0,.28)}
@media(min-width:900px){.g4d-theme .g4d-slot--bottom-nav{display:none}.g4d-theme .g4d-slot--whatsapp-float{bottom:22px}.g4d-theme{padding-bottom:0}}
.g4d-theme .g4d-slot--claim-banner{background:#fff3d6;color:#4a3200;text-align:center;font-size:.82rem}
.g4d-theme .g4d-slot--claim-banner a{color:#4a3200;display:inline-flex;align-items:center;min-height:32px}
.g4d-theme .g4d-slot--footer{background:var(--tp-deep);color:#e4ebf2;padding:36px 16px 24px;display:grid;gap:6px;justify-items:start}
.g4d-theme .g4d-slot--footer a,.g4d-theme .g4d-slot--listed-on-badge a,.g4d-theme .g4d-slot--share-qr a{color:#fff}
.g4d-theme .g4d-slot--listed-on-badge,.g4d-theme .g4d-slot--share-qr{background:var(--tp-deep);color:#e4ebf2;padding:6px 16px;font-size:.85rem}
.g4d-theme .g4d-slot--share-qr{padding-bottom:24px}
.g4d-theme .g4d-slot--enquiry-form form{display:grid;gap:14px;background:var(--g4d-surface);border:2px solid var(--tp-ink);border-radius:${k.card === 'soft' ? '22px' : '10px'};padding:22px;max-width:640px}
.g4d-theme .g4d-slot--enquiry-form h2{font-size:1.5rem}
.g4d-theme .g4d-slot--enquiry-form label{display:grid;gap:6px;font-weight:600;font-size:.9rem}
.g4d-theme .g4d-slot--enquiry-form :is(input:not([type=checkbox]),textarea){width:100%;min-height:48px;padding:10px 12px;border:1.5px solid var(--g4d-muted);border-radius:8px;font:400 1rem var(--g4d-font-body);background:var(--g4d-bg);color:var(--g4d-text)}
.g4d-theme .g4d-slot--enquiry-form textarea{min-height:110px}
.g4d-theme .g4d-slot--enquiry-form input[type=checkbox]{width:22px;height:22px;min-height:22px}
.g4d-theme .g4d-slot--enquiry-form button{min-height:48px;padding:0 22px;border-radius:${btnR};border:2px solid var(--g4d-accent);background:var(--g4d-accent);color:var(--tp-on-accent);font:700 .95rem var(--g4d-font-body);cursor:pointer;justify-self:start}
/* hero */
.g4d-theme .hero{position:relative;overflow:hidden;background:var(--tp-deep);color:#fff}
.g4d-theme .hero-art,.g4d-theme .hero-photo,.g4d-theme .hero-shade,.g4d-theme .scene{display:block}
.g4d-theme .hero-photo{width:100%;height:100%;object-fit:cover}
.g4d-theme .hero-shade{position:absolute;inset:0}
.g4d-theme .scene{position:absolute;inset:0}
.g4d-theme .scene svg{width:100%;height:100%}
.g4d-theme .hero-grid{position:relative;z-index:2}
.g4d-theme .hero-eyebrow{font:700 .78rem/1.3 var(--g4d-font-body);letter-spacing:.14em;text-transform:uppercase;color:var(--tp-warm);margin-bottom:12px}
.g4d-theme .hero h1{color:#fff;max-width:20ch}
.g4d-theme .hero--center h1{max-width:26ch;margin-inline:auto}
.g4d-theme .hero .lede{color:#dbe5ee;margin-top:14px}
.g4d-theme .hero-cta{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px;align-items:center}
.g4d-theme .hero .g4d-slot--open-now{color:#fff}
.g4d-theme .svc-row{margin-top:26px}
.g4d-theme .svc-label{font:700 .74rem/1.2 var(--g4d-font-body);letter-spacing:.12em;text-transform:uppercase;color:var(--tp-warm);margin-bottom:8px}
.g4d-theme .svc-links{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x proximity;padding-bottom:6px;margin-inline:-2px}
.g4d-theme .svc-links li{flex:0 0 auto;scroll-snap-align:start;max-width:78vw}
.g4d-theme .svc-links a{display:inline-flex;align-items:center;min-height:44px;padding:6px 16px;border-radius:999px;border:1.5px solid rgba(255,255,255,.7);color:#fff;text-decoration:none;font-weight:600;font-size:.88rem;background:rgba(0,0,0,.28)}
@media(min-width:900px){.g4d-theme .svc-links{flex-wrap:wrap;overflow:visible}}
${heroCss}
/* sections */
.g4d-theme .section{padding:56px 0}
.g4d-theme .section--white{background:var(--g4d-surface)}
.g4d-theme .section--tint{background:var(--tp-tint)}
.g4d-theme .section--band{background:var(--tp-deep);color:#e4ebf2}
.g4d-theme .section--band h2{color:#fff}.g4d-theme .section--band .lede{color:#cdd9e4}.g4d-theme .section--band .btn{border-color:#fff;color:#fff}.g4d-theme .section--band .btn--go{border-color:var(--g4d-accent)}
.g4d-theme .sec-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:28px}
.g4d-theme .sec-head small{color:var(--g4d-muted);font-weight:700}
${orn}
.g4d-theme .split{display:grid;gap:28px}
@media(min-width:900px){.g4d-theme .split{grid-template-columns:1fr 1fr;gap:56px;align-items:start}}
.g4d-theme .trust{padding:0;background:var(--tp-tint);border-bottom:1.5px solid var(--g4d-border)}
.g4d-theme .trust-strip{display:flex;flex-wrap:wrap;gap:6px 22px;padding:14px 0}
.g4d-theme .trust-strip li{font-weight:700;font-size:.9rem;display:flex;align-items:center;min-height:32px}
.g4d-theme .trust-strip li::before{content:"";width:9px;height:9px;margin-right:9px;background:var(--g4d-accent);transform:rotate(45deg);flex:none}
.g4d-theme .tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));gap:14px}
.g4d-theme .tile{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:4px 14px;padding:16px;min-height:84px;background:var(--g4d-surface);border:1.5px solid var(--g4d-border);border-radius:var(--g4d-radius);text-decoration:none;color:var(--g4d-text)}
.g4d-theme .tile-ic{grid-row:span 2;width:48px;height:48px;border-radius:12px;background:var(--tp-tint) center/60% no-repeat}
.g4d-theme .tile b{font:700 1.05rem/1.2 var(--g4d-font-heading)}.g4d-theme .tile small{color:var(--g4d-muted)}
/* cards */
.g4d-theme .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,290px),1fr));gap:22px}
.g4d-theme .card{display:flex;flex-direction:column;min-width:0}
.g4d-theme .card-art{position:relative;aspect-ratio:16/10;background:var(--tp-tint) center/cover no-repeat;display:block}
.g4d-theme .card-art img{width:100%;height:100%;object-fit:cover}
.g4d-theme .badge{position:absolute;left:12px;top:12px;z-index:2;background:var(--g4d-accent);color:var(--tp-on-accent);font:700 .74rem/1 var(--g4d-font-body);letter-spacing:.06em;text-transform:uppercase;padding:7px 10px;border-radius:4px}
.g4d-theme .badge--hero{position:static;display:inline-block;margin-bottom:12px}
.g4d-theme .card-body{display:flex;flex-direction:column;gap:10px;padding:18px;flex:1}
.g4d-theme .card h3 a{color:var(--g4d-text);text-decoration:none;display:inline-block;min-height:0}
.g4d-theme .card-desc{color:var(--g4d-muted);font-size:.94rem}
.g4d-theme .meta{display:flex;flex-wrap:wrap;gap:6px 14px;color:var(--g4d-muted);font-size:.85rem;font-weight:600}
.g4d-theme .card-foot{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin-top:auto;padding-top:6px}
.g4d-theme .price{font:700 1.15rem/1.2 var(--g4d-font-heading);color:var(--g4d-primary)}
${cardCss}
/* blocks, steps, stats, creds */
.g4d-theme .blocks{display:grid;gap:40px}
.g4d-theme .stones{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,230px),1fr));gap:14px}
.g4d-theme .stone{background:var(--g4d-surface);border:1.5px solid var(--g4d-border);border-radius:var(--g4d-radius);overflow:hidden}
.g4d-theme .stone .top{background:var(--g4d-primary);color:var(--g4d-primary-contrast);padding:12px 16px;font:700 1rem/1.25 var(--g4d-font-heading)}
.g4d-theme .stone .body{display:grid;gap:4px;padding:14px 16px;color:var(--g4d-muted);font-size:.9rem}.g4d-theme .stone .body span{font-weight:700;color:var(--g4d-primary)}
.g4d-theme .steps{display:grid;gap:22px;counter-reset:s}
@media(min-width:760px){.g4d-theme .steps{grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}}
.g4d-theme .steps li{display:grid;gap:8px;align-content:start}
.g4d-theme .steps .n{display:grid;place-items:center;width:46px;height:46px;border-radius:50%;background:var(--g4d-primary);color:var(--g4d-primary-contrast)}.g4d-theme .steps .n i{font:700 1.05rem/1 var(--g4d-font-heading);font-style:normal}
.g4d-theme .steps p{color:var(--g4d-muted);font-size:.94rem}
.g4d-theme .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:18px;text-align:center}
.g4d-theme .stats b{display:block;font:700 2.2rem/1.1 var(--g4d-font-heading);color:var(--g4d-primary)}.g4d-theme .stats span{color:var(--g4d-muted);font-weight:600}
.g4d-theme .creds{display:grid;gap:10px}
.g4d-theme .creds li{display:grid;gap:2px;padding:12px 16px;border-left:4px solid var(--g4d-accent);background:rgba(255,255,255,.08)}
.g4d-theme .creds span{opacity:.9;font-size:.92rem}
.g4d-theme .creds--cols{margin-top:22px}.g4d-theme .creds--cols li{background:var(--tp-tint);color:var(--g4d-text)}
.g4d-theme .offers{display:grid;gap:10px;margin-top:14px}
.g4d-theme .offers li{display:flex;justify-content:space-between;gap:12px;padding:12px 16px;background:rgba(255,255,255,.08);border-radius:8px}
.g4d-theme .offers span{font-size:.9rem}.g4d-theme .offers .p{font-weight:700;color:var(--tp-warm)}
.g4d-theme .team{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr));gap:16px}
.g4d-theme .member{display:flex;gap:14px;align-items:center;padding:16px;border:1.5px solid var(--g4d-border);border-radius:var(--g4d-radius);background:var(--g4d-bg)}
.g4d-theme .avatar{flex:none;display:grid;place-items:center;width:52px;height:52px;border-radius:50%;background:var(--g4d-primary);color:var(--g4d-primary-contrast);font:700 1.2rem/1 var(--g4d-font-heading)}
.g4d-theme .member div{display:grid;gap:2px;min-width:0}.g4d-theme .member span,.g4d-theme .member small{color:var(--g4d-muted);font-size:.88rem}
.g4d-theme .gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,230px),1fr));gap:12px}
.g4d-theme .gal figure{margin:0;display:grid;gap:6px}.g4d-theme .gal img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:var(--g4d-radius)}.g4d-theme .gal figcaption{font-size:.84rem;color:var(--g4d-muted)}
.g4d-theme .chips{display:flex;flex-wrap:wrap;gap:8px}.g4d-theme .chips li{padding:8px 16px;border:1.5px solid var(--g4d-border);border-radius:999px;font-weight:600;background:var(--g4d-bg)}
.g4d-theme .why{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.g4d-theme .why li{padding:14px 16px;border-left:4px solid var(--g4d-accent);background:var(--tp-tint);font-weight:600}
.g4d-theme .faq{display:grid;gap:10px}
.g4d-theme .faq details{background:var(--g4d-surface);border:1.5px solid var(--g4d-border);border-radius:10px;padding:0 16px}
.g4d-theme .faq summary{display:flex;align-items:center;cursor:pointer;font-weight:700;min-height:52px}
.g4d-theme .faq details p{padding:0 0 16px;color:var(--g4d-muted)}
.g4d-theme .contact-list{display:grid;gap:12px;margin-bottom:16px}.g4d-theme .contact-list li{display:grid;gap:2px}.g4d-theme address{font-style:normal}
.g4d-theme .form-wrap{margin-top:28px}
.g4d-theme .cta-band{background:var(--g4d-accent);color:var(--tp-on-accent);padding:40px 0}
.g4d-theme .cta-band .wrap{display:flex;flex-wrap:wrap;gap:18px;align-items:center;justify-content:space-between}
.g4d-theme .cta-band h2{color:var(--tp-on-accent)}.g4d-theme .cta-band .btn{border-color:var(--tp-on-accent);color:var(--tp-on-accent)}.g4d-theme .cta-band .btn--go{background:var(--tp-on-accent);color:var(--g4d-accent);border-color:var(--tp-on-accent)}
.g4d-theme .cta-actions{display:flex;flex-wrap:wrap;gap:10px}
/* inner pages and the item landing page */
.g4d-theme .page-hero{background:var(--tp-deep);color:#fff;padding:40px 0 34px}
.g4d-theme .page-hero h1{color:#fff;max-width:24ch}.g4d-theme .page-hero p{margin-top:12px;color:#d6e1ec;max-width:60ch}
.g4d-theme .crumbs{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px;font-size:.88rem}.g4d-theme .crumbs a{color:#fff;display:inline-flex;align-items:center}
.g4d-theme .jump{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:28px}.g4d-theme .jump a{display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border-radius:999px;border:1.5px solid var(--g4d-primary);text-decoration:none;font-weight:700}
.g4d-theme .group{margin-bottom:44px}
.g4d-theme .detail-grid{display:grid;gap:30px}
@media(min-width:900px){.g4d-theme .detail-grid{grid-template-columns:1.5fr 1fr;gap:48px;align-items:start}.g4d-theme .aside-card{position:sticky;top:84px}}
.g4d-theme .detail-main{display:grid;gap:30px;min-width:0}
.g4d-theme .detail-img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:var(--g4d-radius)}
.g4d-theme .detail-main h2{font-size:1.5rem;margin-bottom:12px}
.g4d-theme .facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1px;background:var(--g4d-border);border:1.5px solid var(--g4d-border);border-radius:var(--g4d-radius);overflow:hidden}
.g4d-theme .facts div{background:var(--g4d-surface);padding:14px 16px;display:grid;gap:2px}.g4d-theme .facts dt{font:700 .74rem/1.2 var(--g4d-font-body);letter-spacing:.1em;text-transform:uppercase;color:var(--g4d-muted)}.g4d-theme .facts dd{margin:0;font-weight:700}
.g4d-theme .aside-card{background:var(--g4d-surface);border:2px solid var(--tp-ink);border-radius:${k.card === 'soft' ? '22px' : '10px'};padding:20px;display:grid;gap:12px;align-self:start}
.g4d-theme .aside-label{font:700 .74rem/1.2 var(--g4d-font-body);letter-spacing:.12em;text-transform:uppercase;color:var(--g4d-muted)}
.g4d-theme .aside-card .price{font-size:1.7rem}.g4d-theme .note{color:var(--g4d-muted)}
.g4d-theme .prose p+p{margin-top:12px}
.g4d-theme .vh{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip-path:inset(50%)}
.g4d-theme .gal--item{grid-template-columns:repeat(auto-fill,minmax(min(100%,200px),1fr))}
${spec.slides ? `.g4d-theme .section--slides{padding:56px 0 48px;background:var(--g4d-bg)}
.g4d-theme .slides{display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;padding:4px max(16px,calc((100% - 1160px) / 2)) 18px;scroll-padding-inline:max(16px,calc((100% - 1160px) / 2))}
.g4d-theme .slide{flex:0 0 min(86%,520px);scroll-snap-align:start}
.g4d-theme .slide-link{position:relative;display:block;border-radius:var(--g4d-radius);overflow:hidden;background:var(--tp-deep);color:#fff;text-decoration:none;min-height:0}
.g4d-theme .slide-art{display:block;aspect-ratio:16/10}.g4d-theme .slide-art img{width:100%;height:100%;object-fit:cover}
.g4d-theme .slide-copy{position:absolute;inset:auto 0 0 0;display:grid;gap:4px;padding:56px 18px 16px;background:linear-gradient(0deg,rgba(6,16,26,.92),rgba(6,16,26,0))}
.g4d-theme .slide-copy b{font:700 1.25rem/1.2 var(--g4d-font-heading)}.g4d-theme .slide-copy .price{color:var(--tp-warm)}.g4d-theme .slide-copy .badge{position:static;justify-self:start}
@media(min-width:1000px){.g4d-theme .slide{flex-basis:calc((100% - 2 * 16px) / 3 - 20px)}}` : ''}
${spec.extraCss ?? ''}
`;
}

export function motionCss(spec) {
  return `/* Motion: transform and opacity only. Off and reduced motion are static. */
${spec.motionCss ?? ''}
@media (prefers-reduced-motion: reduce){
${spec.motionReduce ?? ''}
}
`;
}

export function printCss(spec) {
  return `@media print{
  .g4d-theme{background:#fff;color:#000;padding-bottom:0}
  .g4d-theme .g4d-slot--bottom-nav,.g4d-theme .g4d-slot--whatsapp-float,.g4d-theme .g4d-slot--share-qr,.g4d-theme .g4d-slot--header-nav,.g4d-theme .g4d-slot--enquiry-form,.g4d-theme .g4d-slot--booking,.g4d-theme .scene,.g4d-theme .hero-art,.g4d-theme .svc-row{display:none}
  .g4d-theme .site-header,.g4d-theme .hero,.g4d-theme .section,.g4d-theme .page-hero{background:#fff;color:#000;padding:8px 0}
  .g4d-theme .hero h1,.g4d-theme .page-hero h1{color:#000}
  .g4d-theme a{color:#000;text-decoration:none}
  .g4d-theme .card,.g4d-theme .stone{border:1px solid #000;box-shadow:none}
}
`;
}
