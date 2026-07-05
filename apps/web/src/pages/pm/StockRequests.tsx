import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card, CardPad } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { useToast } from '../../lib/ToastContext';
import { useConfirm } from '../../lib/ConfirmContext';

interface StockRequest {
  id: string; status: string; material_name: string; quantity: string;
  subphase_name: string; project_name: string; urgency: string; created_at: string;
}

export function PmStockRequests() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data: requests } = useQuery<StockRequest[]>({ queryKey: ['stock-requests'], queryFn: () => api.get('/api/stock-requests') });
  const pending = (requests ?? []).filter((r) => r.status === 'pending_pm_approval');

  const approve = async (r: StockRequest) => {
    setBusyId(r.id);
    try {
      await api.post(`/api/stock-requests/${r.id}/approve`);
      queryClient.invalidateQueries({ queryKey: ['stock-requests'] });
      toast.success(`Approved — ${r.material_name} sent to Procurement.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve request');
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (r: StockRequest) => {
    const ok = await confirm({
      title: 'Reject stock request?',
      message: `This will reject the request for ${r.material_name} (${r.quantity}). The supervisor will need to raise it again if still needed.`,
      confirmLabel: 'Reject',
      tone: 'danger',
    });
    if (!ok) return;
    setBusyId(r.id);
    try {
      await api.post(`/api/stock-requests/${r.id}/dismiss`);
      queryClient.invalidateQueries({ queryKey: ['stock-requests'] });
      toast.info(`Rejected — ${r.material_name} request dismissed.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reject request');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="header-row">
        <div>
          <div className="section-title">Stock Requests</div>
          <div className="section-sub">RAISED BY SITE SUPERVISORS · AWAITING YOUR APPROVAL</div>
        </div>
      </div>

      {pending.length === 0 && (
        <Card><CardPad><EmptyState icon="📦" title="Nothing waiting" subtitle="No stock requests need your approval right now." /></CardPad></Card>
      )}

      {pending.map((r) => (
        <Card key={r.id} className="mb-4">
          <CardPad>
            <Badge kind="danger">AUTO-GENERATED</Badge>
            <div style={{ fontFamily: 'var(--ff-head)', fontSize: 15, fontWeight: 700, marginTop: 6 }}>
              {r.material_name} — {r.quantity}
            </div>
            <div className="td-sub" style={{ marginTop: 2 }}>Requested for: {r.subphase_name} · {r.project_name}</div>
            <div className="td-sub">Raised {new Date(r.created_at).toLocaleString()}</div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <Button variant="ghost" loading={busyId === r.id} onClick={() => reject(r)}>Reject</Button>
              <Button variant="success" loading={busyId === r.id} onClick={() => approve(r)}>Approve → Send to Procurement</Button>
            </div>
          </CardPad>
        </Card>
      ))}
    </div>
  );
}
