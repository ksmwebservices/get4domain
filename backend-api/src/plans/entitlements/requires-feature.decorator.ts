import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { FeatureGuard } from './feature.guard';

export const REQUIRES_FEATURE = 'plans:requires-feature';

/**
 * `@RequiresFeature('site.video')` on a vendor route: the caller's plan (entitlements) must give that feature, otherwise 403 with the stable
 * code FEATURE_LOCKED and the upsell text. The module using it must import PlansModule. For counted limits call EntitlementsService.assertWithinLimit.
 */
export const RequiresFeature = (key: string): MethodDecorator & ClassDecorator =>
  applyDecorators(SetMetadata(REQUIRES_FEATURE, { key }), UseGuards(FeatureGuard));
