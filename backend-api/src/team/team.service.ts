import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { TeamMember } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { WhatsAppService } from '../notifications/whatsapp.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { EntitlementsService } from '../bos/entitlements.service';

/** A team member as returned to clients — never the password hash or invite token. */
export type SafeTeamMember = Omit<TeamMember, 'password' | 'inviteToken'>;

function toSafe(member: TeamMember): SafeTeamMember {
  const { password: _password, inviteToken: _inviteToken, ...safe } = member;
  return safe;
}

@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly whatsappService: WhatsAppService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async invite(vendorId: string, dto: InviteMemberDto): Promise<SafeTeamMember> {
    // The plan decides how many people can be added; people already added are never removed when a plan changes.
    const seats = await this.entitlements.limit(vendorId, 'bos.staff', 'seats');
    if (seats !== null) {
      const used = await this.prisma.teamMember.count({ where: { vendorId, status: { not: 'removed' } } });
      if (used >= seats) {
        const e = await this.entitlements.resolve(vendorId);
        throw new ForbiddenException({
          message: `Your ${e.planName} plan includes ${seats} team ${seats === 1 ? 'member' : 'members'}, and you have ${used}. Upgrade your plan to add more people. Everyone already added keeps their access.`,
          code: 'LIMIT_REACHED', feature: 'bos.staff',
        });
      }
    }
    const inviteToken = crypto.randomBytes(24).toString('hex');
    const member = await this.prisma.teamMember.create({
      data: {
        vendorId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        role: dto.role,
        department: dto.department,
        modules: dto.modules,
        status: 'invited',
        inviteToken,
      },
    });

    const vendor = await this.prisma.vendor.findUniqueOrThrow({ where: { id: vendorId } });
    await this.emailService.sendTeamInvite(member, vendor);
    if (dto.phone) {
      await this.whatsappService.sendTemplate(dto.phone, 'team_invite', [dto.name, vendor.businessName]);
    }

    return toSafe(member);
  }

  async findMembers(vendorId: string): Promise<SafeTeamMember[]> {
    const members = await this.prisma.teamMember.findMany({ where: { vendorId, status: { not: 'removed' } }, orderBy: { createdAt: 'desc' } });
    return members.map(toSafe);
  }

  /** Internal ownership lookup — returns the full row (with credentials); never return it to a client. */
  private async findOne(id: string, vendorId: string): Promise<TeamMember> {
    const member = await this.prisma.teamMember.findUnique({ where: { id } });
    if (!member) throw new NotFoundException('Team member not found');
    if (member.vendorId !== vendorId) throw new ForbiddenException('You do not manage this team member');
    return member;
  }

  async update(id: string, vendorId: string, dto: UpdateMemberDto): Promise<SafeTeamMember> {
    await this.findOne(id, vendorId);
    return toSafe(await this.prisma.teamMember.update({ where: { id }, data: { role: dto.role, modules: dto.modules } }));
  }

  async remove(id: string, vendorId: string): Promise<SafeTeamMember> {
    await this.findOne(id, vendorId);
    return toSafe(await this.prisma.teamMember.update({ where: { id }, data: { status: 'removed' } }));
  }

  async acceptInvite(dto: AcceptInviteDto): Promise<{ success: true }> {
    const member = await this.prisma.teamMember.findFirst({ where: { inviteToken: dto.inviteToken, status: 'invited' } });
    if (!member) throw new BadRequestException('Invalid or expired invite');

    const hashed = await bcrypt.hash(dto.password, 10);
    await this.prisma.teamMember.update({
      where: { id: member.id },
      data: { password: hashed, status: 'active', inviteToken: null },
    });

    return { success: true };
  }

  async activity(vendorId: string): Promise<Array<{ id: string; name: string; role: string; status: string; lastLogin: Date | null }>> {
    const members = await this.prisma.teamMember.findMany({
      where: { vendorId, status: { not: 'removed' } },
      orderBy: { lastLogin: 'desc' },
    });
    return members.map((m) => ({ id: m.id, name: m.name, role: m.role, status: m.status, lastLogin: m.lastLogin }));
  }
}
