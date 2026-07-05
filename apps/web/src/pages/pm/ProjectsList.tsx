import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

interface Project {
  id: string;
  name: string;
  city: string;
  target_end_date: string;
  projected_end_date: string;
  status: string;
}

const STATUS_BADGE: Record<string, string> = {
  delayed: 'danger', at_risk: 'warning', on_track: 'complete',
  not_started: 'locked', nearly_complete: 'teal', complete: 'complete',
};
const STATUS_LABEL: Record<string, string> = {
  delayed: 'Delayed', at_risk: 'At Risk', on_track: 'On Track',
  not_started: 'Not Started', nearly_complete: 'Nearly Complete', complete: 'Complete',
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function PmProjectsList() {
  const { data: projects } = useQuery<Project[]>({ queryKey: ['projects'], queryFn: () => api.get('/api/projects') });
  const active = (projects ?? []).filter((p) => p.status !== 'complete').length;
  const completed = (projects ?? []).filter((p) => p.status === 'complete').length;

  return (
    <div>
      <div className="header-row">
        <div>
          <div className="section-title">Projects</div>
          <div className="section-sub">{active} ACTIVE · {completed} COMPLETED</div>
        </div>
        <Link to="/pm/new-project"><Button>+ New Project</Button></Link>
      </div>
      <Card>
        <table className="data-table">
          <thead>
            <tr><th>Project</th><th>Site</th><th>Target End</th><th>Projected End</th><th>Status</th></tr>
          </thead>
          <tbody>
            {(projects ?? []).map((p) => (
              <tr key={p.id}>
                <td className="td-name"><Link to={`/pm/projects/${p.id}`}>{p.name}</Link></td>
                <td className="td-sub">{p.city}</td>
                <td className="td-mono">{fmtDate(p.target_end_date)}</td>
                <td className="td-mono">{fmtDate(p.projected_end_date)}</td>
                <td><span className={`badge badge-${STATUS_BADGE[p.status] ?? 'locked'}`}>{STATUS_LABEL[p.status] ?? p.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
