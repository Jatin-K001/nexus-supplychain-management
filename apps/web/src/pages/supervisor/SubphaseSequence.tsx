import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { SubphaseListCard, SubphaseRow } from '../../components/domain/SubphaseListCard';

export function SupervisorSubphaseSequence() {
  const { phaseId } = useParams();
  const navigate = useNavigate();
  const { data: subphases } = useQuery<SubphaseRow[]>({
    queryKey: ['phase-subphases', phaseId],
    queryFn: () => api.get(`/api/phases/${phaseId}/subphases`),
  });

  return (
    <div>
      <Breadcrumb parts={['MY PROJECTS', 'PHASE — SUBPHASES']} />
      <div className="header-row">
        <div>
          <div className="section-title">Subphase Sequence</div>
          <div className="section-sub">UNLOCKS ONE AT A TIME · CLICK A ROW TO OPEN IT</div>
        </div>
      </div>
      <SubphaseListCard
        subphases={subphases ?? []}
        onRowClick={(s) => navigate(`/supervisor/subphases/${s.id}`)}
      />
    </div>
  );
}
