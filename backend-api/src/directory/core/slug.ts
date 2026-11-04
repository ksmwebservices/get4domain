/** Pure slug rules for directory businesses (slice 5.7). Total functions: odd input gives a safe answer, never an exception. */
const MAX = 60;

export function slugify(input: unknown): string {
  const s = String(input ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // café -> cafe
    .toLowerCase().replace(/['’`]/g, '-').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const cut = s.slice(0, MAX).replace(/-+$/g, '');
  return cut || 'business';
}

export function businessSlug(name: string, city?: string | null): string {
  const c = city ? slugify(city) : '';
  return slugify(c && c !== 'business' ? `${name} ${city}` : name);
}

/** The base when free, else base-2, base-3 ... (within the length cap). `isTaken` is the caller's lookup. If everything tried is taken, a random-looking tail from the base is added. */
export function uniqueSlug(base: string, isTaken: (slug: string) => boolean, maxTries = 200): string {
  const root = slugify(base);
  if (!isTaken(root)) return root;
  for (let n = 2; n <= maxTries; n++) {
    const tail = `-${n}`;
    const cand = `${root.slice(0, MAX - tail.length).replace(/-+$/g, '')}${tail}`;
    if (!isTaken(cand)) return cand;
  }
  let h = 5381; for (const ch of root) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0;   // deterministic tail: no clock, no randomness here
  const tail = `-${h.toString(36).padStart(6, '0')}${maxTries.toString(36)}`;
  return `${root.slice(0, MAX - tail.length).replace(/-+$/g, '')}${tail}`;
}
