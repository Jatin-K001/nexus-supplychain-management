import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { StatCard } from '../../components/ui/StatCard';
import { Card, CardPad, CardTitle } from '../../components/ui/Card';
import { Note, NoteText } from '../../components/ui/Note';
import { Button } from '../../components/ui/Button';

interface RiskSummary {
  at_risk_material_count: number;
  delayed_phase_count: number;
  avg_vendor_reliability: number | null;
  estimated_delay_cost: number;
}

interface StockRequest {
  id: string;
  status: string;
  material_name: string;
  quantity: string;
  subphase_name: string;
  project_name: string;
  created_at: string;
}

interface Project {
  id: string;
  status: string;
}

export function PmDashboard() {
  const queryClient = useQueryClient();

  const { data: risk } = useQuery<RiskSummary>({
    queryKey: ['risk-summary'],
    queryFn: () => api.get('/api/dashboard/risk-summary'),
  });

  const { data: requests } = useQuery<StockRequest[]>({
    queryKey: ['stock-requests'],
    queryFn: () => api.get('/api/stock-requests'),
  });

  const { data: projects } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => api.get('/api/projects'),
  });

  const pending = (requests ?? []).filter((r) => r.status === 'pending_pm_approval');
  const activeProjects = (projects ?? []).filter((p) => p.status !== 'completed');

  const approve = async (id: string) => {
    await api.post(`/api/stock-requests/${id}/approve`);
    queryClient.invalidateQueries({ queryKey: ['stock-requests'] });
  };
  const dismiss = async (id: string) => {
    await api.post(`/api/stock-requests/${id}/dismiss`);
    queryClient.invalidateQueries({ queryKey: ['stock-requests'] });
  };

  return (
    <div>
      <div className="header-row">
        <div>
          <div className="section-title">Project Impact Command Center</div>
          <div className="section-sub">MODEL STATUS: LIVE</div>
        </div>
      </div>

      <div className="stat-cards">
        <StatCard label="ACTIVE PROJECTS" value={projects ? activeProjects.length : '—'} tone="accent" sub="Currently in progress" />
        <StatCard label="DELAYED PHASES" value={risk?.delayed_phase_count ?? '—'} tone="warning" sub="Across all active projects" />
        <StatCard label="AVG VENDOR RELIABILITY" value={risk?.avg_vendor_reliability ?? '—'} tone="success" sub="Live weighted score" />
        <StatCard
          label="PENDING APPROVALS"
          value={requests ? pending.length : '—'}
          tone={pending.length > 0 ? 'danger' : 'success'}
          sub="Stock requests awaiting your decision"
        />
      </div>

      {pending.map((r) => (
        <Note tone="danger" key={r.id}>
          <NoteText tone="danger" bold>
            STOCK ALERT · {r.project_name} · {r.subphase_name}
          </NoteText>
          <NoteText tone="danger">
            {r.material_name} ({r.quantity}) requested — awaiting your approval.
          </NoteText>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Button variant="ghost" size="sm" onClick={() => dismiss(r.id)}>Dismiss</Button>
            <Button variant="danger" size="sm" onClick={() => approve(r.id)}>Approve Stock Request →</Button>
          </div>
        </Note>
      ))}

      <Card>
        <CardPad>
          <CardTitle>Stock Requests — All</CardTitle>
          <table className="data-table">
            <thead>
              <tr><th>Material</th><th>Qty</th><th>Project</th><th>Status</th></tr>
            </thead>
            <tbody>
              {(requests ?? []).map((r) => (
                <tr key={r.id}>
                  <td className="td-name">{r.material_name}</td>
                  <td className="td-mono">{r.quantity}</td>
                  <td className="td-sub">{r.project_name}</td>
                  <td><span className={`badge badge-${r.status === 'pending_pm_approval' ? 'warning' : 'pending'}`}>{r.status.replace(/_/g, ' ')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardPad>
      </Card>
    </div>
  );
}
