import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { SubphaseListCard, SubphaseRow } from '../../components/domain/SubphaseListCard';

export function PmPhaseDetail() {
  const { phaseId } = useParams();
  const { data: subphases } = useQuery<SubphaseRow[]>({
    queryKey: ['phase-subphases', phaseId],
    queryFn: () => api.get(`/api/phases/${phaseId}/subphases`),
  });

  const complete = (subphases ?? []).filter((s) => s.status === 'complete').length;
  const total = subphases?.length ?? 0;
  const pct = total ? Math.round((complete / total) * 100) : 0;

  return (
    <div>
      <Breadcrumb parts={['PROJECTS', 'PHASE — SUBPHASES']} />
      <div className="header-row">
        <div>
          <div className="section-title">Subphase Progress</div>
          <div className="section-sub">READ-ONLY VIEW</div>
        </div>
        <span className="badge badge-progress" style={{ fontSize: 11, padding: '5px 10px' }}>{complete} of {total} complete</span>
      </div>
      <div className="prog-track" style={{ marginBottom: 20 }}>
        <div className="prog-fill" style={{ width: `${pct}%` }} />
      </div>
      <SubphaseListCard subphases={subphases ?? []} />
    </div>
  );
}
