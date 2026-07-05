import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { Card, CardPad, CardTitle } from '../../components/ui/Card';
import { Ring } from '../../components/ui/Ring';

interface VendorDetail {
  id: string; name: string; reliability_score: number; materials_supplied: string[];
  total_orders: number; on_time_pct: number | null; complaints: number; price_stability_pct: number | null;
  avg_lead_time_days: number | null; last_delivery: string | null;
  delivery_history: { actual_date: string; promised_date: string; material_name: string; unit: string; qty_delivered: string; complaint: boolean }[];
}

export function ProcurementVendorDetail() {
  const { vendorId } = useParams();
  const { data: vendor } = useQuery<VendorDetail>({ queryKey: ['vendor', vendorId], queryFn: () => api.get(`/api/vendors/${vendorId}`) });

  if (!vendor) return null;

  return (
    <div>
      <Breadcrumb parts={['VENDORS', vendor.name.toUpperCase()]} />
      <div className="header-row">
        <div>
          <div className="section-title">{vendor.name}</div>
          <div className="section-sub">{vendor.materials_supplied.join(' · ').toUpperCase()}</div>
        </div>
      </div>
      <div className="two-col">
        <div>
          <Card className="mb-4">
            <CardPad>
              <CardTitle>Reliability Breakdown</CardTitle>
              <div className="ring-row">
                <div style={{ textAlign: 'center' }}>
                  <Ring percent={vendor.reliability_score} label="OVERALL" color="var(--teal)" />
                  <div className="ring-cap">Composite Score</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <Ring percent={vendor.on_time_pct ?? 0} label="" color="var(--success)" size="sm" />
                  <div className="ring-cap">On-Time %</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <Ring percent={100} label="" color="var(--info)" size="sm" />
                  <div className="ring-cap">Complaints: {vendor.complaints}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <Ring percent={vendor.price_stability_pct ?? 0} label="" color="var(--accent)" size="sm" />
                  <div className="ring-cap">Price Stability</div>
                </div>
              </div>
            </CardPad>
          </Card>
          <Card>
            <CardPad>
              <CardTitle>Delivery History</CardTitle>
              {vendor.delivery_history.map((d, i) => (
                <div className="dt-item" key={i}>
                  <div className="dt-date">{new Date(d.actual_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}</div>
                  <div className="dt-dot" style={{ background: d.complaint ? 'var(--danger)' : (d.actual_date <= d.promised_date ? 'var(--success)' : 'var(--warning)') }} />
                  <div className="dt-body">
                    <div className="dt-title">{d.material_name} — {d.qty_delivered} {d.unit}</div>
                    <div className="dt-sub">
                      Promised {new Date(d.promised_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} → Delivered {new Date(d.actual_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      {' · '}{d.actual_date <= d.promised_date ? 'On time' : 'Late'}
                    </div>
                  </div>
                </div>
              ))}
            </CardPad>
          </Card>
        </div>
        <Card style={{ height: 'fit-content' }}>
          <CardPad>
            <CardTitle>Quick Facts</CardTitle>
            <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, lineHeight: 2.2 }}>
              TOTAL ORDERS: <b style={{ fontFamily: 'var(--ff-body)' }}>{vendor.total_orders}</b><br />
              AVG LEAD TIME: <b style={{ fontFamily: 'var(--ff-body)' }}>{vendor.avg_lead_time_days ?? '—'} days</b><br />
              MATERIALS SUPPLIED: <b style={{ fontFamily: 'var(--ff-body)' }}>{vendor.materials_supplied.join(', ')}</b><br />
              LAST DELIVERY: <b style={{ fontFamily: 'var(--ff-body)' }}>{vendor.last_delivery ? new Date(vendor.last_delivery).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</b>
            </div>
          </CardPad>
        </Card>
      </div>
    </div>
  );
}
