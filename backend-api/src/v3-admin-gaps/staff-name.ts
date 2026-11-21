import { PrismaService } from '../prisma/prisma.service';

/** The staff member's name as written in the staff list (or the bootstrap admin's name), else the email they signed in with. Read only. */
export async function staffDisplayName(prisma: Pick<PrismaService, 'adminTeamMember' | 'vendor'> | undefined, user: { sub?: string; email?: string } | undefined): Promise<string> {
  const id = user?.sub;
  if (prisma && id) {
    const m = await prisma.adminTeamMember.findUnique({ where: { id }, select: { name: true } }).catch(() => null);
    if (m?.name) return m.name;
    const v = await prisma.vendor.findUnique({ where: { id }, select: { name: true } }).catch(() => null);
    if (v?.name) return v.name;
  }
  return user?.email ?? 'staff';
}
