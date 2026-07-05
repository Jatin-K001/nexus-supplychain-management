import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';

interface Notification { id: string; type: string; message: string; read_at: string | null; created_at: string; }

const ICON: Record<string, string> = {
  stock_request: '📦', order_status: '📦', phase_unlock: '🔓', delay_logged: '⚠️', vendor_risk: '📉',
};
const ICON_BG: Record<string, string> = {
  stock_request: 'var(--warning-fill)', order_status: 'var(--teal-fill)', phase_unlock: 'var(--info-fill)',
  delay_logged: 'var(--danger-fill)', vendor_risk: 'var(--danger-fill)',
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / 3600000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Yesterday' : `${days}d`;
}

export function SupervisorAlerts() {
  const { data: notifications } = useQuery<Notification[]>({ queryKey: ['notifications'], queryFn: () => api.get('/api/notifications') });

  return (
    <div>
      <div className="section-title" style={{ marginBottom: 16 }}>Alerts</div>
      <Card>
        {(notifications ?? []).map((n, i) => (
          <div
            key={n.id}
            style={{
              display: 'flex', gap: 12, padding: '14px 18px',
              borderBottom: i < notifications!.length - 1 ? '1px solid var(--surface)' : undefined,
            }}
          >
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: ICON_BG[n.type] ?? 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {ICON[n.type] ?? '🔔'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--ff-body)', fontSize: 12.5, fontWeight: 600, color: n.read_at ? 'var(--text-2)' : 'var(--text)' }}>
                {n.message}
              </div>
            </div>
            <div className="td-sub">{timeAgo(n.created_at)}</div>
          </div>
        ))}
        {(!notifications || notifications.length === 0) && (
          <EmptyState icon="🔔" title="All quiet" subtitle="You'll see stock approvals, order updates, and unlocks here." />
        )}
      </Card>
    </div>
  );
}
