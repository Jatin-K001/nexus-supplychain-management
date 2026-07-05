import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';

interface StockRequest {
  id: string; material_id: string; material_name: string; quantity: string;
  subphase_name: string; urgency: string; status: string;
}

const URGENCY_BADGE: Record<string, string> = { high: 'danger', medium: 'warning', low: 'pending' };
const URGENCY_LABEL: Record<string, string> = { high: 'Urgent', medium: 'This Week', low: 'Low' };

export function ProcurementStockRequestsInbox() {
  const { data: requests } = useQuery<StockRequest[]>({ queryKey: ['stock-requests'], queryFn: () => api.get('/api/stock-requests') });
  // §6 step 4: still-open, PM-approved requests only — sourced/fulfilled ones
  // move to Active Orders instead of staying in this inbox.
  const open = (requests ?? []).filter((r) => r.status === 'approved');

  return (
    <div>
      <div className="header-row">
        <div>
          <div className="section-title">Stock Requests</div>
          <div className="section-sub">PM-APPROVED ONLY · RAW SUPERVISOR ALERTS NEVER APPEAR HERE</div>
        </div>
      </div>
      <Card>
        <table className="data-table">
          <thead><tr><th>Material</th><th>Qty Needed</th><th>Requested For</th><th>Urgency</th><th></th></tr></thead>
          <tbody>
            {open.map((r) => (
              <tr key={r.id}>
                <td className="td-name">{r.material_name}</td>
                <td className="td-mono">{r.quantity}</td>
                <td className="td-sub">{r.subphase_name}</td>
                <td><span className={`badge badge-${URGENCY_BADGE[r.urgency]}`}>{URGENCY_LABEL[r.urgency]}</span></td>
                <td>
                  <Link to={`/procurement/vendors/discover/${r.id}`}>
                    <Button size="sm" variant="teal">Find Vendor →</Button>
                  </Link>
                </td>
              </tr>
            ))}
            {open.length === 0 && (
              <tr><td colSpan={5}><EmptyState icon="✅" title="Queue is clear" subtitle="No PM-approved stock requests need sourcing right now." /></td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
