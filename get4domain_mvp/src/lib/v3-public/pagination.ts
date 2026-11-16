/** Up to five page numbers around the current one. */
export function windowOf(current: number, total: number): number[] {
  const size = Math.min(5, total);
  let start = Math.max(1, current - Math.floor(size / 2));
  if (start + size - 1 > total) start = total - size + 1;
  return Array.from({ length: size }, (_, i) => start + i);
}
