/**
 * SEO block slice 5: the embeddable "Listed on Get4Domain" badge. Pure. The picture is fixed text: it carries no business name, no number, no rating and no claim about rank, so nothing a
 * business or a visitor controls can end up inside the SVG, and it can never go stale. A badge is served only for a business that is currently listed.
 */
export const BADGE_TEXT = 'Listed on Get4Domain';
export const BADGE_WIDTH = 176;
export const BADGE_HEIGHT = 40;

export function badgeSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" viewBox="0 0 ${BADGE_WIDTH} ${BADGE_HEIGHT}" role="img" aria-label="${BADGE_TEXT}"><title>${BADGE_TEXT}</title><rect width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" rx="6" fill="#0f172a"/><text x="${BADGE_WIDTH / 2}" y="25" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="700" fill="#ffffff">${BADGE_TEXT}</text></svg>\n`;
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The snippet a business pastes into its own page: the badge image, linked to the business's profile on the directory. */
export function badgeEmbedHtml(o: { origin: string; apiBase: string; businessId: string; slug: string }): string {
  const img = `${o.apiBase.replace(/\/+$/, '')}/v3/directory/badge/${encodeURIComponent(o.businessId)}.svg`;
  return `<a href="${esc(`${o.origin}/business/${o.slug}`)}" rel="noopener"><img src="${esc(img)}" alt="${BADGE_TEXT}" width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}"></a>`;
}

/** The plain text link for a bio or a profile that cannot hold an image: "Find {name} on Get4Domain" and the profile address. The name is stored text: cut, one line, escaped in the HTML form. */
export function badgeTextLink(o: { origin: string; slug: string; name: string }): { label: string; url: string; plain: string; html: string } {
  const name = String(o.name ?? '').replace(/\s+/g, ' ').replace(/[<>]/g, '').trim().slice(0, 80);
  const url = `${o.origin}/business/${o.slug}`; const label = `Find ${name} on Get4Domain`;
  return { label, url, plain: `${label}: ${url}`, html: `<a href="${esc(url)}" rel="noopener">${esc(label)}</a>` };
}
