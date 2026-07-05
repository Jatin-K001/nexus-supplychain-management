import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Note, NoteText } from '../../components/ui/Note';

interface Project { id: string; name: string; city: string; }

export function SupervisorMyProjects() {
  const { data: projects } = useQuery<Project[]>({ queryKey: ['my-projects'], queryFn: () => api.get('/api/projects') });

  return (
    <div>
      <div className="header-row">
        <div>
          <div className="section-title">My Projects</div>
          <div className="section-sub">ASSIGNED TO YOU ONLY · {projects?.length ?? 0} PROJECTS</div>
        </div>
      </div>
      <Card>
        <table className="data-table">
          <thead><tr><th>Project</th><th>Site</th><th></th></tr></thead>
          <tbody>
            {(projects ?? []).map((p) => (
              <tr key={p.id}>
                <td className="td-name">{p.name}</td>
                <td className="td-sub">{p.city}</td>
                <td><Link to={`/supervisor/projects/${p.id}`}><Button size="sm">Open →</Button></Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div style={{ marginTop: 16 }}>
        <Note tone="info">
          <NoteText tone="info">Only projects and sites you're assigned to appear here — unlike the Project Manager, who sees all projects company-wide.</NoteText>
        </Note>
      </div>
    </div>
  );
}
