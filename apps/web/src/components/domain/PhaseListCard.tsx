import { Link } from 'react-router-dom';
import { Card } from '../ui/Card';

export interface PhaseRow {
  id: string;
  template_phase_no: number;
  name: string;
  unlock_type: string;
  status: string;
}

const UNLOCK_LABEL: Record<string, string> = {
  sequential: 'Sequential', parallel: 'Parallel + Merge', merge: 'Parallel + Merge', independent: 'Independent',
};

function statusBadge(status: string) {
  if (status === 'complete') return <span className="badge badge-complete">Complete</span>;
  if (status === 'in_progress') return <span className="badge badge-progress">In Progress</span>;
  return <span className="badge badge-locked">Locked</span>;
}

// Shared by PM·04 (read-only), SUP·03 (own project, "this is you" highlight),
// and SUP·09 (clickable step in the Log Consumption drilldown) — same 10-row
// list and lock states everywhere per §3.3.
export function PhaseListCard({
  phases, linkTo, highlightInProgress = false, disableLocked = false,
}: {
  phases: PhaseRow[];
  linkTo?: (phase: PhaseRow) => string;
  highlightInProgress?: boolean;
  disableLocked?: boolean;
}) {
  return (
    <Card>
      <div style={{ padding: '0 20px' }}>
        {phases.map((phase) => {
          const isLocked = phase.status === 'locked';
          const clickable = linkTo && !(disableLocked && isLocked);
          const content = (
            <div
              className="phase-row"
              style={{
                opacity: isLocked ? 0.5 : 1,
                ...(highlightInProgress && phase.status === 'in_progress'
                  ? { background: 'var(--accent-fill)', margin: '0 -20px', padding: '12px 20px', borderRadius: 8 }
                  : {}),
              }}
            >
              <div className="phase-num-badge" style={highlightInProgress && phase.status === 'in_progress' ? { background: 'var(--accent)' } : undefined}>
                {phase.template_phase_no}
              </div>
              <div style={{ flex: 1 }}>
                <div className="td-name">{phase.name}</div>
                <div className="td-sub">{UNLOCK_LABEL[phase.unlock_type] ?? phase.unlock_type}</div>
              </div>
              {statusBadge(phase.status)}
            </div>
          );
          return clickable ? (
            <Link key={phase.id} to={linkTo!(phase)} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
              {content}
            </Link>
          ) : (
            <div key={phase.id}>{content}</div>
          );
        })}
      </div>
    </Card>
  );
}
