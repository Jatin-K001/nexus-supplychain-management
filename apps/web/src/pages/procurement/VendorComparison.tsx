import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Ring } from '../../components/ui/Ring';
import { Note, NoteText } from '../../components/ui/Note';

interface VendorCompareRow {
  vendor_id: string; vendor_name: string; reliability_score: number; on_time_pct: number | null;
  complaint_rate: number | null; latest_price: string; predicted_lead_time_days: number;
}

function tierColor(score: number) {
  if (score >= 80) return 'var(--teal)';
  if (score >= 60) return 'var(--accent)';
  if (score >= 40) return 'var(--warning)';
  return 'var(--danger)';
}

export function ProcurementVendorComparison() {
  const { materialId } = useParams();
  const [searchParams] = useSearchParams();
  const stockRequestId = searchParams.get('stockRequestId');
  const subphaseId = searchParams.get('subphaseId');
  const qty = searchParams.get('qty');
  const navigate = useNavigate();

  const { data: vendors } = useQuery<VendorCompareRow[]>({
    queryKey: ['vendor-compare', materialId],
    queryFn: () => api.get(`/api/vendors/compare/${materialId}`),
  });

  const best = vendors?.[0];

  return (
    <div>
      <div className="header-row">
        <div>
          <div className="section-title">Compare Vendors</div>
          <div className="section-sub">RELIABILITY-RANKED · LIVE SCORES</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {(vendors ?? []).map((v) => {
          const isBest = v.vendor_id === best?.vendor_id;
          return (
            <div className={`vendor-card ${isBest ? 'best' : ''}`} key={v.vendor_id}>
              <div className="vendor-card-name">{v.vendor_name}</div>
              <div className="vendor-card-meta">{v.predicted_lead_time_days} DAY AVG LEAD TIME</div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Ring percent={v.reliability_score} label="RELIABILITY" color={tierColor(v.reliability_score)} />
              </div>
              <div className="vcard-stats">
                <div style={{ textAlign: 'center' }}><div className="vcard-stat-val">{v.on_time_pct ?? '—'}%</div><div className="vcard-stat-label">ON-TIME</div></div>
                <div style={{ textAlign: 'center' }}><div className="vcard-stat-val">₹{v.latest_price}</div><div className="vcard-stat-label">PER UNIT</div></div>
                <div style={{ textAlign: 'center' }}><div className="vcard-stat-val">{v.complaint_rate ?? 0}%</div><div className="vcard-stat-label">COMPLAINTS</div></div>
              </div>
              <Button
                variant={isBest ? 'teal' : 'ghost'}
                className="btn-full"
                style={{ marginTop: 16 }}
                onClick={() => {
                    const params = new URLSearchParams({
                      vendorId: v.vendor_id,
                      materialId: materialId!,
                    });
                    if (stockRequestId) params.set('stockRequestId', stockRequestId);
                    if (subphaseId) params.set('subphaseId', subphaseId);
                    if (qty) params.set('qty', qty);
                    navigate(`/procurement/orders/new?${params.toString()}`);
                  }}

              >
                Select {v.vendor_name}
              </Button>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 18 }}>
        <Note tone="info">
          <NoteText tone="info">
            {best?.vendor_name} is recommended based on live reliability — a composite of on-time delivery %, complaints, and price consistency — not price alone.
          </NoteText>
        </Note>
      </div>
    </div>
  );
}
