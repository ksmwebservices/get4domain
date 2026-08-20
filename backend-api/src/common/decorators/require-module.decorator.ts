import { SetMetadata } from '@nestjs/common';
import { TeamArea } from '../../team/team-access';

export const REQUIRE_MODULE_KEY = 'requireModule';

/**
 * Declares the team-access area a route/controller belongs to. Enforced by
 * ModuleGuard: a vendor's team member (kind==='team_member') may reach it only if
 * that area is in their granted `modules`. Vendors (owners) and admins are never
 * restricted by this — same style as @Public.
 */
export const RequireModule = (area: TeamArea) => SetMetadata(REQUIRE_MODULE_KEY, area);
