/**
 * The second half of the Free site draft in "renderer" mode (docs/v3/V3_S4_RENDERER_PUBLISH.md section 9): after the legacy VendorCMS draft exists, create the
 * site settings with the category's default Standard theme and build a DRAFT_PREVIEW publication. It NEVER publishes. The implementation lives next to the
 * renderer (RendererDraftBuilder); provisioning only knows this port.
 */
export interface PrepareDraftInput { vendorId: string; category: string; track?: string; language: string; city?: string }

export abstract class DraftSiteBuilder {
  abstract prepare(input: PrepareDraftInput): Promise<{ publicationId: string }>;
}
