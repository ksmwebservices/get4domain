import { cache } from 'react';
import { fetchPageModel } from './api';

/** One request per path per render: generateMetadata and the page share this result. */
export const getPageModel = cache((path: string) => fetchPageModel(path));

const SEGMENT = /^[A-Za-z0-9-]{1,80}$/;

/**
 * The URL segments of the catch-all to a directory path, or null when they cannot be a directory address
 * (so a bad address is a 404 without a backend call). The backend decides everything else.
 */
export function pathFromSegments(segments: string[] | undefined): string | null {
  const parts = segments ?? [];
  if (parts.length === 0 || parts.length > 5) return null;
  if (!parts.every((p) => SEGMENT.test(p))) return null;
  return `/${parts.join('/')}`;
}
