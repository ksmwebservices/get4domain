import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

export interface LoginResult {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    businessName: string;
    industry: string | null;
    subdomain: string | null;
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

    if (!vendor) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (vendor.status === 'SUSPENDED') {
      throw new UnauthorizedException('This account has been suspended');
    }

    const passwordMatches = await bcrypt.compare(dto.password, vendor.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = this.signToken({ sub: vendor.id, email: vendor.email, role: vendor.role });

    return {
      accessToken,
      user: {
        id: vendor.id,
        name: vendor.name,
        email: vendor.email,
        role: vendor.role,
        businessName: vendor.businessName,
        industry: vendor.industry,
        subdomain: vendor.subdomain,
      },
    };
  }

  refresh(user: AuthenticatedUser): { accessToken: string } {
    const accessToken = this.signToken({ sub: user.sub, email: user.email, role: user.role });
    return { accessToken };
  }

  private signToken(payload: { sub: string; email: string; role: string }): string {
    return this.jwtService.sign(payload, { expiresIn: '7d' });
  }

  static async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 10);
  }
}
