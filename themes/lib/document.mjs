// Wraps renderPage() output into a complete HTML document for a browser (preview, screenshots, overflow checks).
// This is the PREVIEW shell only: the real platform writes its own <head> from the SEO fields. Pure function.
import { layoutCss } from './theme.mjs';

const escText = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
const escAttr = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');

export function cssFor(theme) {
  return [theme.css.tokens, theme.css.base, theme.css.motion, theme.css.print].filter(Boolean).join('\n');
}

/**
 * @param {{theme:object, rendered:{html:string,lang:string,seo?:object}, extraCss?:string, bodyClass?:string}} p
 */
export function pageDocument({ theme, rendered, extraCss = '' }) {
  const lang = rendered.lang?.slice(0, 2) === 'ta' ? 'ta' : 'en';
  const seo = rendered.seo ?? {};
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escText(seo.title ?? 'Preview')}</title>
<meta name="description" content="${escAttr(seo.description ?? '')}">
<style>html,body{margin:0}${extraCss}
${cssFor(theme)}</style>
</head>
<body>${rendered.html}</body>
</html>
`;
}

export { layoutCss };
