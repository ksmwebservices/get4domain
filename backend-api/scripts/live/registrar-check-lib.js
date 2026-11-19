'use strict';
/**
 * R1.3: the testable part of the registrar check. READ ONLY: one availability read at the registrar for a fixed name, after looking at which settings exist. Nothing here prints a key, a reseller id
 * or a connection string: the lines carry words, the mode, a date and the registrar's one word for the fixed name.
 */
const FIXED_NAME = 'get4domain-registrar-check';
const FIXED_TLD = 'com';

/** The registrar failure code to the state the check prints. */
const STATE_OF = {
  REGISTRAR_KEYS_MISSING: 'NOT_CONFIGURED', REGISTRAR_NOT_AUTHORISED: 'ACCESS_DENIED', REGISTRAR_BAD_KEYS: 'REJECTED', REGISTRAR_TIMEOUT: 'TIMEOUT',
  REGISTRAR_UNREACHABLE: 'UNREACHABLE', REGISTRAR_SERVER_ERROR: 'UNREACHABLE',
};
const MEANING = {
  NOT_CONFIGURED: 'No ResellerClub keys are saved (integration settings) or set in the server environment. Save them in the admin app first.',
  ACCESS_DENIED: 'ResellerClub refused the request ("Access Denied"). This machine\'s public IP address is most likely not whitelisted at ResellerClub yet. Whitelist it, then run this again.',
  REJECTED: 'ResellerClub did not accept the saved key or reseller id. Check them and save them again.',
  TIMEOUT: 'ResellerClub did not answer in time. Try again.',
  UNREACHABLE: 'ResellerClub could not be reached from this machine. Try again.',
  UNKNOWN: 'ResellerClub answered in a way that could not be understood.',
};

/**
 * `facts`: { status: the integration status of resellerclub (state, setAt, mode as a plain field), envKeys: boolean, flagOn: boolean }.
 * `search`: async (sld, tlds) => hits, already bound to the saved keys. Returns { lines, state, pass }.
 */
async function checkRegistrar({ facts, search }) {
  const lines = [];
  const saved = facts.status && facts.status.state === 'SET';
  const mode = saved ? (facts.status.fields.find((f) => f.field === 'mode') || {}).value || 'demo' : null;
  lines.push(`settings: ${saved ? `saved in the integration settings (mode ${mode}${facts.status.setAt ? `, saved ${new Date(facts.status.setAt).toISOString().slice(0, 10)}` : ''})` : 'nothing saved in the integration settings'}`);
  lines.push(`environment keys: ${facts.envKeys ? 'present' : 'absent'}${saved && facts.envKeys ? ' (the saved keys are used first)' : ''}`);
  lines.push(`domain-search switch (REGISTRAR_LIVE_SEARCH) in this environment: ${facts.flagOn ? 'ON' : 'off (this script does not need it; the app does)'}`);
  if (!saved && !facts.envKeys) return { lines: [...lines, `NOT_CONFIGURED: ${MEANING.NOT_CONFIGURED}`], state: 'NOT_CONFIGURED', pass: false };
  try {
    const hits = await search(FIXED_NAME, [FIXED_TLD]);
    const hit = hits.find((h) => String(h.domain).toLowerCase() === `${FIXED_NAME}.${FIXED_TLD}`);
    if (!hit) return { lines: [...lines, `UNKNOWN: ${MEANING.UNKNOWN}`], state: 'UNKNOWN', pass: false };
    return { lines: [...lines, `PASS: ResellerClub answered the availability read (one harmless call, nothing was bought or changed).`, `the fixed name ${FIXED_NAME}.${FIXED_TLD} is ${hit.status}`], state: 'PASS', pass: true };
  } catch (e) {
    const state = STATE_OF[e && e.code] || 'UNKNOWN';
    return { lines: [...lines, `${state}: ${MEANING[state]}`], state, pass: false };
  }
}

module.exports = { checkRegistrar, FIXED_NAME, FIXED_TLD, STATE_OF, MEANING };
