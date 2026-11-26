import { staffRoleOf } from '../../auth/guards/staff-access';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { StaffRef } from '../act-on-behalf/act-on-behalf.service';

/** The signed-in staff member as the act-on-behalf rules see them. A principal with no staff role gets an empty one: AdminGuard has already refused it. */
export const staffOf = (user: AuthenticatedUser): StaffRef => ({ id: user.sub, role: staffRoleOf(user) ?? '', label: user.staffLabel ?? null });
