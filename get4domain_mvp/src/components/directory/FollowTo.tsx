'use client';

import { useEffect } from 'react';

/**
 * Sends the browser to `target` once the screen is shown (the screen keeps its own link for browsers that block it).
 * The caller has already made the address safe; nothing here decides what is allowed.
 */
export default function FollowTo({ target }: { target: string }): null {
  useEffect(() => { window.location.assign(target); }, [target]);
  return null;
}
