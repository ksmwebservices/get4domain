/**
 * Tenant model for V3 code. A tenant is a Vendor (D2 working assumption): `vendorId` is the tenant key on every
 * business table. These types are opt-in building blocks; no existing controller is changed to use them.
 */
export type TenantActor =
  | 'owner'        // the vendor's own login
  | 'team_member'  // an invited member of that vendor (JWT `sub` is the parent vendorId)
  | 'sandbox'      // an expired-after-N-days demo vendor
  | 'staff';       // Get4Domain staff explicitly acting on one vendor (never implicit)

export interface TenantContext {
  /** The tenant key. Always taken from the verified principal (or an explicit, staff-only argument), never from the request body/query. */
  vendorId: string;
  actor: TenantActor;
  /** Present for team members: the member's own id (for audit). */
  memberId?: string;
}
