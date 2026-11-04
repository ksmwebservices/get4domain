/** Masked forms for display and storage of contact details we must not show in clear (slice 5.7). */
export function maskPhone(e164: string): string {
  const s = String(e164 ?? '').replace(/\s/g, '');
  if (!/^\+\d{8,15}$/.test(s)) return '';
  return `${s.slice(0, 3)}${'•'.repeat(s.length - 6)}${s.slice(-3)}`;
}

export function maskEmail(email: string): string {
  const m = /^([^@\s])[^@\s]*@([^@\s]+\.[^@\s]+)$/.exec(String(email ?? '').trim());
  return m ? `${m[1]}•••@${m[2]}` : '';
}
