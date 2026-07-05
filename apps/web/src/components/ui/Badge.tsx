import { ReactNode } from 'react';

type BadgeKind =
  | 'complete' | 'progress' | 'locked' | 'pending' | 'danger' | 'warning' | 'teal'
  | 'sequential' | 'parallel' | 'merge' | 'independent';

export function Badge({ kind, children }: { kind: BadgeKind; children: ReactNode }) {
  return <span className={`badge badge-${kind}`}>{children}</span>;
}

// Maps a subphase/phase/request status straight to the matching badge look,
// so pages don't have to re-derive this mapping themselves.
const STATUS_KIND: Record<string, BadgeKind> = {
  complete: 'complete',
  fulfilled: 'complete',
  delivered: 'complete',
  in_progress: 'progress',
  available: 'pending',
  ordered: 'pending',
  approved: 'pending',
  sourced: 'teal',
  locked: 'locked',
  pending_pm_approval: 'warning',
  rejected: 'danger',
  delayed: 'danger',
};

export function StatusBadge({ status }: { status: string }) {
  const kind = STATUS_KIND[status] ?? 'locked';
  return <Badge kind={kind}>{status.replace(/_/g, ' ')}</Badge>;
}
