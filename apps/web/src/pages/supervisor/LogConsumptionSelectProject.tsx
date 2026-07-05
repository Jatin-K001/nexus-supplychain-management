import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StepsRow } from '../../components/ui/StepsRow';

interface Project { id: string; name: string; city: string; }

const STEPS = [{ label: 'Project' }, { label: 'Phase' }, { label: 'Subphase' }];

export function LogConsumptionSelectProject() {
  const { data: projects } = useQuery<Project[]>({ queryKey: ['my-projects'], queryFn: () => api.get('/api/projects') });

  return (
    <div>
      <div className="header-row">
        <div>
          <div className="section-title">Log Consumption</div>
          <div className="section-sub">STEP 1 OF 4 · SELECT PROJECT</div>
        </div>
      </div>
      <StepsRow steps={STEPS} currentIndex={0} />
      <Card>
        <table className="data-table">
          <thead><tr><th>Project</th><th>Site</th><th></th></tr></thead>
          <tbody>
            {(projects ?? []).map((p) => (
              <tr key={p.id}>
                <td className="td-name">{p.name}</td>
                <td className="td-sub">{p.city}</td>
                <td><Link to={`/supervisor/log-consumption/${p.id}`}><Button size="sm">Select →</Button></Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
