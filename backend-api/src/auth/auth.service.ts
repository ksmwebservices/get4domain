import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { normalizeModules } from '../team/team-access';

export interface LoginResult {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    adminRole?: string;
    businessName: string;
    industry: string | null;
    subdomain: string | null;
    /** Present for a vendor team-member login. */
    kind?: string;
    memberId?: string;
    modules?: string[];
    department?: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResult> {
    const vendor = await this.prisma.vendor.findUnique({ where: { email: dto.email } });

    if (vendor) {
      if (vendor.status === 'SUSPENDED') {
        throw new UnauthorizedException('This account has been suspended');
      }

      const passwordMatches = await bcrypt.compare(dto.password, vendor.password);
      if (!passwordMatches) {
        throw new UnauthorizedException('Invalid email or password');
      }

      // Bootstrap admin Vendor (role ADMIN/SUPER_ADMIN) is full SUPER_ADMIN staff.
      const isAdmin = vendor.role === 'ADMIN' || vendor.role === 'SUPER_ADMIN';
      const adminRole = isAdmin ? 'SUPER_ADMIN' : undefined;
      const accessToken = this.signToken({ sub: vendor.id, email: vendor.email, role: vendor.role, adminRole });

      return {
        accessToken,
        user: {
          id: vendor.id,
          name: vendor.name,
          email: vendor.email,
          role: vendor.role,
          adminRole,
          businessName: vendor.businessName,
          industry: vendor.industry,
          subdomain: vendor.subdomain,
        },
      };
    }

    // Internal Get4Domain staff (invited Marketing/Operations members).
    const member = await this.prisma.adminTeamMember.findUnique({ where: { email: dto.email } });
    if (member && member.status === 'active' && member.password) {
      const memberPasswordMatches = await bcrypt.compare(dto.password, member.password);
      if (!memberPasswordMatches) {
        throw new UnauthorizedException('Invalid email or password');
      }

      await this.prisma.adminTeamMember.update({ where: { id: member.id }, data: { lastLogin: new Date() } });

      const accessToken = this.signToken({
        sub: member.id,
        email: member.email,
        role: 'ADMIN',
        adminRole: member.role,
        kind: 'admin_member',
      });

      return {
        accessToken,
        user: {
          id: member.id,
          name: member.name,
          email: member.email,
          role: 'ADMIN',
          adminRole: member.role,
          businessName: 'Get4Domain',
          industry: null,
          subdomain: null,
        },
      };
    }

    // A vendor's OWN team member (g4d_team_members). Tried LAST, only after Vendor
    // and AdminTeamMember both miss — so no existing account is ever intercepted.
    // The token's `sub` is the PARENT vendorId so every vendorId-scoped endpoint
    // works unchanged; the member's identity + access ride as separate claims.
    if (dto.email) {
      const teamMember = await this.prisma.teamMember.findFirst({
        where: { email: dto.email, status: 'active', password: { not: null } },
      });
      if (teamMember && teamMember.password) {
        const ok = await bcrypt.compare(dto.password, teamMember.password);
        if (!ok) throw new UnauthorizedException('Invalid email or password');

        const parent = await this.prisma.vendor.findUnique({ where: { id: teamMember.vendorId } });
        if (!parent || parent.status === 'SUSPENDED') {
          throw new UnauthorizedException('This account is unavailable');
        }

        await this.prisma.teamMember.update({ where: { id: teamMember.id }, data: { lastLogin: new Date() } });

        const modules = normalizeModules(teamMember.modules);
        const accessToken = this.signToken({
          sub: parent.id, email: teamMember.email ?? dto.email, role: 'VENDOR',
          kind: 'team_member', memberId: teamMember.id,
        });

        return {
          accessToken,
          user: {
            id: teamMember.id,               // the member's own identity
            name: teamMember.name,
            email: teamMember.email ?? dto.email,
            role: 'VENDOR',
            businessName: parent.businessName, // renders the vendor's business in the shell
            industry: parent.industry,
            subdomain: parent.subdomain,
            kind: 'team_member',
            memberId: teamMember.id,
            modules,
            department: teamMember.department ?? undefined,
          },
        };
      }
    }

    throw new UnauthorizedException('Invalid email or password');
  }

  refresh(user: AuthenticatedUser): { accessToken: string } {
    const accessToken = this.signToken({
      sub: user.sub,
      email: user.email,
      role: user.role,
      adminRole: user.adminRole,
      kind: user.kind,
      memberId: user.memberId,
    });
    return { accessToken };
  }

  private signToken(payload: {
    sub: string;
    email: string;
    role: string;
    adminRole?: string;
    kind?: string;
    memberId?: string;
  }): string {
    return this.jwtService.sign(payload, { expiresIn: '7d' });
  }

  /** Short-lived token for a Book-Demo sandbox vendor (Phase 4). Scoped to the
   *  sandbox vendorId; the dashboard reads it like any vendor token. */
  mintSandboxToken(vendorId: string, email: string): string {
    return this.jwtService.sign(
      { sub: vendorId, email, role: 'VENDOR', kind: 'sandbox' },
      { expiresIn: '48h' },
    );
  }

  /** Full vendor token issued after a sandbox converts to a real paid account (Phase 5). */
  mintVendorToken(vendorId: string, email: string): string {
    return this.signToken({ sub: vendorId, email, role: 'VENDOR' });
  }

  static async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 10);
  }
}
