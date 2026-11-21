import { ProvisioningSettings, renderTemplate } from '../settings/provisioning-settings';

/** First four characters and an ellipsis: enough for staff to tell two tokens apart, useless to an attacker. */
export const maskToken = (raw: string): string => `${raw.slice(0, 4)}…`;

/** Business names come from staff input: strip line breaks (header injection) and braces (template injection) before they are substituted. */
const safeName = (s: string): string => s.replace(/[\r\n\t\u0000-\u001f]+/g, ' ').replace(/[{}]/g, '').trim();

export interface RenderedInvite { subject: string; text: string; preview: string }

/** Subject and body from the owner-editable templates. `preview` is the same body with the token masked, the only form that is stored outside the sandbox body. */
export function renderInvite(settings: ProvisioningSettings, a: { businessName: string; rawToken: string }): RenderedInvite {
  const claimUrl = `${settings.publicAppUrl.replace(/\/+$/, '')}/claim/${a.rawToken}`;
  const vars = { businessName: safeName(a.businessName), claimUrl, expiryDays: String(settings.claimLinkExpiryDays) };
  const subject = renderTemplate(settings.inviteSubjectTemplate, { ...vars, claimUrl: '' }).replace(/[\r\n]+/g, ' ').trim();
  const text = renderTemplate(settings.inviteBodyTemplate, vars);
  return { subject, text, preview: text.split(a.rawToken).join(maskToken(a.rawToken)) };
}
