import { DocKind, DocLine } from './core/doc-core';

export type SendStatus = 'NONE' | 'PENDING' | 'SENT_SANDBOX' | 'FAILED' | 'SKIPPED';
export interface TaxProfileRow { vendorId: string; gstRegistered: boolean; gstin: string | null; stateCode: string | null; legalName: string | null; address: string | null; compositionScheme: boolean; invoicePrefix: string }
export interface DocTax { taxablePaise: number; taxPaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; supply: 'INTRA' | 'INTER' }
export interface DocumentRow {
  id: string; vendorId: string; kind: DocKind; number: string; seq: number; periodKey: string; paymentId: string; customerSnapshot: Record<string, unknown>; items: DocLine[]; tax: DocTax; totalPaise: number;
  pdfRef: string | null; publicCode: string; whatsappStatus: SendStatus; emailStatus: SendStatus; resendCount: number; flags: Record<string, unknown>; createdAt: Date;
}
export interface NewDocument { vendorId: string; kind: DocKind; prefix: string; periodKey: string; paymentId: string; customerSnapshot: Record<string, unknown>; items: DocLine[]; tax: DocTax; totalPaise: number; publicCode: string; flags: Record<string, unknown> }
export interface OutboxEntry { vendorId: string | null; channel: string; templateKey: string; toHash: string; toMasked: string; payload: Record<string, unknown>; idempotencyKey: string }
export class DocCodeTaken extends Error {}

/**
 * Everything slice 5.17d stores, behind one port (Prisma implementation and an in-memory twin). Every vendor read and write carries the vendor id in its WHERE; the public document page finds
 * a row only by its unguessable code. `createDocument` takes the next number and writes the document in ONE transaction, so a failed write gives the number back (no gap), and a second call for
 * the same payment returns the first document (one document per payment).
 */
export abstract class DocumentsStore {
  abstract getProfile(vendorId: string): Promise<TaxProfileRow | null>;
  abstract saveProfile(p: TaxProfileRow): Promise<TaxProfileRow>;
  abstract createDocument(d: NewDocument): Promise<{ doc: DocumentRow; created: boolean }>;
  abstract byPayment(paymentId: string, vendorId: string): Promise<DocumentRow | null>;
  abstract byId(id: string, vendorId: string): Promise<DocumentRow | null>;
  abstract byCode(code: string): Promise<DocumentRow | null>;
  abstract list(vendorId: string, skip: number, take: number): Promise<{ items: DocumentRow[]; total: number }>;
  abstract setSend(id: string, vendorId: string, p: { whatsappStatus?: SendStatus; emailStatus?: SendStatus; pdfRef?: string; bumpResend?: boolean }): Promise<DocumentRow | null>;
  /** Idempotent by key: the same key twice stores one row and says created false. */
  abstract addOutbox(e: OutboxEntry): Promise<{ id: string; created: boolean }>;
  abstract setOutboxStatus(id: string, status: string): Promise<void>;
}
