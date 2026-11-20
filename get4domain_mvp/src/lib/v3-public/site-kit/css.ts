import type { Imagery } from './packs';
import { TYPE_SCALE, type KitTheme } from './themes';

/** The CSS variables of a theme, from its manifest colours, its cssVars and its type style. Applied inline on the site's root element. */
export function themeVars(theme: KitTheme): Record<string, string> {
  const ts = TYPE_SCALE[theme.design.type];
  const r = ts.ratio;
  const c = theme.colors;
  return {
    '--k-bg': c.bg, '--k-fg': c.fg, '--k-muted': c.muted, '--k-accent': c.accent, '--k-accent-fg': c.accentFg,
    '--k-surface': theme.cssVars['--g4d-surface'] ?? c.bg, '--k-border': theme.cssVars['--g4d-border'] ?? c.muted, '--k-soft': theme.cssVars['--g4d-soft'] ?? c.bg,
    '--k-radius': theme.cssVars['--g4d-radius'] ?? '12px',
    '--k-head': ts.head, '--k-body': ts.body, '--k-hw': String(ts.headWeight), '--k-track': ts.headTracking, '--k-tf': ts.headTransform,
    '--k-s1': `${(r).toFixed(3)}rem`, '--k-s2': `${(r ** 2).toFixed(3)}rem`, '--k-s3': `${(r ** 3).toFixed(3)}rem`, '--k-s4': `${(r ** 4).toFixed(3)}rem`,
  };
}

const esc = (s: string): string => s.replace(/[<>&"]/g, '');
/** Neutral hero art in the theme's colours, drawn per image style (plates, portraits, products, ...). No photograph and no claim: shapes only. A data address, so it needs no file. */
export function heroArt(imagery: Imagery, accent: string, soft: string): string {
  const a = esc(accent); const s = esc(soft);
  const shapes: Record<Imagery, string> = {
    plates: `<circle cx="330" cy="200" r="130" fill="${a}" opacity=".9"/><circle cx="330" cy="200" r="95" fill="${s}"/><circle cx="330" cy="200" r="52" fill="${a}" opacity=".55"/><circle cx="130" cy="260" r="70" fill="${a}" opacity=".35"/><circle cx="130" cy="260" r="42" fill="${s}"/>`,
    portraits: `<circle cx="300" cy="140" r="62" fill="${a}"/><path d="M170 360c0-82 58-132 130-132s130 50 130 132z" fill="${a}" opacity=".85"/><circle cx="120" cy="120" r="34" fill="${a}" opacity=".35"/><rect x="60" y="250" width="110" height="14" rx="7" fill="${a}" opacity=".35"/>`,
    products: `<rect x="90" y="120" width="130" height="150" rx="14" fill="${a}"/><rect x="250" y="80" width="130" height="190" rx="14" fill="${a}" opacity=".7"/><rect x="410" y="150" width="110" height="120" rx="14" fill="${a}" opacity=".45"/><rect x="60" y="292" width="500" height="10" rx="5" fill="${a}" opacity=".3"/>`,
    trips: `<path d="M0 300 L130 150 L220 240 L330 90 L470 270 L600 180 L600 400 L0 400z" fill="${a}" opacity=".85"/><path d="M0 340 L160 230 L300 320 L450 210 L600 300 L600 400 L0 400z" fill="${a}" opacity=".5"/><circle cx="470" cy="90" r="38" fill="${s}"/>`,
    tools: `<rect x="120" y="170" width="360" height="26" rx="13" fill="${a}" transform="rotate(-24 300 183)"/><circle cx="170" cy="260" r="46" fill="none" stroke="${a}" stroke-width="22"/><rect x="330" y="230" width="150" height="26" rx="13" fill="${a}" opacity=".5" transform="rotate(24 405 243)"/>`,
    work: `<rect x="70" y="70" width="190" height="140" rx="4" fill="${a}"/><rect x="280" y="70" width="140" height="140" rx="4" fill="${a}" opacity=".55"/><rect x="440" y="70" width="100" height="230" rx="4" fill="${a}" opacity=".8"/><rect x="70" y="230" width="350" height="70" rx="4" fill="${a}" opacity=".35"/>`,
    homes: `<path d="M120 300V180L250 90l130 90v120z" fill="${a}"/><rect x="225" y="220" width="50" height="80" fill="${s}"/><path d="M400 300V210l80-55 80 55v90z" fill="${a}" opacity=".5"/><rect x="40" y="300" width="540" height="10" fill="${a}" opacity=".3"/>`,
    classes: `<rect x="90" y="110" width="250" height="170" rx="10" fill="${a}"/><rect x="115" y="140" width="130" height="12" rx="6" fill="${s}"/><rect x="115" y="170" width="190" height="12" rx="6" fill="${s}" opacity=".7"/><rect x="115" y="200" width="100" height="12" rx="6" fill="${s}" opacity=".7"/><circle cx="440" cy="190" r="70" fill="${a}" opacity=".5"/><path d="M400 190l40-30 40 30-40 30z" fill="${s}"/>`,
  };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420" preserveAspectRatio="xMidYMid slice"><rect width="640" height="420" fill="${s}"/><circle cx="560" cy="40" r="150" fill="${a}" opacity=".12"/><circle cx="40" cy="400" r="130" fill="${a}" opacity=".1"/>${shapes[imagery]}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** The kit's stylesheet. One sheet for every theme: the theme's variables and the data-* switches on the root element change the layout, type and colour. Scoped to .sk. */
export const KIT_CSS = `
.sk{--k-gap:clamp(1rem,3vw,1.5rem);font-family:var(--k-body);color:var(--k-fg);background:var(--k-bg);line-height:1.6;min-height:100vh;padding-bottom:calc(72px + env(safe-area-inset-bottom,0px));-webkit-text-size-adjust:100%}
.sk *,.sk *::before,.sk *::after{box-sizing:border-box}
.sk img{max-width:100%;display:block}
.sk a{color:inherit}
.sk h1,.sk h2,.sk h3{color:inherit;font-family:var(--k-head);font-weight:var(--k-hw);letter-spacing:var(--k-track);text-transform:var(--k-tf);line-height:1.15;margin:0}
.sk h1{font-size:clamp(1.9rem,6vw,var(--k-s4))}
.sk h2{font-size:clamp(1.4rem,4vw,var(--k-s3))}
.sk h3{font-size:var(--k-s1)}
.sk p{margin:0}
.sk-wrap{max-width:68rem;margin:0 auto;padding:0 1rem}
.sk-eyebrow{font-size:.8rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--k-accent)}
.sk-muted{color:var(--k-muted)}
.sk-sec{padding:clamp(2rem,6vw,3.5rem) 0;scroll-margin-top:4.5rem}
.sk-sec>.sk-wrap>h2{margin-bottom:1.25rem}
.sk-btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;min-height:48px;padding:.7rem 1.4rem;border-radius:calc(var(--k-radius) + 2px);background:var(--k-accent);color:var(--k-accent-fg);font-weight:700;text-decoration:none;border:2px solid var(--k-accent);font-size:1rem}
.sk-btn.alt{background:transparent;color:var(--k-accent);border-color:var(--k-accent)}
.sk-top{position:sticky;top:0;z-index:30;background:var(--k-bg);border-bottom:1px solid var(--k-border)}
.sk-top .sk-wrap{display:flex;align-items:center;gap:1rem;min-height:56px}
.sk-brand{display:flex;align-items:center;gap:.6rem;font-family:var(--k-head);font-weight:var(--k-hw);text-decoration:none;font-size:1.05rem;min-width:0}
.sk-brand span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sk-brand img{width:34px;height:34px;border-radius:8px;object-fit:contain}
.sk-dnav{display:none;margin-left:auto;gap:1.25rem;align-items:center}
.sk-dnav a{text-decoration:none;font-weight:600;font-size:.95rem;padding:.4rem 0}
.sk-dnav a:hover{color:var(--k-accent)}
.sk-bnav{position:fixed;left:0;right:0;bottom:0;z-index:40;display:flex;background:var(--k-bg);border-top:1px solid var(--k-border);padding-bottom:env(safe-area-inset-bottom,0px);box-shadow:0 -4px 18px rgba(0,0,0,.07)}
.sk-bnav a{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:60px;font-size:.72rem;font-weight:600;text-decoration:none;color:var(--k-muted)}
.sk-bnav a svg{width:22px;height:22px}
.sk-bnav a.act{color:var(--k-accent)}
.sk-hero{position:relative}
.sk-hero h1{margin:.4rem 0 .6rem}
.sk-hero .sk-in>div{position:relative;z-index:1}
.sk-hero .sk-in>.sk-art{z-index:0}
.sk-hero .sk-sub{font-size:1.1rem;color:var(--k-muted);max-width:34rem}
.sk-hero .sk-acts{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:1.25rem}
.sk-hero .sk-art{border-radius:calc(var(--k-radius) + 6px);width:100%;aspect-ratio:3/2;object-fit:cover;background:var(--k-soft)}
.sk-hero .sk-in{display:grid;gap:1.5rem;padding:clamp(1.5rem,5vw,3rem) 1rem}
[data-hero=split] .sk-hero .sk-in{max-width:68rem;margin:0 auto}
[data-hero=centered] .sk-hero .sk-in{text-align:center;justify-items:center;max-width:56rem;margin:0 auto}
[data-hero=centered] .sk-hero .sk-sub{margin:0 auto}
[data-hero=centered] .sk-hero .sk-acts{justify-content:center}
[data-hero=centered] .sk-hero .sk-art{aspect-ratio:21/9}
[data-hero=fullbleed] .sk-hero{background:#0d1117;color:#fff;overflow:hidden}
[data-hero=fullbleed] .sk-hero .sk-art{position:absolute;inset:0;height:100%;aspect-ratio:auto;border-radius:0;opacity:.55}
[data-hero=fullbleed] .sk-hero .sk-in{position:relative;max-width:68rem;margin:0 auto;padding-top:clamp(3rem,12vw,7rem);padding-bottom:clamp(3rem,12vw,7rem)}
[data-hero=fullbleed] .sk-hero .sk-sub,[data-hero=fullbleed] .sk-hero .sk-eyebrow{color:#fff}
[data-hero=fullbleed] .sk-hero .sk-btn{background:#fff;color:#0d1117;border-color:#fff}
[data-hero=fullbleed] .sk-hero .sk-btn.alt{background:transparent;color:#fff}
[data-hero=overlap] .sk-hero{background:var(--k-soft);padding-bottom:3rem}
[data-hero=overlap] .sk-hero .sk-in{max-width:68rem;margin:0 auto}
[data-hero=overlap] .sk-hero .sk-art{box-shadow:0 18px 40px rgba(0,0,0,.18);margin-bottom:-4rem}
[data-hero=band] .sk-hero{background:var(--k-accent);color:var(--k-accent-fg)}
[data-hero=band] .sk-hero .sk-in{max-width:68rem;margin:0 auto}
[data-hero=band] .sk-hero .sk-sub,[data-hero=band] .sk-hero .sk-eyebrow{color:var(--k-accent-fg)}
[data-hero=band] .sk-hero .sk-btn{background:var(--k-accent-fg);color:var(--k-accent);border-color:var(--k-accent-fg)}
[data-hero=band] .sk-hero .sk-btn.alt{background:transparent;color:var(--k-accent-fg)}
[data-hero=band] .sk-hero .sk-art{aspect-ratio:16/9;max-height:18rem}
.sk-list{display:grid;gap:1rem;list-style:none;margin:0;padding:0}
.sk-card{background:var(--k-surface);border:1px solid var(--k-border);border-radius:var(--k-radius);overflow:hidden}
.sk-card .sk-pad{padding:1rem 1.1rem}
.sk-card img{width:100%;height:11rem;object-fit:cover}
.sk-price{font-weight:700;color:var(--k-accent)}
[data-services=cards] .sk-list,[data-services=products] .sk-list{grid-template-columns:repeat(auto-fill,minmax(15rem,1fr))}
[data-services=products] .sk-card img{height:13rem}
[data-services=rows] .sk-list{gap:0}
[data-services=rows] .sk-card{border:0;border-bottom:1px dashed var(--k-border);border-radius:0;background:transparent;display:grid;grid-template-columns:1fr auto;align-items:baseline}
[data-services=rows] .sk-card img{display:none}
[data-services=numbered] .sk-list{counter-reset:n}
[data-services=numbered] .sk-card{position:relative;padding-left:3.4rem;counter-increment:n}
[data-services=numbered] .sk-card::before{content:counter(n,decimal-leading-zero);position:absolute;left:1rem;top:1rem;font-family:var(--k-head);font-weight:var(--k-hw);font-size:1.4rem;color:var(--k-accent)}
[data-services=numbered] .sk-card img{display:none}
.sk-gal{display:grid;gap:.6rem}
.sk-gal img{width:100%;height:100%;object-fit:cover;border-radius:var(--k-radius);aspect-ratio:1/1}
[data-gallery=grid] .sk-gal{grid-template-columns:repeat(2,1fr)}
[data-gallery=strip] .sk-gal{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:.6rem;padding-bottom:.4rem}
[data-gallery=strip] .sk-gal img{flex:0 0 70%;aspect-ratio:4/3;scroll-snap-align:start}
[data-gallery=mosaic] .sk-gal{grid-template-columns:repeat(2,1fr);grid-auto-flow:dense}
[data-gallery=mosaic] .sk-gal img:nth-child(1){grid-column:span 2;aspect-ratio:16/9}
.sk-quote{margin:0;padding:1.1rem 1.2rem;background:var(--k-soft);border-radius:var(--k-radius);border-left:4px solid var(--k-accent)}
.sk-quote footer{margin-top:.5rem;font-size:.9rem;color:var(--k-muted)}
.sk details{border-bottom:1px solid var(--k-border);padding:.9rem 0}
.sk summary{cursor:pointer;font-weight:700;min-height:44px;display:flex;align-items:center}
.sk details p{margin-top:.4rem;color:var(--k-muted)}
.sk-pricing{width:100%;border-collapse:collapse}
.sk-pricing td{padding:.7rem 0;border-bottom:1px solid var(--k-border)}
.sk-pricing td:last-child{text-align:right;font-weight:700;color:var(--k-accent)}
.sk-find{display:grid;gap:.6rem;background:var(--k-surface);border:1px solid var(--k-border);border-radius:var(--k-radius);padding:1.2rem}
.sk-find dt{font-size:.8rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--k-muted)}
.sk-find dd{margin:0 0 .5rem}
.sk-foot{text-align:center;font-size:.75rem;color:var(--k-muted);padding:1.25rem 1rem 1.5rem}
.sk-flag{display:inline-block;font-size:.7rem;font-weight:700;padding:.1rem .5rem;border-radius:99px;background:var(--k-soft);color:var(--k-muted);margin-left:.5rem}
.sk-install{display:inline-flex;align-items:center;gap:.7rem;background:#0b0d12;color:#fff;border:1px solid #5f6672;border-radius:12px;padding:.45rem 1rem .45rem .8rem;min-height:48px;cursor:pointer;font-family:var(--k-body);text-align:left}
.sk-install svg{width:26px;height:26px;flex:none}
.sk-install small{display:block;font-size:.62rem;letter-spacing:.04em;opacity:.85;line-height:1.1}
.sk-install b{display:block;font-size:1.05rem;line-height:1.15}
.sk-sheet-bg{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:60;display:flex;align-items:flex-end}
.sk-sheet{background:#fff;color:#111827;width:100%;border-radius:18px 18px 0 0;padding:1.2rem 1.2rem calc(1.2rem + env(safe-area-inset-bottom,0px));max-height:80vh;overflow:auto}
.sk-sheet h3{font-family:var(--k-body);text-transform:none;letter-spacing:0;font-size:1.15rem}
.sk-sheet ol{margin:.8rem 0 1rem;padding-left:1.2rem}
.sk-sheet li{margin:.4rem 0}
.sk-sheet button{min-height:48px;width:100%;border-radius:12px;border:0;background:#111827;color:#fff;font-weight:700;font-size:1rem;cursor:pointer}
.sk-mobile-only{display:inline-flex}
@media(min-width:768px){
 .sk{padding-bottom:0}
 .sk-bnav{display:none}
 .sk-dnav{display:flex}
 .sk-mobile-only{display:none!important}
 [data-hero=split] .sk-hero .sk-in{grid-template-columns:1.1fr 1fr;align-items:center}
 [data-hero=band] .sk-hero .sk-in{grid-template-columns:1.2fr 1fr;align-items:center}
 [data-hero=overlap] .sk-hero .sk-in{grid-template-columns:1fr 1fr;align-items:center}
 [data-gallery=grid] .sk-gal{grid-template-columns:repeat(4,1fr)}
 [data-gallery=mosaic] .sk-gal{grid-template-columns:repeat(4,1fr)}
 [data-gallery=mosaic] .sk-gal img:nth-child(1){grid-column:span 2;grid-row:span 2;aspect-ratio:1/1}
 [data-gallery=strip] .sk-gal img{flex-basis:30%}
 .sk-list.two{grid-template-columns:1fr 1fr}
}
`;
