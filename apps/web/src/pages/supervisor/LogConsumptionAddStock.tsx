import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { StepsRow } from '../../components/ui/StepsRow';
import { Card, CardPad } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../lib/ToastContext';

interface Material { id: string; name: string; unit: string; }
interface ExistingMaterial { material_id: string; name: string; quantity_required: string; }
interface SubphaseDetail { id: string; name: string; sequence: number; materials: ExistingMaterial[]; }
interface MaterialRow { material_id: string; quantity_required: string; }

const STEPS = [{ label: 'Project' }, { label: 'Phase' }, { label: 'Subphase' }];

const emptyRow = (): MaterialRow => ({ material_id: '', quantity_required: '' });

export function LogConsumptionAddStock() {
  const { projectId, phaseId, subphaseId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: materials } = useQuery<Material[]>({ queryKey: ['materials'], queryFn: () => api.get('/api/materials') });
  const { data: sub } = useQuery<SubphaseDetail>({ queryKey: ['subphase', subphaseId], queryFn: () => api.get(`/api/subphases/${subphaseId}`) });

  const [rows, setRows] = useState<MaterialRow[]>([emptyRow()]);
  const [saving, setSaving] = useState(false);

  // Pre-populate with existing saved materials
  useEffect(() => {
    if (sub?.materials?.length) {
      setRows(sub.materials.map((m) => ({ material_id: m.material_id, quantity_required: m.quantity_required })));
    } else if (materials?.[0]) {
      setRows([{ material_id: materials[0].id, quantity_required: '' }]);
    }
  }, [sub, materials]);

  const updateRow = (index: number, field: keyof MaterialRow, value: string) => {
    setRows((prev) => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  };

  const addRow = () => {
    const usedIds = new Set(rows.map((r) => r.material_id));
    const nextMaterial = (materials ?? []).find((m) => !usedIds.has(m.id));
    setRows((prev) => [...prev, { material_id: nextMaterial?.id ?? '', quantity_required: '' }]);
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  // Materials already used in other rows (to avoid duplicate dropdowns)
  const usedIds = (index: number) => new Set(rows.filter((_, i) => i !== index).map((r) => r.material_id));

  const validRows = rows.filter((r) => r.material_id && r.quantity_required !== '');
  const canSave = validRows.length > 0;

  const save = async () => {
    setSaving(true);
    try {
      await Promise.all(
        validRows.map((r) =>
          api.post(`/api/subphases/${subphaseId}/materials`, {
            material_id: r.material_id,
            quantity_required: Number(r.quantity_required),
          })
        )
      );
      queryClient.invalidateQueries({ queryKey: ['phase-subphases-materials', phaseId] });
      queryClient.invalidateQueries({ queryKey: ['subphase', subphaseId] });
      toast.success(`Saved ${validRows.length} material${validRows.length !== 1 ? 's' : ''} for ${sub?.name}.`);
      navigate(`/supervisor/log-consumption/${projectId}/${phaseId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save materials');
    } finally {
      setSaving(false);
    }
  };

  if (!sub) return null;

  const allMaterials = materials ?? [];
  const canAddMore = rows.length < allMaterials.length;

  return (
    <div>
      <Breadcrumb parts={['LOG CONSUMPTION', 'PROJECT', 'PHASE', `SUBPHASE ${String(sub.sequence).padStart(2, '0')}`]} />
      <div className="header-row">
        <div>
          <div className="section-title">Set Materials — {sub.name}</div>
          <div className="section-sub">STEP 3 OF 3 · ADD ALL MATERIALS NEEDED FOR THIS SUBPHASE</div>
        </div>
      </div>
      <StepsRow steps={STEPS} currentIndex={2} />

      <Card style={{ maxWidth: 640 }}>
        <CardPad>
          {/* Header row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 40px', gap: 12, marginBottom: 8, alignItems: 'center' }}>
            <span className="form-label" style={{ margin: 0 }}>Material</span>
            <span className="form-label" style={{ margin: 0 }}>Qty Required</span>
            <span />
          </div>

          {/* Material rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rows.map((row, index) => {
              const used = usedIds(index);
              const unit = allMaterials.find((m) => m.id === row.material_id)?.unit ?? '';
              return (
                <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 160px 40px', gap: 12, alignItems: 'center' }}>
                  <select
                    className="form-input"
                    value={row.material_id}
                    onChange={(e) => updateRow(index, 'material_id', e.target.value)}
                    style={{ margin: 0 }}
                  >
                    <option value="">— Select material —</option>
                    {allMaterials.map((m) => (
                      <option key={m.id} value={m.id} disabled={used.has(m.id)}>
                        {m.name} ({m.unit})
                      </option>
                    ))}
                  </select>

                  <div style={{ position: 'relative' }}>
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={row.quantity_required}
                      onChange={(e) => updateRow(index, 'quantity_required', e.target.value)}
                      style={{ margin: 0, paddingRight: unit ? 48 : 12 }}
                    />
                    {unit && (
                      <span style={{
                        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                        fontSize: 11, color: 'var(--text-muted)', pointerEvents: 'none'
                      }}>
                        {unit}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => removeRow(index)}
                    disabled={rows.length === 1}
                    style={{
                      width: 36, height: 36, borderRadius: 8, border: '1px solid #e0e0e0',
                      background: rows.length === 1 ? '#f5f5f5' : '#fff2f2',
                      color: rows.length === 1 ? '#bbb' : '#D32F2F',
                      cursor: rows.length === 1 ? 'not-allowed' : 'pointer',
                      fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}
                    title="Remove row"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>

          {/* Add material button */}
          {canAddMore && (
            <button
              onClick={addRow}
              style={{
                marginTop: 14, display: 'flex', alignItems: 'center', gap: 6,
                background: 'none', border: '1.5px dashed #1E5FA8', borderRadius: 8,
                color: '#1E5FA8', padding: '8px 16px', cursor: 'pointer', fontSize: 13,
                fontWeight: 600, width: '100%', justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Add Another Material
            </button>
          )}
        </CardPad>
      </Card>

      <Button
        style={{ marginTop: 16 }}
        onClick={save}
        disabled={!canSave}
        loading={saving}
      >
        {saving ? 'Saving…' : `Save ${validRows.length} Material${validRows.length !== 1 ? 's' : ''} for This Subphase`}
      </Button>
    </div>
  );
}
