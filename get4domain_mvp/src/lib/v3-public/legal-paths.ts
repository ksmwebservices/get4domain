/**
 * The public addresses of the policy pages, kept apart from the texts so the middleware (host-routing.ts) does not bundle the legal text.
 * A test compares this list with the registry in legal-docs.ts, so a page cannot be added in one place only.
 *
 * `/terms`, `/privacy-policy` and `/refund-policy` are also paths of the live site: they are replaced by the new pages only while the flag and MAIN_HOST are on.
 */
export const LEGAL_PAGE_PATHS: readonly string[] = ['/disclaimer'];
