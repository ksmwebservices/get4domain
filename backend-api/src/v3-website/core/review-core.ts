import { ManagedDoc, normaliseDoc } from './managed-doc';

/**
 * Free edits go to review (slice 5.5c, amendment 06), pure. A submission is DRAFT (the vendor's working copy; it lives in the draft table, so no row is stored in this state),
 * SUBMITTED (waiting for staff), APPROVED (live) or REJECTED (a reason is recorded; the old content stays live). A decided submission never changes again.
 */
export type SubmissionStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
export const SUBMISSION_STATUSES: readonly SubmissionStatus[] = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'];

const NEXT: Readonly<Record<SubmissionStatus, readonly SubmissionStatus[]>> = { DRAFT: ['SUBMITTED'], SUBMITTED: ['APPROVED', 'REJECTED'], APPROVED: [], REJECTED: [] };
export const canMove = (from: SubmissionStatus, to: SubmissionStatus): boolean => NEXT[from].includes(to);

/** A rejection needs a reason the vendor can read: 3 to 500 characters of plain text. Null when fine. */
export function reasonProblem(reason: unknown): string | null {
  if (typeof reason !== 'string') return 'A reason is required.';
  const r = reason.trim();
  if (r.length < 3) return 'Give the vendor a reason of at least 3 characters.';
  if (r.length > 500) return 'The reason can be at most 500 characters.';
  if (/[<>]/.test(r) || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(r)) return 'The reason must be plain text.';
  return null;
}

/** Every piece of text in a document, for the prohibited-term scan at submit time. */
export function textsOf(doc: ManagedDoc): string[] {
  const d = normaliseDoc(doc);
  return [
    ...Object.values(d.fields),
    ...Object.values(d.lists).flatMap((items) => (items ?? []).flatMap((it) => Object.values(it).filter((v): v is string => typeof v === 'string'))),
    ...d.navigation.header.map((n) => n.label), ...d.navigation.footer.map((n) => n.label),
  ].filter((t) => t.trim().length > 0);
}
