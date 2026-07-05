import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { StepsRow } from '../../components/ui/StepsRow';
import { Note, NoteText } from '../../components/ui/Note';
import { PhaseListCard, PhaseRow } from '../../components/domain/PhaseListCard';

const STEPS = [{ label: 'Project' }, { label: 'Phase' }, { label: 'Subphase' }];

export function LogConsumptionSelectPhase() {
  const { projectId } = useParams();
  const { data: phases } = useQuery<PhaseRow[]>({
    queryKey: ['project-phases', projectId],
    queryFn: () => api.get(`/api/projects/${projectId}/phases`),
  });

  return (
    <div>
      <Breadcrumb parts={['LOG CONSUMPTION', 'PROJECT']} />
      <div className="header-row">
        <div>
          <div className="section-title">Select Phase</div>
          <div className="section-sub">STEP 2 OF 4 · ALL 10 PHASES</div>
        </div>
      </div>
      <StepsRow steps={STEPS} currentIndex={1} />
      <PhaseListCard
        phases={phases ?? []}
        linkTo={(p) => `/supervisor/log-consumption/${projectId}/${p.id}`}
        highlightInProgress
        disableLocked
      />
      <div style={{ marginTop: 12 }}>
        <Note tone="info">
          <NoteText tone="info">Only unlocked phases (Complete or In Progress) are selectable — a locked phase has no subphases active yet to assign stock to.</NoteText>
        </Note>
      </div>
    </div>
  );
}
