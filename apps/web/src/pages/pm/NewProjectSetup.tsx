import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { PHASE_TEMPLATE_SUMMARY } from '../../components/domain/phaseTemplateSummary';
import { useToast } from '../../lib/ToastContext';
import { useConfirm } from '../../lib/ConfirmContext';

interface Site { id: string; name: string; city: string; }

export function PmNewProjectSetup() {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { data: sites } = useQuery<Site[]>({ queryKey: ['sites'], queryFn: () => api.get('/api/sites') });
  const [name, setName] = useState('');
  const [siteId, setSiteId] = useState('');
  const [dailyCost, setDailyCost] = useState('60000');
  const [targetEnd, setTargetEnd] = useState('');
  const [expanded, setExpanded] = useState<number | null>(3);
  const [submitting, setSubmitting] = useState(false);

  const create = async () => {
    if (!name || !siteId || !targetEnd) {
      toast.error('Project name, site, and target end date are all required.');
      return;
    }
    const ok = await confirm({
      title: 'Create this project?',
      message: `"${name}" will be created with the full 10-phase/97-subphase template, auto-assigned to the site supervisor. This can't be undone from here.`,
      confirmLabel: 'Create Project',
    });
    if (!ok) return;

    setSubmitting(true);
    try {
      const project = await api.post('/api/projects', {
        name, site_id: siteId,
        start_date: new Date().toISOString().slice(0, 10),
        target_end_date: targetEnd,
        daily_cost_estimate: Number(dailyCost),
      });
      toast.success(`"${name}" created — 10 phases, 97 subphases, ready to go.`);
      navigate(`/pm/projects/${project.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="header-row">
        <div>
          <div className="section-title">New Project Setup</div>
          <div className="section-sub">STANDARD 10-PHASE TEMPLATE · 97 SUBPHASES</div>
        </div>
      </div>

      <div className="two-col-even" style={{ marginTop: 0, marginBottom: 16 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Project Name</label>
          <input className="form-input" placeholder="Tower C — Structural" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Daily Cost Estimate (₹)</label>
          <input className="form-input" value={dailyCost} onChange={(e) => setDailyCost(e.target.value)} />
        </div>
      </div>
      <div className="two-col-even">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Site</label>
          <select className="form-input" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            <option value="">Select site…</option>
            {(sites ?? []).map((s) => <option key={s.id} value={s.id}>{s.name} — {s.city}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Target End Date</label>
          <input className="form-input" type="date" value={targetEnd} onChange={(e) => setTargetEnd(e.target.value)} />
        </div>
      </div>

      <Card className="mt-4">
        {PHASE_TEMPLATE_SUMMARY.map((phase) => (
          <div key={phase.no}>
            <div
              className={`accordion-row ${expanded === phase.no ? 'expanded' : ''}`}
              onClick={() => setExpanded(expanded === phase.no ? null : phase.no)}
              style={{ cursor: 'pointer' }}
            >
              <div className="phase-num-pill">{phase.no}</div>
              <div style={{ flex: 1 }}>
                <div className="td-name">{phase.name}</div>
                <div className="td-sub">{phase.subphaseCount} subphases</div>
              </div>
              <span className={`badge badge-${phase.badge}`}>{phase.unlockLabel}</span>
            </div>
            {expanded === phase.no && (
              <div className="accordion-expanded-content">
                <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                  Full subphase list for {phase.name} loads once the project is created — this template is pre-wired with dependencies and unlock types (§2).
                </div>
              </div>
            )}
          </div>
        ))}
      </Card>
      <Button style={{ marginTop: 16 }} onClick={create} loading={submitting}>
        {submitting ? 'Creating…' : 'Create Project'}
      </Button>
    </div>
  );
}
