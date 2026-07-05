import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card, CardPad } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Note, NoteText } from '../../components/ui/Note';
import { EmptyState } from '../../components/ui/EmptyState';
import { useToast } from '../../lib/ToastContext';
import { useConfirm } from '../../lib/ConfirmContext';

interface PO {
  id: string; status: string; material_name: string; unit: string; vendor_name: string;
  vendor_id: string; quantity: string; promised_date: string; order_date: string; notes: string | null;
  source_stock_request_id: string | null;
}
interface Vendor { id: string; reliability_score: string; }

export function ProcurementLogDelivery() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const initialOrderId = searchParams.get('orderId');

  const { data: orders } = useQuery<PO[]>({ queryKey: ['purchase-orders'], queryFn: () => api.get('/api/purchase-orders') });
  const { data: vendors } = useQuery<Vendor[]>({ queryKey: ['vendors'], queryFn: () => api.get('/api/vendors') });
  const awaiting = (orders ?? []).filter((o) => o.status === 'ordered');

  const [selectedId, setSelectedId] = useState<string | null>(initialOrderId);
  const [actualDate, setActualDate] = useState('');
  const [qtyReceived, setQtyReceived] = useState('');
  const [complaint, setComplaint] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ score: number; prevScore: number; isOnTime: boolean; stockOnHand: number; materialName: string; unit: string; vendorName: string } | null>(null);

  const selected = awaiting.find((o) => o.id === selectedId);

  // Auto-fill quantity if selected from URL
  useEffect(() => {
    if (selected && !qtyReceived && !done) {
      setQtyReceived(selected.quantity);
      setActualDate(new Date().toISOString().slice(0, 10));
    }
  }, [selected, qtyReceived, done]);

  const select = (o: PO) => {
    setSelectedId(o.id);
    setQtyReceived(o.quantity);
    setActualDate(new Date().toISOString().slice(0, 10));
    setDone(null);
  };

  const save = async () => {
    if (!selected) return;
    const ok = await confirm({
      title: 'Save this delivery record?',
      message: `Confirms ${qtyReceived} ${selected.unit} of ${selected.material_name} received from ${selected.vendor_name} on ${actualDate}. This recomputes their reliability score immediately and can't be undone from here.`,
      confirmLabel: 'Save Delivery Record',
    });
    if (!ok) return;

    setSaving(true);
    try {
      const prevScore = Number(vendors?.find((v) => v.id === selected.vendor_id)?.reliability_score ?? 0);
      const res = await api.post(`/api/purchase-orders/${selected.id}/deliver`, {
        actual_date: actualDate, qty_received: Number(qtyReceived), complaint,
      });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      setDone({
        score: res.vendorScore?.score,
        prevScore,
        isOnTime: actualDate <= selected.promised_date.slice(0, 10),
        stockOnHand: res.materialStockOnHand,
        materialName: selected.material_name,
        unit: selected.unit,
        vendorName: selected.vendor_name,
      });
      setSelectedId(null);
      toast.success('Delivery logged.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to log delivery');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="header-row">
        <div>
          <div className="section-title">Log Delivery</div>
          <div className="section-sub">SELECT AN ORDER AWAITING DELIVERY CONFIRMATION</div>
        </div>
      </div>

      <Card className="mb-4">
        <table className="data-table">
          <thead><tr><th>Order #</th><th>Material</th><th>Vendor</th><th>Promised Date</th><th></th></tr></thead>
          <tbody>
            {awaiting.map((o) => (
              <tr key={o.id} style={selectedId === o.id ? { background: 'var(--accent-fill)' } : undefined}>
                <td className="td-name">#{o.id.slice(0, 6)}</td>
                <td className="td-sub">{o.material_name} · {o.quantity} {o.unit}</td>
                <td className="td-sub">{o.vendor_name}</td>
                <td className="td-mono">{new Date(o.promised_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                <td>
                  {selectedId === o.id
                    ? <Button size="sm">Selected ✓</Button>
                    : <Button size="sm" variant="ghost" onClick={() => select(o)}>Select</Button>}
                </td>
              </tr>
            ))}
            {awaiting.length === 0 && (
              <tr><td colSpan={5}><EmptyState icon="🚚" title="Nothing to deliver" subtitle="Orders will appear here once they're placed and en route." /></td></tr>
            )}
          </tbody>
        </table>
      </Card>

      {selected && (
        <>
          <div className="header-row">
            <div>
              <div className="section-title" style={{ fontSize: 18 }}>Log Delivery — Order #{selected.id.slice(0, 6)}</div>
              <div className="section-sub">{selected.vendor_name.toUpperCase()} · {selected.material_name.toUpperCase()}</div>
            </div>
          </div>
          <Card style={{ maxWidth: 560 }}>
            <CardPad>
              <div className="two-col-even" style={{ marginTop: 0 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Material Ordered</label>
                  <input className="form-input" disabled style={{ opacity: 0.6 }} value={selected.material_name} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Vendor</label>
                  <input className="form-input" disabled style={{ opacity: 0.6 }} value={selected.vendor_name} />
                </div>
              </div>
              <div className="two-col-even">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Quantity Ordered</label>
                  <input className="form-input" disabled style={{ opacity: 0.6 }} value={`${selected.quantity} ${selected.unit}`} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Order Placed</label>
                  <input className="form-input" disabled style={{ opacity: 0.6 }} value={new Date(selected.order_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} />
                </div>
              </div>
              <div className="two-col-even">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Promised Delivery Date (Vendor)</label>
                  <input className="form-input" disabled style={{ opacity: 0.6 }} value={new Date(selected.promised_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Source</label>
                  <input className="form-input" disabled style={{ opacity: 0.6 }} value={selected.source_stock_request_id ? 'Stock Request' : (selected.notes ? 'Auto-Recommended' : 'Manual Order')} />
                </div>
              </div>
              {selected.notes && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Notes</label>
                  <input className="form-input" disabled style={{ opacity: 0.6 }} value={selected.notes} />
                </div>
              )}
              <div className="two-col-even">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Actual Delivery Date</label>
                  <input className="form-input" type="date" value={actualDate} onChange={(e) => setActualDate(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Quantity Received</label>
                  <input className="form-input" value={qtyReceived} onChange={(e) => setQtyReceived(e.target.value)} />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Quality Complaint?</label>
                <select className="form-input" value={complaint ? 'Yes' : 'No'} onChange={(e) => setComplaint(e.target.value === 'Yes')}>
                  <option>No</option>
                  <option>Yes</option>
                </select>
              </div>
            </CardPad>
          </Card>
          <Button style={{ marginTop: 16 }} onClick={save} loading={saving}>{saving ? 'Saving…' : 'Save Delivery Record'}</Button>
          <div style={{ marginTop: 16, maxWidth: 560 }}>
            <Note tone="info">
              <NoteText tone="info">Saving this immediately recomputes {selected.vendor_name}'s reliability score and updates every ring on Vendor Management.</NoteText>
            </Note>
          </div>
        </>
      )}

      {done && (
        <div style={{ marginTop: 16 }}>
          <Note tone={done.isOnTime ? 'success' : 'danger'}>
            <NoteText tone={done.isOnTime ? 'success' : 'danger'}>
              ✓ Delivery logged — {done.isOnTime ? 'on time/early' : 'late'}. {done.vendorName}'s reliability score moved{' '}
              <b>{done.prevScore} → {done.score}</b> ({done.score >= done.prevScore ? '▲' : '▼'} {Math.abs(Math.round((done.score - done.prevScore) * 100) / 100)}).
              {' '}{done.materialName} stock on hand is now <b>{done.stockOnHand} {done.unit}</b> across every project.
            </NoteText>
          </Note>
        </div>
      )}
    </div>
  );
}
