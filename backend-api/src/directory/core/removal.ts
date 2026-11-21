/** The removal request flow (slice 5.7): staff approve or reject a request, an approved one is executed. Nothing is ever hard-deleted in this slice. */
export type RemovalStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'EXECUTED';

const NEXT: Record<RemovalStatus, RemovalStatus[]> = { REQUESTED: ['APPROVED', 'REJECTED'], APPROVED: ['EXECUTED'], REJECTED: [], EXECUTED: [] };

export function nextRemovalStatuses(from: RemovalStatus): RemovalStatus[] { return [...(NEXT[from] ?? [])]; }
export function canTransitionRemoval(from: RemovalStatus, to: RemovalStatus): boolean { return (NEXT[from] ?? []).includes(to); }
