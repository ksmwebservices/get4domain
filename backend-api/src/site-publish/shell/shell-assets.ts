/**
 * The platform files of the app shell (S1 shell): the stylesheet for the request sheet, install button and chat drawer place, the small script that shows the install button, and the web app manifest.
 * The kit draws the HTML (themes/lib/render.mjs); a theme's own css styles the five-item bar. The sheet works with no script: the Request tab opens it by the address `#g4d-request`.
 */
export const SHELL_CSS = `
.g4d-sheet{display:none}
.g4d-sheet:target{display:flex;position:fixed;inset:0;z-index:60;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.55)}
.g4d-sheet__panel{box-sizing:border-box;width:100%;max-width:34rem;max-height:92vh;overflow:auto;padding:1.25rem 1.25rem 1.5rem;background:var(--g4d-pal-surface,#fff);color:var(--g4d-pal-text,#111);border-radius:1rem 1rem 0 0}
@media (min-width:40rem){.g4d-sheet:target{align-items:center}.g4d-sheet__panel{border-radius:1rem}}
.g4d-sheet__close{float:right;padding:.25rem .5rem;text-decoration:underline;color:inherit}
.g4d-sheet .g4d-form p{margin:0 0 .75rem}
.g4d-sheet .g4d-form label{display:block;margin-bottom:.25rem;font-weight:600}
.g4d-sheet .g4d-form input[type=text],.g4d-sheet .g4d-form input[type=tel],.g4d-sheet .g4d-form input[type=date],.g4d-sheet .g4d-form input[type=time],.g4d-sheet .g4d-form input[type=number],.g4d-sheet .g4d-form select,.g4d-sheet .g4d-form textarea{box-sizing:border-box;width:100%;font:inherit;padding:.65rem;border:1px solid rgba(0,0,0,.25);border-radius:.5rem;background:#fff;color:#111}
.g4d-sheet .g4d-form__consent label{display:inline;font-weight:400}
.g4d-install[hidden],.g4d-chat[hidden]{display:none}
.g4d-install:not([hidden]){position:fixed;right:1rem;bottom:5.25rem;z-index:40}
.g4d-chat:not([hidden]){position:fixed;right:1rem;bottom:5.25rem;z-index:40;width:min(22rem,calc(100vw - 2rem));max-height:60vh;overflow:auto;background:#fff;color:#111;border:1px solid rgba(0,0,0,.2);border-radius:.75rem;padding:1rem}
`.trim();

/** Shows the install button only when the browser says the site can be installed, and installs on a click. No other behaviour, no network calls, no storage. */
export const SHELL_JS = `(function(){var p=null;function box(){return document.querySelector('.g4d-install');}
addEventListener('beforeinstallprompt',function(e){e.preventDefault();p=e;var b=box();if(b)b.hidden=false;});
document.addEventListener('click',function(e){var t=e.target;if(p&&t&&t.closest&&t.closest('[data-g4d-install]')){p.prompt();p=null;var b=box();if(b)b.hidden=true;}});
addEventListener('appinstalled',function(){var b=box();if(b)b.hidden=true;});})();
`;

const HEX = /^#[0-9a-fA-F]{6}$/;
/** The web app manifest of a site: its name, start page, standalone display and, when the business has a logo, that picture as the icon. Everything is text the business wrote or a fixed value. */
export function manifestJson(o: { name: string; logo?: string | null; accent?: string | null }): string {
  const name = String(o.name ?? '').trim().slice(0, 80) || 'Website';
  const icon = o.logo && /^https:\/\//.test(o.logo) ? [{ src: o.logo, sizes: 'any', purpose: 'any' }] : [];
  return JSON.stringify({ name, short_name: name.slice(0, 24), start_url: '/', scope: '/', display: 'standalone', background_color: '#ffffff', ...(o.accent && HEX.test(o.accent) ? { theme_color: o.accent } : {}), ...(icon.length ? { icons: icon } : {}) });
}
