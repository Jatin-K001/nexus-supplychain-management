import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Card, CardPad } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../lib/ToastContext';
import { useConfirm } from '../../lib/ConfirmContext';

interface Vendor { id: string; name: string; reliability_score: number; }
interface Material { id: string; name: string; unit: string; }

export function ProcurementPlaceOrder() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const vendorId = searchParams.get('vendorId')!;
  const materialId = searchParams.get('materialId')!;
  const stockRequestId = searchParams.get('stockRequestId');
  const prefilledQty = searchParams.get('qty') ?? '';

  const { data: vendors } = useQuery<Vendor[]>({ queryKey: ['vendors'], queryFn: () => api.get('/api/vendors') });
  const { data: materials } = useQuery<Material[]>({ queryKey: ['materials'], queryFn: () => api.get('/api/materials') });
  const { data: sr } = useQuery<{ quantity: string }>({
    queryKey: ['stock-request', stockRequestId],
    queryFn: () => api.get(`/api/stock-requests/${stockRequestId}`),
    enabled: !!stockRequestId,
  });

  const vendor = vendors?.find((v) => v.id === vendorId);
  const material = materials?.find((m) => m.id === materialId);

  const [quantity, setQuantity] = useState(prefilledQty);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Auto-fill from stock request if available
  useEffect(() => {
    if (sr?.quantity && !quantity && !prefilledQty) {
      setQuantity(sr.quantity.toString());
    }
  }, [sr, quantity, prefilledQty]);

  const send = async () => {
    const ok = await confirm({
      title: 'Send this order?',
      message: `Placing ${quantity} ${material?.unit ?? ''} of ${material?.name} with ${vendor?.name} — this commits to the order immediately (auto-accepted, no vendor confirmation step).`,
      confirmLabel: 'Send Order',
    });
    if (!ok) return;

    setSubmitting(true);
    try {
      const po = await api.post('/api/purchase-orders', {
        stock_request_id: stockRequestId, material_id: materialId, vendor_id: vendorId,
        quantity: Number(quantity), notes: note || undefined,
      });
      toast.success(`Order sent to ${vendor?.name}.`);
      navigate(`/procurement/orders/${po.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="header-row">
        <div>
          <div className="section-title">Place Order</div>
          <div className="section-sub">{vendor?.name?.toUpperCase()} SELECTED</div>
        </div>
      </div>
      <Card style={{ maxWidth: 560 }}>
        <CardPad>
          <div className="two-col-even" style={{ marginTop: 0 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Material</label>
              <input className="form-input" value={material?.name ?? ''} disabled style={{ opacity: 0.6 }} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Vendor</label>
              <input className="form-input" value={vendor ? `${vendor.name} (${vendor.reliability_score} reliability)` : ''} disabled style={{ opacity: 0.6 }} />
            </div>
          </div>
          <div className="two-col-even">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Quantity</label>
              <input className="form-input" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder={`e.g. 40 ${material?.unit ?? ''}`} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Expected Delivery</label>
              <input className="form-input" disabled style={{ opacity: 0.6 }} value="Auto-computed from lead time" />
            </div>
          </div>
          <div className="form-group" style={{ marginTop: 16 }}>
            <label className="form-label">Note for Vendor</label>
            <input className="form-input" placeholder="Deliver to site gate" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </CardPad>
      </Card>
      <Button style={{ marginTop: 16 }} onClick={send} disabled={!quantity} loading={submitting}>
        {submitting ? 'Sending…' : `Send Order to ${vendor?.name ?? 'Vendor'}`}
      </Button>
    </div>
  );
}
