import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card, CardPad, CardTitle } from '../../components/ui/Card';
import { Note, NoteText } from '../../components/ui/Note';
import { EmptyState } from '../../components/ui/EmptyState';

interface DelayPattern {
  phase_name: string;
  cause: string;
  occurrence_count: number;
  avg_delay_days: string;
}

export function PmReports() {
  const { data: patterns } = useQuery<DelayPattern[]>({
    queryKey: ['delay-patterns'],
    queryFn: () => api.get('/api/dashboard/delay-patterns'),
  });

  const topPattern = patterns?.[0];

  return (
    <div>
      <div className="header-row">
        <div>
          <div className="section-title">Reports</div>
          <div className="section-sub">CROSS-PROJECT PATTERNS · READ-ONLY</div>
        </div>
      </div>

      <Card className="mb-4">
        <CardPad>
          <CardTitle>Historical Delay Pattern Analysis</CardTitle>
          {!patterns?.length ? (
            <EmptyState icon="📊" title="No patterns yet" subtitle="Delay history builds up here as subphases finish late across projects." />
          ) : (
            <table className="data-table">
              <thead><tr><th>Phase</th><th>Cause</th><th>Occurrences</th><th>Avg Delay</th></tr></thead>
              <tbody>
                {patterns.map((p, i) => (
                  <tr key={i}>
                    <td className="td-name">{p.phase_name}</td>
                    <td className="td-sub">{p.cause}</td>
                    <td className="td-mono">{p.occurrence_count}</td>
                    <td className="td-mono">{p.avg_delay_days} days</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardPad>
      </Card>

      {topPattern && (
        <Note tone="teal">
          <NoteText tone="teal">
            <b>Buffer Recommendation:</b> {topPattern.phase_name} has delayed {topPattern.occurrence_count}x historically
            (avg cause: {topPattern.cause}, {topPattern.avg_delay_days} days) — consider adding buffer in future project templates.
          </NoteText>
        </Note>
      )}
    </div>
  );
}
