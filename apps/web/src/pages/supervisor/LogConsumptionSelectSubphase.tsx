import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { StepsRow } from '../../components/ui/StepsRow';
import { Card } from '../../components/ui/Card';

interface MaterialInfo { material_name: string; quantity_required: string; }
interface SubphaseInfo { id: string; sequence: number; name: string; materials: MaterialInfo[]; }

const STEPS = [{ label: 'Project' }, { label: 'Phase' }, { label: 'Subphase' }];

function statusFor(sub: SubphaseInfo) {
  if (sub.materials.length === 0)
    return <span className="td-mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>Not set</span>;
  const count = sub.materials.length;
  return (
    <span className="badge badge-complete">
      {count} material{count !== 1 ? 's' : ''} set
    </span>
  );
}

export function LogConsumptionSelectSubphase() {
  const { projectId, phaseId } = useParams();
  const { data: subphases } = useQuery<SubphaseInfo[]>({
    queryKey: ['phase-subphases-materials', phaseId],
    queryFn: () => api.get(`/api/phases/${phaseId}/subphases-with-materials`),
  });

  return (
    <div>
      <Breadcrumb parts={['LOG CONSUMPTION', 'PROJECT', 'PHASE']} />
      <div className="header-row">
        <div>
          <div className="section-title">Select Subphase</div>
          <div className="section-sub">STEP 3 OF 3 · ALL SUBPHASES</div>
        </div>
      </div>
      <StepsRow steps={STEPS} currentIndex={2} />
      <Card>
        <div style={{ padding: '4px 20px' }}>
          {(subphases ?? []).map((sub) => (
            <Link
              key={sub.id}
              to={`/supervisor/log-consumption/${projectId}/${phaseId}/${sub.id}`}
              className="subphase-row"
              style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
            >
              <span className="sub-num">{String(sub.sequence).padStart(2, '0')}</span>
              <span className="sub-name">{sub.name}</span>
              {statusFor(sub)}
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
