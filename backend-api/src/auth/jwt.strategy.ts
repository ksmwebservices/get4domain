import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  adminRole?: string;
  kind?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET as string,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    // Standalone internal-staff principal (invited Marketing/Operations members).
    if (payload.kind === 'admin_member') {
      const member = await this.prisma.adminTeamMember.findUnique({ where: { id: payload.sub } });
      if (!member || member.status !== 'active') {
        throw new UnauthorizedException('Account not found or removed');
      }
      return { sub: member.id, email: member.email, role: 'ADMIN', adminRole: member.role, kind: 'admin_member' };
    }

    const vendor = await this.prisma.vendor.findUnique({ where: { id: payload.sub } });

    if (!vendor || vendor.status === 'SUSPENDED') {
      throw new UnauthorizedException('Account not found or suspended');
    }

    // The bootstrap admin Vendor is treated as SUPER_ADMIN internal staff.
    const isAdmin = vendor.role === 'ADMIN' || vendor.role === 'SUPER_ADMIN';
    return {
      sub: vendor.id,
      email: vendor.email,
      role: vendor.role,
      adminRole: isAdmin ? 'SUPER_ADMIN' : undefined,
    };
  }
}
