import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { AdminTeamMember } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { WhatsAppService } from '../notifications/whatsapp.service';
import { InviteAdminDto } from './dto/invite-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { AcceptAdminInviteDto } from './dto/accept-admin-invite.dto';

// Never leak password/inviteToken back to the client.
type SafeAdminMember = Omit<AdminTeamMember, 'password' | 'inviteToken'>;

@Injectable()
export class AdminTeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly whatsappService: WhatsAppService,
  ) {}

  private toSafe(member: AdminTeamMember): SafeAdminMember {
    const { password: _password, inviteToken: _inviteToken, ...safe } = member;
    return safe;
  }

  async invite(dto: InviteAdminDto): Promise<SafeAdminMember> {
    const existing = await this.prisma.adminTeamMember.findUnique({ where: { email: dto.email } });
    if (existing && existing.status !== 'removed') {
      throw new BadRequestException('A team member with this email already exists');
    }

    const inviteToken = crypto.randomBytes(24).toString('hex');
    const member = existing
      ? await this.prisma.adminTeamMember.update({
          where: { id: existing.id },
          data: { name: dto.name, phone: dto.phone, role: dto.role, status: 'invited', inviteToken, password: null },
        })
      : await this.prisma.adminTeamMember.create({
          data: { name: dto.name, email: dto.email, phone: dto.phone, role: dto.role, status: 'invited', inviteToken },
        });

    await this.emailService.sendAdminTeamInvite(member);
    if (dto.phone) {
      await this.whatsappService.sendTemplate(dto.phone, 'team_invite', [dto.name, 'Get4Domain']);
    }

    return this.toSafe(member);
  }

  async findMembers(): Promise<SafeAdminMember[]> {
    const members = await this.prisma.adminTeamMember.findMany({
      where: { status: { not: 'removed' } },
      orderBy: { createdAt: 'desc' },
    });
    return members.map((m) => this.toSafe(m));
  }

  async update(id: string, dto: UpdateAdminDto): Promise<SafeAdminMember> {
    const member = await this.prisma.adminTeamMember.findUnique({ where: { id } });
    if (!member) throw new NotFoundException('Team member not found');
    const updated = await this.prisma.adminTeamMember.update({
      where: { id },
      data: { role: dto.role ?? member.role, status: dto.status ?? member.status },
    });
    return this.toSafe(updated);
  }

  async remove(id: string): Promise<SafeAdminMember> {
    const member = await this.prisma.adminTeamMember.findUnique({ where: { id } });
    if (!member) throw new NotFoundException('Team member not found');
    const updated = await this.prisma.adminTeamMember.update({ where: { id }, data: { status: 'removed', inviteToken: null } });
    return this.toSafe(updated);
  }

  async acceptInvite(dto: AcceptAdminInviteDto): Promise<{ success: true }> {
    const member = await this.prisma.adminTeamMember.findFirst({ where: { inviteToken: dto.inviteToken, status: 'invited' } });
    if (!member) throw new BadRequestException('Invalid or expired invite');

    const hashed = await bcrypt.hash(dto.password, 10);
    await this.prisma.adminTeamMember.update({
      where: { id: member.id },
      data: { password: hashed, status: 'active', inviteToken: null },
    });

    return { success: true };
  }
}
