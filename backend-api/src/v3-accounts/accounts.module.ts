import { Module, Provider, Type } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DocumentsService } from '../v3-payments/documents.service';
import { PayRequestsModule } from '../v3-payments/payments.module';
import { MeAccountsController, MeItemsController } from './api/accounts.controllers';
import { AccountsService, DocumentSource } from './accounts.service';
import { AccountsStore } from './accounts.store';
import { PrismaAccountsStore } from './prisma-accounts.store';

/** Reads the business's own issued documents and tax profile through the exported payments service (slice 5.17d). Read only: it never writes to the payments tables. */
export const documentSourceFor = (docs: Pick<DocumentsService, 'list' | 'getProfile'>): DocumentSource => ({
  async listIssued(vendorId, skip, take) {
    const r = await docs.list(vendorId, skip, take);
    return { total: r.total, items: r.items.map((d) => ({ id: d.id, kind: d.kind, number: d.number, totalPaise: d.totalPaise, createdAt: d.createdAt, customerName: d.customerName, tax: d.tax })) };
  },
  async taxProfile(vendorId) { const p = await docs.getProfile(vendorId); return { gstRegistered: p.gstRegistered, compositionScheme: p.compositionScheme, gstin: p.gstin, stateCode: p.stateCode }; },
});

export const ACCOUNTS_PROVIDERS: Provider[] = [
  { provide: AccountsStore, useClass: PrismaAccountsStore },
  { provide: DocumentSource, useFactory: documentSourceFor, inject: [DocumentsService] },
  AccountsService,
];
export const ACCOUNTS_CONTROLLERS: Type<unknown>[] = [MeAccountsController, MeItemsController];

/** The accounts module (slice 5.23b). PlansModule (entitlements) and the tenant guard are global. */
@Module({ imports: [PrismaModule, PayRequestsModule], controllers: ACCOUNTS_CONTROLLERS, providers: ACCOUNTS_PROVIDERS, exports: [AccountsService] })
export class V3AccountsModule {}
