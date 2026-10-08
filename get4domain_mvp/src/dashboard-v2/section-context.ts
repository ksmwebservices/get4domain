'use client';

import { createContext, useContext } from 'react';

/**
 * Website Manager is one screen with tabs; Dashboard v2 offers it as three menu items (Content and pages, Design and themes,
 * Search and AI visibility). The hub tells the screen which section to show. `null` = the old behaviour (every tab).
 */
export type WebsiteSection = 'content' | 'design' | 'search' | null;
export const WebsiteSectionContext = createContext<WebsiteSection>(null);
export const useWebsiteSection = (): WebsiteSection => useContext(WebsiteSectionContext);

/** Which Website Manager tabs belong to which v2 menu item. */
export const WEBSITE_SECTION_TABS: Record<Exclude<WebsiteSection, null>, string[]> = {
  content: ['basic', 'about', 'portfolio'],
  design: ['branding', 'template'],
  search: ['seo'],
};
