import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';

interface MaterialRequirement {
  id: string;
  subphase_id: string;
  material_id: string;
  material_name: string;
  unit: string;
  quantity_required: number;
  stock_on_hand: number;
  shortfall: number;
  subphase_name: string;
  subphase_status: string;
  phase_name: string;
  template_phase_no: number;
  project_name: string;
  project_id: string;
  open_requests_count: number;
  active_orders_count: number;
}

const STATUS_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  in_progress: { label: 'Active',    bg: '#FFFBEB', color: '#D97706' },
  available:   { label: 'Ready',     bg: '#EFF6FF', color: '#2563EB' },
  locked:      { label: 'Locked',    bg: '#F8FAFC', color: '#94A3B8' },
  complete:    { label: 'Complete',  bg: '#F0FDF4', color: '#16A34A' },
};

export function ProcurementMaterialRequirements() {
  const navigate = useNavigate();

  const { data: rows, isLoading } = useQuery<MaterialRequirement[]>({
    queryKey: ['material-requirements'],
    queryFn: () => api.get('/api/material-requirements'),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  // Group by project
  const byProject = (rows ?? []).reduce<Record<string, MaterialRequirement[]>>((acc, r) => {
    if (!acc[r.project_name]) acc[r.project_name] = [];
    acc[r.project_name].push(r);
    return acc;
  }, {});

  const totalShortfall = (rows ?? []).filter((r) => r.shortfall > 0).length;
  const alreadyOrdered = (rows ?? []).filter((r) => r.active_orders_count > 0).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'var(--ff-head)', fontSize: 20, fontWeight: 800, color: '#0F172A' }}>
            Material Requirements
          </div>
          <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: '#94A3B8', marginTop: 3 }}>
            ALL SUBPHASES · SET BY SITE SUPERVISORS · PLACE ORDERS DIRECTLY FROM HERE
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {totalShortfall > 0 && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 14px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--ff-display)', fontSize: 22, color: '#DC2626', lineHeight: 1 }}>{totalShortfall}</div>
              <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, color: '#DC2626', marginTop: 2 }}>SHORTFALLS</div>
            </div>
          )}
          {alreadyOrdered > 0 && (
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '8px 14px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--ff-display)', fontSize: 22, color: '#16A34A', lineHeight: 1 }}>{alreadyOrdered}</div>
              <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, color: '#16A34A', marginTop: 2 }}>ORDERED</div>
            </div>
          )}
        </div>
      </div>

      {isLoading && (
        <div style={{ padding: '32px', textAlign: 'center', color: '#94A3B8', fontFamily: 'var(--ff-body)' }}>
          Loading requirements…
        </div>
      )}

      {!isLoading && (rows ?? []).length === 0 && (
        <div style={{ background: '#fff', border: '1px solid #E8EDF5', borderRadius: 10, padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
          <div style={{ fontFamily: 'var(--ff-head)', fontSize: 16, color: '#475569' }}>No material requirements set yet</div>
          <div style={{ fontFamily: 'var(--ff-body)', fontSize: 13, color: '#94A3B8', marginTop: 6 }}>
            Site supervisors set material requirements per subphase. They will appear here once set.
          </div>
        </div>
      )}

      {/* Per-project groups */}
      {Object.entries(byProject).map(([projectName, items]) => (
        <div key={projectName} style={{ background: '#fff', border: '1px solid #E8EDF5', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          {/* Project header */}
          <div style={{ padding: '12px 20px', background: '#F8FAFC', borderBottom: '1px solid #E8EDF5', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'var(--ff-head)', fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{projectName}</span>
            <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, background: '#E2E8F0', color: '#64748B', padding: '2px 8px', borderRadius: 10 }}>
              {items.length} MATERIAL{items.length !== 1 ? 'S' : ''}
            </span>
            <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, background: '#FEE2E2', color: '#DC2626', padding: '2px 8px', borderRadius: 10 }}>
              {items.filter((r) => r.shortfall > 0).length} SHORTFALL{items.filter((r) => r.shortfall > 0).length !== 1 ? 'S' : ''}
            </span>
          </div>

          {/* Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#FAFBFD' }}>
                {['Phase', 'Subphase', 'Status', 'Material', 'Required', 'In Stock', 'Shortfall', ''].map((h) => (
                  <th key={h} style={{
                    fontFamily: 'var(--ff-mono)', fontSize: 9, color: '#94A3B8', fontWeight: 600,
                    padding: '8px 16px', textAlign: 'left', borderBottom: '1px solid #F1F5F9',
                    letterSpacing: 0.5,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((r, i) => {
                const hasShortfall = r.shortfall > 0;
                const alreadyActioned = r.active_orders_count > 0 || r.open_requests_count > 0;
                const ss = STATUS_STYLE[r.subphase_status] ?? STATUS_STYLE.locked;
                return (
                  <tr
                    key={r.id}
                    style={{
                      borderBottom: i < items.length - 1 ? '1px solid #F8FAFC' : 'none',
                      background: hasShortfall && !alreadyActioned ? '#FFFAF5' : undefined,
                    }}
                  >
                    <td style={{ padding: '11px 16px', fontFamily: 'var(--ff-mono)', fontSize: 10, color: '#64748B', whiteSpace: 'nowrap' }}>
                      Ph.{r.template_phase_no} — {r.phase_name}
                    </td>
                    <td style={{ padding: '11px 16px', fontFamily: 'var(--ff-body)', fontSize: 12.5, fontWeight: 600, color: '#1E293B', maxWidth: 200 }}>
                      {r.subphase_name}
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, padding: '2px 7px', borderRadius: 4, background: ss.bg, color: ss.color, fontWeight: 600 }}>
                        {ss.label}
                      </span>
                    </td>
                    <td style={{ padding: '11px 16px', fontFamily: 'var(--ff-body)', fontSize: 12.5, color: '#334155' }}>
                      {r.material_name}
                    </td>
                    <td style={{ padding: '11px 16px', fontFamily: 'var(--ff-mono)', fontSize: 12, color: '#1E293B', whiteSpace: 'nowrap' }}>
                      {r.quantity_required} {r.unit}
                    </td>
                    <td style={{ padding: '11px 16px', fontFamily: 'var(--ff-mono)', fontSize: 12, color: r.stock_on_hand >= r.quantity_required ? '#16A34A' : '#DC2626', whiteSpace: 'nowrap' }}>
                      {r.stock_on_hand} {r.unit}
                    </td>
                    <td style={{ padding: '11px 16px', fontFamily: 'var(--ff-mono)', fontSize: 12, fontWeight: hasShortfall ? 700 : 400, color: hasShortfall ? '#DC2626' : '#16A34A', whiteSpace: 'nowrap' }}>
                      {hasShortfall ? `−${r.shortfall} ${r.unit}` : '✓ Sufficient'}
                    </td>
                    <td style={{ padding: '11px 16px', whiteSpace: 'nowrap' }}>
                      {alreadyActioned ? (
                        <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, background: '#F0FDF4', color: '#16A34A', padding: '3px 9px', borderRadius: 5, fontWeight: 600 }}>
                          {r.active_orders_count > 0 ? 'ORDER PLACED' : 'REQUEST OPEN'}
                        </span>
                      ) : hasShortfall ? (
                        <button
                          onClick={() => navigate(`/procurement/vendors/discover-material/${r.material_id}?qty=${r.shortfall}&subphaseId=${r.subphase_id}`)}
                          style={{
                            fontFamily: 'var(--ff-mono)', fontSize: 10, fontWeight: 700,
                            background: '#1E5FA8', color: '#fff', border: 'none',
                            borderRadius: 6, padding: '5px 12px', cursor: 'pointer',
                            letterSpacing: 0.3,
                          }}
                        >
                          ORDER NOW →
                        </button>
                      ) : (
                        <button
                          onClick={() => navigate(`/procurement/vendors/discover-material/${r.material_id}?qty=${r.quantity_required}&subphaseId=${r.subphase_id}`)}
                          style={{
                            fontFamily: 'var(--ff-mono)', fontSize: 10,
                            background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0',
                            borderRadius: 6, padding: '5px 12px', cursor: 'pointer',
                          }}
                        >
                          Reorder
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
