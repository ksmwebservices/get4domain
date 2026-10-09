import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SocialAccount } from '@prisma/client';
import { decryptSecret, encryptSecret } from '../platform-settings/crypto.util';
import { PrismaService } from '../prisma/prisma.service';
import { SocialChannel } from './social-provider';

export const CHANNELS: SocialChannel[] = ['FACEBOOK_PAGE', 'INSTAGRAM', 'TELEGRAM', 'GOOGLE_BUSINESS'];

/** An account as the screens see it: the token itself is never sent anywhere, only whether one is saved. */
export type PublicAccount = Omit<SocialAccount, 'tokenEnc'> & { hasToken: boolean };

export interface AccountInput {
  id?: string; ownerType: 'PLATFORM' | 'VENDOR'; vendorId?: string | null; channel: SocialChannel; name: string; externalId?: string | null;
  theme?: string | null; city?: string | null; category?: string | null; token?: string | null; dailyCap?: number; status?: string;
}

const pub = (a: SocialAccount): PublicAccount => { const { tokenEnc, ...rest } = a; return { ...rest, hasToken: Boolean(tokenEnc) }; };

/** Connected social accounts: Get4Domain's own Pages and channels (themed by city and trade) and, once a vendor grants access, a vendor's own. Tokens are encrypted at rest. */
@Injectable()
export class SocialAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: { ownerType?: string; vendorId?: string; channel?: string } = {}): Promise<PublicAccount[]> {
    const rows = await this.prisma.socialAccount.findMany({ where: { ...(filter.ownerType ? { ownerType: filter.ownerType } : {}), ...(filter.vendorId ? { vendorId: filter.vendorId } : {}), ...(filter.channel ? { channel: filter.channel } : {}) }, orderBy: [{ ownerType: 'asc' }, { channel: 'asc' }, { name: 'asc' }], take: 300 });
    return rows.map(pub);
  }

  async get(id: string): Promise<SocialAccount> {
    const a = await this.prisma.socialAccount.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('We could not find that account.');
    return a;
  }

  token(a: SocialAccount): string | null {
    if (!a.tokenEnc) return null;
    try { return decryptSecret(a.tokenEnc); } catch { return null; }
  }

  async save(input: AccountInput): Promise<PublicAccount> {
    if (!CHANNELS.includes(input.channel)) throw new BadRequestException('Choose Facebook Page, Instagram, Telegram or Google Business Profile.');
    if (input.ownerType === 'VENDOR' && !input.vendorId) throw new BadRequestException('A vendor account needs a vendor.');
    const data: Prisma.SocialAccountUncheckedCreateInput = {
      ownerType: input.ownerType, vendorId: input.ownerType === 'VENDOR' ? input.vendorId ?? null : null, channel: input.channel, name: input.name.trim().slice(0, 80),
      externalId: input.externalId?.trim().slice(0, 120) || null, theme: input.theme?.trim().slice(0, 80) || null, city: input.city?.trim().slice(0, 60) || null, category: input.category?.trim().slice(0, 60) || null,
      dailyCap: input.dailyCap ?? 3, status: input.status ?? 'SANDBOX',
    };
    if (!data.name) throw new BadRequestException('Give the account a name.');
    if (input.token !== undefined && input.token !== null && input.token !== '') {
      data.tokenEnc = encryptSecret(input.token.trim());
      if (!input.status) data.status = 'AWAITING_APPROVAL';
    }
    if (input.id) {
      await this.get(input.id);
      const { ownerType: _o, ...rest } = data; void _o;
      return pub(await this.prisma.socialAccount.update({ where: { id: input.id }, data: rest }));
    }
    return pub(await this.prisma.socialAccount.create({ data }));
  }

  /** Disconnecting removes the saved token and stops posting; the account row and its post history stay. */
  async disconnect(id: string): Promise<PublicAccount> {
    await this.get(id);
    return pub(await this.prisma.socialAccount.update({ where: { id }, data: { tokenEnc: null, status: 'DISCONNECTED' } }));
  }

  async setStatus(id: string, status: string, lastError: string | null = null): Promise<PublicAccount> {
    return pub(await this.prisma.socialAccount.update({ where: { id }, data: { status, lastError, lastSyncAt: new Date() } }));
  }
}
