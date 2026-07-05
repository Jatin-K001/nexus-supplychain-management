import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { Card, CardPad } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Note, NoteText } from '../../components/ui/Note';
import { useToast } from '../../lib/ToastContext';
import { useConfirm } from '../../lib/ConfirmContext';

interface MaterialLine { material_id: string; name: string; unit: string; quantity_required: string; quantity_in_stock: string; }
interface SubphaseDetail {
  id: string; name: string; sequence: number; status: string; phase_id: string; phase_name: string;
  planned_start: string | null; planned_end: string | null; actual_end: string | null;
  materials: MaterialLine[];
}
interface NextPreview { id: string; name: string; planned_start: string | null; }

type DelayCause = 'material' | 'labor' | 'weather' | 'other';
interface CreatedStockRequest { id: string; materialName: string; quantity: number; subphaseName: string; }
interface EndResult {
  createdStockRequests: CreatedStockRequest[];
  alreadyRequestedMaterials: CreatedStockRequest[];
  waitingOnStock: string[];
  delayDays: number;
  isEarly: boolean;
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function SupervisorSubphaseDetail() {
  const { subphaseId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  const { data: sub } = useQuery<SubphaseDetail>({
    queryKey: ['subphase', subphaseId],
    queryFn: () => api.get(`/api/subphases/${subphaseId}`),
  });
  const { data: nextPreview } = useQuery<NextPreview[]>({
    queryKey: ['subphase-next', subphaseId],
    queryFn: () => api.get(`/api/subphases/${subphaseId}/next`),
    enabled: !!sub && sub.status === 'available',
  });

  const [nextStartDate, setNextStartDate] = useState('');
  const [actualEnd, setActualEnd] = useState('');
  const [delayCause, setDelayCause] = useState<DelayCause>('material');
  const [endNextStartDate, setEndNextStartDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EndResult | null>(null);

  useEffect(() => {
    if (sub?.planned_end) {
      setNextStartDate(sub.planned_end.slice(0, 10));
      setActualEnd((prev) => prev || sub.planned_end!.slice(0, 10));
    }
  }, [sub]);

  useEffect(() => {
    if (nextPreview?.[0]?.planned_start) {
      setEndNextStartDate(nextPreview[0].planned_start.slice(0, 10));
    } else if (actualEnd) {
      setEndNextStartDate(actualEnd);
    }
  }, [nextPreview, actualEnd]);

  if (!sub) return null;

  const plannedEnd = sub.planned_end?.slice(0, 10);
  const isLate = actualEnd && plannedEnd ? actualEnd > plannedEnd : false;
  const isEarly = actualEnd && plannedEnd ? actualEnd < plannedEnd : false;

  const activate = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/api/subphases/${subphaseId}/start`, { next_start_date: nextStartDate || undefined });
      queryClient.invalidateQueries({ queryKey: ['subphase', subphaseId] });
      queryClient.invalidateQueries({ queryKey: ['phase-subphases'] });
      toast.success(`${sub?.name} activated.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to activate';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmEnd = async () => {
    const ok = await confirm({
      title: isLate ? 'End subphase with a recorded delay?' : 'End this subphase?',
      message: isLate
        ? `Ending on ${actualEnd} records a delay (cause: ${delayCause}) and recalculates the project's cascade. This can't be undone from here.`
        : `Ending on ${actualEnd} will auto-start the next subphase (stock permitting). This can't be undone from here.`,
      confirmLabel: 'End Subphase',
      tone: isLate ? 'danger' : 'primary',
    });
    if (!ok) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post(`/api/subphases/${subphaseId}/end`, {
        actual_end: actualEnd,
        delay_cause: isLate ? delayCause : undefined,
        next_start_date: endNextStartDate || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['phase-subphases'] });
      setResult(res);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to end subphase';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const materialsBlock = (
    <Card className="mb-4">
      <CardPad>
        <div className="stat-label" style={{ marginBottom: 8 }}>MATERIALS NEEDED</div>
        {sub.materials.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-2)' }}>No tracked material for this subphase.</div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Material</th><th>Required</th><th>In Stock</th></tr></thead>
            <tbody>
              {sub.materials.map((m) => (
                <tr key={m.material_id}>
                  <td className="td-name">{m.name}</td>
                  <td className="td-mono">{m.quantity_required} {m.unit}</td>
                  <td className="td-mono" style={{ color: Number(m.quantity_in_stock) < Number(m.quantity_required) ? 'var(--danger)' : undefined }}>
                    {m.quantity_in_stock} {m.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardPad>
    </Card>
  );

  // Post-end result screens
  if (result && result.createdStockRequests.length > 0) {
    const sr = result.createdStockRequests[0];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingTop: 60 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--danger-fill)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>📦</div>
        <div style={{ fontFamily: 'var(--ff-head)', fontSize: 20, fontWeight: 700, marginTop: 16 }}>Next Subphase Waiting on Stock</div>
        <div style={{ fontFamily: 'var(--ff-body)', fontSize: 13, color: 'var(--text-2)', marginTop: 8, lineHeight: 1.6, maxWidth: 440 }}>
          {sr.subphaseName} needs <b>{sr.materialName} — {sr.quantity}</b>, which isn't in stock. It can't start until Procurement delivers it — a request has been sent to the PM automatically.
        </div>
        <Card className="mt-4" style={{ textAlign: 'left', width: 360 }}>
          <CardPad>
            <div className="stat-label">REQUEST</div>
            <div style={{ fontFamily: 'var(--ff-head)', fontSize: 14, fontWeight: 700, marginTop: 2 }}>Sent to Project Manager</div>
            <div className="td-sub" style={{ marginTop: 2 }}>Status: <span className="badge badge-warning">Awaiting PM Approval</span></div>
          </CardPad>
        </Card>
        <Button style={{ marginTop: 20 }} onClick={() => navigate(`/supervisor/projects/${sub.phase_id}`)}>Back to My Phase</Button>
      </div>
    );
  }
  if (result && result.alreadyRequestedMaterials.length > 0) {
    const sr = result.alreadyRequestedMaterials[0];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingTop: 60 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--warning-fill)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>⏳</div>
        <div style={{ fontFamily: 'var(--ff-head)', fontSize: 20, fontWeight: 700, marginTop: 16 }}>Next Subphase Waiting — Request Already Open</div>
        <div style={{ fontFamily: 'var(--ff-body)', fontSize: 13, color: 'var(--text-2)', marginTop: 8, lineHeight: 1.6, maxWidth: 440 }}>
          {sr.subphaseName} still needs <b>{sr.materialName} — {sr.quantity}</b>. A request for it is already with the PM/Procurement — no duplicate was created. Come back and Activate it once stock arrives.
        </div>
        <Button style={{ marginTop: 20 }} onClick={() => navigate(-1)}>Back</Button>
      </div>
    );
  }
  if (result) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingTop: 60 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--success-fill)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>✓</div>
        <div style={{ fontFamily: 'var(--ff-head)', fontSize: 20, fontWeight: 700, marginTop: 16 }}>Subphase Ended</div>
        <div style={{ fontFamily: 'var(--ff-body)', fontSize: 13, color: 'var(--text-2)', marginTop: 8 }}>
          {result.isEarly ? 'Stock was sufficient — next subphase started automatically.' : result.delayDays > 0 ? `Recorded ${result.delayDays} day(s) delay — cascade recalculated. Next subphase started automatically.` : 'Finished on time — next subphase started automatically.'}
        </div>
        <Button style={{ marginTop: 20 }} onClick={() => navigate(-1)}>Back</Button>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb parts={['MY PHASE', sub.phase_name?.toUpperCase(), `SUBPHASE ${String(sub.sequence).padStart(2, '0')}`]} />
      <div className="header-row">
        <div>
          <div className="section-title">{sub.name}</div>
          <div className="section-sub">
            {sub.status === 'in_progress' ? 'IN PROGRESS' : sub.status === 'available' ? 'READY TO ACTIVATE' : sub.status.toUpperCase()}
          </div>
        </div>
        {sub.status === 'in_progress' && <span className="badge badge-progress" style={{ fontSize: 11, padding: '5px 10px' }}>In Progress</span>}
      </div>

      <Card className="mb-4" style={{ maxWidth: 560 }}>
        <CardPad>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Planned End Date</label>
            <input className="form-input" disabled style={{ opacity: 0.6 }} value={fmtDate(sub.planned_end)} />
          </div>
        </CardPad>
      </Card>

      {materialsBlock}

      {sub.status === 'available' && (
        <Card style={{ maxWidth: 560 }}>
          <CardPad>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Start Date for Next Subphase{nextPreview?.[0] ? ` (${nextPreview[0].name})` : ''}</label>
              <input className="form-input" type="date" value={nextStartDate} onChange={(e) => setNextStartDate(e.target.value)} />
            </div>
          </CardPad>
        </Card>
      )}
      {sub.status === 'available' && (
        <div style={{ maxWidth: 560, marginTop: 14 }}>
          <Note tone="info">
            <NoteText tone="info">Activating sets today as this subphase's start. The date above pre-sets when the next subphase will begin once this one ends.</NoteText>
          </Note>
        </div>
      )}

      {sub.status === 'in_progress' && (
        <Card style={{ maxWidth: 560 }}>
          <CardPad>
            <div className="two-col-even" style={{ marginTop: 0 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Planned End Date</label>
                <input className="form-input" disabled style={{ opacity: 0.6 }} value={fmtDate(sub.planned_end)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Actual End Date</label>
                <input className="form-input" type="date" value={actualEnd} onChange={(e) => setActualEnd(e.target.value)} />
              </div>
            </div>
            {isLate && (
              <div className="form-group" style={{ marginTop: 16, marginBottom: 0 }}>
                <label className="form-label">Delay Cause</label>
                <select className="form-input" value={delayCause} onChange={(e) => setDelayCause(e.target.value as DelayCause)}>
                  <option value="material">Material</option>
                  <option value="labor">Labor</option>
                  <option value="weather">Weather</option>
                  <option value="other">Other</option>
                </select>
              </div>
            )}
            <div className="form-group" style={{ marginTop: 16, marginBottom: 0 }}>
              <label className="form-label">Start Date for Next Subphase</label>
              <input className="form-input" type="date" value={endNextStartDate} onChange={(e) => setEndNextStartDate(e.target.value)} />
            </div>
          </CardPad>
        </Card>
      )}

      {sub.status === 'in_progress' && actualEnd && (
        <div style={{ maxWidth: 560, marginTop: 14 }}>
          {isEarly ? (
            <Note tone="warning">
              <NoteText tone="warning">⚠ Ending ahead of plan. The system will check whether the next subphase has its required material in stock before auto-starting it.</NoteText>
            </Note>
          ) : isLate ? (
            <Note tone="danger">
              <NoteText tone="danger">Ending later than plan — a Delay Cause is required and feeds Delay Root-Cause Attribution.</NoteText>
            </Note>
          ) : null}
        </div>
      )}

      {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 8 }}>{error}</div>}

      {sub.status === 'available' && (
        <Button style={{ marginTop: 16 }} onClick={activate} loading={submitting}>
          {submitting ? 'Activating…' : 'Activate Subphase'}
        </Button>
      )}
      {sub.status === 'in_progress' && (
        <Button style={{ marginTop: 6 }} onClick={confirmEnd} disabled={!actualEnd} loading={submitting}>
          {submitting ? 'Submitting…' : 'End This Subphase'}
        </Button>
      )}
    </div>
  );
}
