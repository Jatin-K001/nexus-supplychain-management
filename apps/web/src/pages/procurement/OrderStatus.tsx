import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { StepsRow } from '../../components/ui/StepsRow';
import { Note, NoteText } from '../../components/ui/Note';
import { Button } from '../../components/ui/Button';

interface PO {
  id: string; status: string; material_name: string; vendor_name: string; quantity: string;
  order_date: string; promised_date: string;
}

const STEPS = [{ label: 'Order Sent' }, { label: 'Vendor Accepts' }, { label: 'Log Delivery' }, { label: 'Complete' }];

export function ProcurementOrderStatus() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { data: po } = useQuery<PO>({ queryKey: ['po', orderId], queryFn: () => api.get(`/api/purchase-orders/${orderId}`) });

  if (!po) return null;
  const stepIndex = po.status === 'delivered' ? 3 : 2;

  return (
    <div>
      <div className="header-row">
        <div>
          <div className="section-title">Order #{po.id.slice(0, 8)}</div>
          <div className="section-sub">{po.material_name.toUpperCase()} · {po.quantity} · {po.vendor_name.toUpperCase()}</div>
        </div>
        <span className="badge badge-teal" style={{ fontSize: 11, padding: '6px 12px' }}>Auto-Accepted</span>
      </div>
      <StepsRow steps={STEPS} currentIndex={stepIndex} />

      <Note tone="success">
        <NoteText tone="success">
          <b>Promised delivery date set automatically:</b> {new Date(po.promised_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} — order placed{' '}
          {new Date(po.order_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} + {po.vendor_name}'s average lead time. No vendor login exists to confirm this manually, so the system computes it from history.
        </NoteText>
      </Note>
      <div style={{ marginTop: 10 }}>
        <Note tone="info">
          <NoteText tone="info">
            <b>No vendor user exists in this MVP</b> — every order auto-accepts immediately on send. Procurement moves straight to logging the delivery once it physically arrives.
          </NoteText>
        </Note>
      </div>
      {po.status !== 'delivered' && (
        <Button style={{ marginTop: 10 }} onClick={() => navigate(`/procurement/log-delivery?orderId=${po.id}`)}>Log Delivery →</Button>
      )}
    </div>
  );
}
