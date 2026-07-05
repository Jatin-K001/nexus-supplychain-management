import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { PhaseListCard, PhaseRow } from '../../components/domain/PhaseListCard';

interface Project { id: string; name: string; city: string; }

export function PmProjectDetail() {
  const { projectId } = useParams();
  const { data: project } = useQuery<Project>({
    queryKey: ['project', projectId],
    queryFn: () => api.get(`/api/projects/${projectId}`),
  });
  const { data: phases } = useQuery<PhaseRow[]>({
    queryKey: ['project-phases', projectId],
    queryFn: () => api.get(`/api/projects/${projectId}/phases`),
  });

  return (
    <div>
      <Breadcrumb parts={['PROJECTS', project?.name?.toUpperCase() ?? '']} />
      <div className="header-row">
        <div>
          <div className="section-title">{project?.name}</div>
          <div className="section-sub">{project?.city?.toUpperCase()} SITE · ALL 10 PHASES</div>
        </div>
      </div>
      <PhaseListCard
        phases={phases ?? []}
        linkTo={(p) => `/pm/projects/${projectId}/phases/${p.id}`}
        highlightInProgress
        disableLocked
      />
    </div>
  );
}
