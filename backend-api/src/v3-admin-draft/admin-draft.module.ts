import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { V3ProfileFieldsModule } from '../v3-profile-fields/profile.module';
import { ActOnBehalfStore, PrismaActOnBehalfStore } from '../v3-website/act-on-behalf/act-on-behalf.store';
import { WebsiteModule } from '../v3-website/website.module';
import { AdminDraftController, AdminItemsController } from './admin-draft.controller';
import { AdminDraftService } from './admin-draft.service';

/** E9a: staff draft edits. It joins the website manager and the profile fields (which itself builds on the website manager), so it lives beside them rather than inside either. */
@Module({ imports: [PrismaModule, WebsiteModule, V3ProfileFieldsModule], controllers: [AdminDraftController, AdminItemsController], providers: [{ provide: ActOnBehalfStore, useClass: PrismaActOnBehalfStore }, AdminDraftService] })
export class AdminDraftModule {}
