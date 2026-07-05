import { ReactNode } from 'react';
import { Card } from '../ui/Card';

export interface SubphaseRow {
  id: string;
  sequence: number;
  name: string;
  status: string;
  actual_end: string | null;
  delay_days: number;
}

function fmtDate(d: string | null) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export function defaultBadge(sub: SubphaseRow) {
  if (sub.status === 'complete') {
    const early = sub.delay_days === 0 && sub.actual_end ? '' : '';
    return <span className="badge badge-complete">Complete{early} · {fmtDate(sub.actual_end)}</span>;
  }
  if (sub.status === 'in_progress') return <span className="badge badge-progress">Active</span>;
  if (sub.status === 'available') return <span className="badge badge-pending">Available</span>;
  return <span className="badge badge-locked">Locked</span>;
}

// Shared list shell for PM·05 (read-only), SUP·04 (Start/End actions),
// SUP·10 (stock-assignment status) — same 10-row subphase list, different
// trailing content per row via `renderTrailing`.
export function SubphaseListCard({
  subphases, renderTrailing, onRowClick,
}: {
  subphases: SubphaseRow[];
  renderTrailing?: (sub: SubphaseRow) => ReactNode;
  onRowClick?: (sub: SubphaseRow) => void;
}) {
  return (
    <Card>
      <div style={{ padding: '4px 20px' }}>
        {subphases.map((sub) => {
          const isLocked = sub.status === 'locked';
          const isActive = sub.status === 'in_progress' || sub.status === 'available';
          return (
            <div
              key={sub.id}
              className="subphase-row"
              onClick={onRowClick ? () => onRowClick(sub) : undefined}
              style={{
                opacity: isLocked ? 0.5 : 1,
                cursor: onRowClick ? 'pointer' : undefined,
                ...(isActive ? { background: 'var(--accent-fill)', margin: '0 -20px', padding: '10px 20px' } : {}),
              }}
            >
              <span className="sub-num">{String(sub.sequence).padStart(2, '0')}</span>
              <span className="sub-name">{sub.name}</span>
              {renderTrailing ? renderTrailing(sub) : defaultBadge(sub)}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
