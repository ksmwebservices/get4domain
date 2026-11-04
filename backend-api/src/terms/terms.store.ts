import { AuditEntry } from '../vendor-lifecycle/lifecycle.store';
import { PublishedRef, TermsKind, TermsStatus } from './core/terms-core';

export interface TermsDocRow {
  id: string; kind: TermsKind; version: number; title: string; status: TermsStatus; bodyMarkdown: string; changeNote: string | null;
  publishedAt: Date | null; publishedBy: string | null; createdBy: string | null; createdAt: Date; updatedAt: Date;
}
export interface AcceptanceRow { id: string; vendorId: string | null; customerRequestId: string | null; userId: string | null; documentId: string; kind: TermsKind; version: number; acceptedAt: Date }
export interface NewAcceptances { vendorId: string; userId: string | null; docs: readonly PublishedRef[]; ipHash: string | null; userAgentHash: string | null; now: Date; audit: AuditEntry }

/**
 * Everything slice 5.15 stores or reads behind one port (Prisma implementation, in-memory twin for the unit tests). A mutating method writes its audit row in the SAME transaction.
 * There is NO method that updates or deletes an acceptance: that is the API-level half of the immutability rule (the database trigger is the other half).
 */
export abstract class TermsStore {
  abstract listDocuments(f: { kind?: TermsKind; status?: TermsStatus }): Promise<TermsDocRow[]>;
  abstract getDocument(id: string): Promise<TermsDocRow | null>;
  abstract latestPublished(kind: TermsKind): Promise<TermsDocRow | null>;
  abstract latestPublishedMany(kinds: readonly TermsKind[]): Promise<TermsDocRow[]>;
  /** PUBLISHED and RETIRED versions of a kind, newest first. Drafts are never listed here. */
  abstract publicVersions(kind: TermsKind): Promise<TermsDocRow[]>;
  /** The next version number is taken inside the same unit of work as the insert. */
  abstract createDraft(d: { kind: TermsKind; title: string; bodyMarkdown: string; createdBy: string | null }, audit: AuditEntry): Promise<TermsDocRow>;
  /** Only a DRAFT changes; returns null when the document is missing or not a draft. */
  abstract updateDraft(id: string, d: { title?: string; bodyMarkdown?: string }, audit: AuditEntry): Promise<TermsDocRow | null>;
  /** DRAFT to PUBLISHED, and the previously published version of that kind to RETIRED, in one transaction. Returns null when the document is missing or not a draft. */
  abstract publish(id: string, d: { by: string | null; now: Date; changeNote: string }, audit: AuditEntry): Promise<TermsDocRow | null>;
  abstract acceptedDocumentIds(vendorId: string, documentIds: readonly string[]): Promise<Set<string>>;
  /** Appends acceptance rows (a document already accepted by this vendor is skipped) and returns how many were new. */
  abstract recordAcceptances(a: NewAcceptances): Promise<number>;
  abstract listAcceptances(vendorId: string): Promise<AcceptanceRow[]>;
  /** The idempotent seed: one DRAFT version 1 per kind that has no row at all. Returns the kinds created. */
  abstract seedMissingDrafts(kinds: readonly TermsKind[], body: string): Promise<TermsKind[]>;
}
