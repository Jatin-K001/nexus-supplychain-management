import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Ring } from '../../components/ui/Ring';
import { Note, NoteText } from '../../components/ui/Note';
import { Button } from '../../components/ui/Button';

interface Vendor { id: string; name: string; reliability_score: number; score_trend: number | null; previous_score: number | null; }

function tierColor(score: number) {
  if (score >= 80) return 'var(--teal)';
  if (score >= 60) return 'var(--accent)';
  if (score >= 40) return 'var(--warning)';
  return 'var(--danger)';
}

export function ProcurementVendorManagement() {
  const { data: vendors } = useQuery<Vendor[]>({ queryKey: ['vendors'], queryFn: () => api.get('/api/vendors') });

  const withTrend = (vendors ?? []).filter((v) => v.score_trend != null);
  const biggestMove = withTrend.sort((a, b) => Math.abs(b.score_trend!) - Math.abs(a.score_trend!))[0];
  const spotlight = (vendors ?? []).filter((v) => v.score_trend != null).slice(0, 2);

  return (
    <div>
      <div className="header-row">
        <div>
          <div className="section-title">Vendor Management</div>
          <div className="section-sub">SCORES RECOMPUTED AFTER EVERY LOGGED DELIVERY</div>
        </div>
      </div>

      {biggestMove && (
        <div className="mb-4">
          <Note tone="success">
            <NoteText tone="success">
              ✓ {biggestMove.name}'s score just moved <b>{biggestMove.previous_score} → {biggestMove.reliability_score}</b> after a recent delivery.
            </NoteText>
          </Note>
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        {spotlight.map((v) => (
          <div className="vendor-card" key={v.id}>
            <div className="vendor-card-name">{v.name}</div>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10 }}>
              {v.previous_score != null && (
                <>
                  <Ring percent={v.previous_score} label="" color="var(--locked)" size="sm" />
                  <div style={{ fontFamily: 'var(--ff-head)', fontSize: 16, color: 'var(--text-muted)' }}>→</div>
                </>
              )}
              <Ring percent={v.reliability_score} label="NOW" color={tierColor(v.reliability_score)} />
            </div>
            <div className="vcard-stats">
              <div style={{ textAlign: 'center' }}>
                <div className="vcard-stat-val" style={{ color: (v.score_trend ?? 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {(v.score_trend ?? 0) >= 0 ? '▲' : '▼'}{Math.abs(v.score_trend ?? 0)}
                </div>
                <div className="vcard-stat-label">SINCE LAST</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Card>
        <table className="data-table">
          <thead><tr><th>Vendor</th><th>Reliability</th><th>Trend</th><th></th></tr></thead>
          <tbody>
            {(vendors ?? []).map((v) => (
              <tr key={v.id}>
                <td className="td-name">{v.name}</td>
                <td className="td-mono">{v.reliability_score}</td>
                <td>
                  {v.score_trend == null
                    ? <span className="badge badge-locked">—</span>
                    : <span className={`badge badge-${v.score_trend >= 0 ? 'complete' : 'danger'}`}>{v.score_trend >= 0 ? '▲' : '▼'} {Math.abs(v.score_trend)}</span>}
                </td>
                <td><Link to={`/procurement/vendors/${v.id}`}><Button size="sm" variant="ghost">View</Button></Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
