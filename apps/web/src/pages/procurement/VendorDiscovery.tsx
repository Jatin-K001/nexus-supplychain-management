import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Note, NoteText } from '../../components/ui/Note';

interface StockRequestDetail {
  id: string; material_id: string; material_name: string; quantity: string; subphase_name: string;
}
interface VendorCompareRow {
  vendor_id: string; vendor_name: string; reliability_score: number;
  latest_price: string; predicted_lead_time_days: number;
}
interface Material { id: string; name: string; unit: string; }

export function ProcurementVendorDiscovery() {
  const { stockRequestId, materialId: directMaterialId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Support two entry points:
  // 1. From StockRequestsInbox: /procurement/vendors/discover/:stockRequestId
  // 2. From MaterialRequirements: /procurement/vendors/discover-material/:materialId?qty=X&subphaseId=Y
  const directQty = searchParams.get('qty');
  const directSubphaseId = searchParams.get('subphaseId');

  const { data: sr } = useQuery<StockRequestDetail>({
    queryKey: ['stock-request', stockRequestId],
    queryFn: () => api.get(`/api/stock-requests/${stockRequestId}`),
    enabled: !!stockRequestId,
  });

  const { data: material } = useQuery<Material>({
    queryKey: ['material', directMaterialId],
    queryFn: () => api.get(`/api/materials/${directMaterialId}`),
    enabled: !!directMaterialId && !stockRequestId,
  });

  // Resolve which material we're working with
  const resolvedMaterialId = sr?.material_id ?? directMaterialId;
  const resolvedMaterialName = sr?.material_name ?? material?.name ?? '';
  const resolvedQty = sr?.quantity ?? directQty ?? '';
  const resolvedSubphaseName = sr?.subphase_name ?? (directSubphaseId ? `Subphase ${directSubphaseId}` : '');

  const { data: vendors } = useQuery<VendorCompareRow[]>({
    queryKey: ['vendor-compare', resolvedMaterialId],
    queryFn: () => api.get(`/api/vendors/compare/${resolvedMaterialId}`),
    enabled: !!resolvedMaterialId,
  });

  if (!resolvedMaterialId) return null;

  const buildCompareUrl = (vendorId?: string) => {
    const base = `/procurement/vendors/compare/${resolvedMaterialId}`;
    const params = new URLSearchParams();
    if (stockRequestId) params.set('stockRequestId', stockRequestId);
    if (directSubphaseId) params.set('subphaseId', directSubphaseId);
    if (directQty) params.set('qty', directQty);
    if (vendorId) params.set('preselect', vendorId);
    return `${base}?${params.toString()}`;
  };

  return (
    <div>
      <Note tone="teal">
        <NoteText tone="teal">
          <b>Sourcing material</b> — {resolvedMaterialName}
          {resolvedQty && ` · ${resolvedQty} units needed`}
          {resolvedSubphaseName && ` · for ${resolvedSubphaseName}`}
        </NoteText>
      </Note>
      <div className="header-row">
        <div>
          <div className="section-title">Vendors Supplying This Material</div>
          <div className="section-sub">{vendors?.length ?? 0} VENDORS FOUND</div>
        </div>
      </div>
      <Card>
        <table className="data-table">
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Reliability</th>
              <th>Price / Unit</th>
              <th>Avg Lead Time</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(vendors ?? []).map((v) => (
              <tr key={v.vendor_id}>
                <td className="td-name">{v.vendor_name}</td>
                <td className="td-mono">{v.reliability_score}</td>
                <td className="td-mono">₹{v.latest_price}</td>
                <td className="td-mono">{v.predicted_lead_time_days} days</td>
                <td>
                  <Button size="sm" variant="ghost" onClick={() => navigate(buildCompareUrl(v.vendor_id))}>
                    Compare →
                  </Button>
                </td>
              </tr>
            ))}
            {(vendors ?? []).length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: '#94A3B8' }}>
                  No vendors found for this material.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
      <Button style={{ marginTop: 14 }} onClick={() => navigate(buildCompareUrl())}>
        Compare All {vendors?.length ?? 0} Vendors →
      </Button>
    </div>
  );
}
