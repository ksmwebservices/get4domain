/** Opening hours text -> rows ("Mon to Sat, 9 am to 6 pm; Sun closed" becomes two rows). */
export function hoursRows(text: string | null | undefined): { label: string; value: string }[] {
  const parts = (text ?? '').split(/\n|;/).map((p) => p.trim()).filter(Boolean);
  const rows: { label: string; value: string }[] = [];
  for (const p of parts) {
    const m = p.match(/^([A-Za-z][A-Za-z .&-]{1,24}?)[:,\s]+(\d.*|closed.*|open.*|by appointment.*)$/i);
    rows.push(m ? { label: m[1].trim(), value: m[2].trim() } : { label: 'Hours', value: p });
  }
  return rows.slice(0, 8);
}
