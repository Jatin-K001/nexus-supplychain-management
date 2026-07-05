import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useState, useEffect } from 'react';

interface Project { id: string; name: string; city: string; site_name: string; }
interface Phase { id: string; template_phase_no: number; name: string; status: string; }
interface Subphase {
  id: string; sequence: number; name: string; status: string;
  planned_start: string | null; planned_end: string | null; actual_end: string | null;
}
interface Notification {
  id: string; type: string; message: string; read_at: string | null; created_at: string;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'Yesterday' : `${d}d ago`;
}
function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function isOverdue(d: string | null) {
  if (!d) return false;
  return new Date(d) < new Date();
}

const NOTIF_ICON: Record<string, string> = {
  stock_request: '📦', order_status: '🚚', phase_unlock: '🔓',
  delay_logged: '⚠️', vendor_risk: '📉',
};

export function SupervisorHome() {
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const queryClient = useQueryClient();

  const { data: projects } = useQuery<Project[]>({
    queryKey: ['my-projects'],
    queryFn: () => api.get('/api/projects'),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  const primary = projects?.[0];

  const { data: phases } = useQuery<Phase[]>({
    queryKey: ['project-phases', primary?.id],
    queryFn: () => api.get(`/api/projects/${primary!.id}/phases`),
    enabled: !!primary,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const currentPhase = phases?.find((p) => p.status === 'in_progress');

  const { data: subphases, dataUpdatedAt } = useQuery<Subphase[]>({
    queryKey: ['phase-subphases', currentPhase?.id],
    queryFn: () => api.get(`/api/phases/${currentPhase!.id}/subphases`),
    enabled: !!currentPhase,
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
  });

  const { data: notifications } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: () => api.get('/api/notifications'),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (dataUpdatedAt) setLastUpdated(new Date(dataUpdatedAt));
  }, [dataUpdatedAt]);

  const refreshAll = () => {
    queryClient.invalidateQueries();
    setLastUpdated(new Date());
  };

  // ── Derived data ────────────────────────────────────────────────────────
  const inProgress = subphases?.filter((s) => s.status === 'in_progress') ?? [];
  const readyToStart = subphases?.filter((s) => s.status === 'available') ?? [];
  const unreadNotifs = notifications?.filter((n) => !n.read_at) ?? [];
  const recentNotifs = (notifications ?? []).slice(0, 6);

  if (!primary) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 40 }}>🏗️</div>
      <div style={{ fontFamily: 'var(--ff-head)', fontSize: 18, color: 'var(--text-2)' }}>No projects assigned yet</div>
      <div style={{ fontFamily: 'var(--ff-body)', fontSize: 13, color: 'var(--text-muted)' }}>Contact your Project Manager.</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* ── Context bar: who, where, what phase ─────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'var(--ff-head)', fontSize: 20, fontWeight: 800, color: '#0F172A' }}>
            {primary.name}
          </div>
          <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
            {primary.site_name?.toUpperCase()} · {primary.city?.toUpperCase()}
            {currentPhase && (
              <span style={{ marginLeft: 10, color: '#F59E0B' }}>
                ● PHASE {currentPhase.template_phase_no} — {currentPhase.name.toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {/* Live indicator + refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', animation: 'livePulse 2s ease-in-out infinite' }} />
            <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 9.5, color: '#94A3B8' }}>
              LIVE · {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
          <button onClick={refreshAll} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 6, cursor: 'pointer', fontFamily: 'var(--ff-mono)', fontSize: 9.5, color: '#475569' }}>
            <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
              <path d="M12.5 2.5A6 6 0 1 0 13 7" stroke="#475569" strokeWidth="1.6" strokeLinecap="round"/>
              <path d="M13 2.5v3.5h-3.5" stroke="#475569" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* ── SECTION 1: What I'm working on right now ─────────────────────── */}
      <div>
        <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: '#64748B', letterSpacing: 1, marginBottom: 10 }}>
          WORKING ON NOW
        </div>

        {inProgress.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #E8EDF5', borderRadius: 10, padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 28 }}>⏸️</div>
            <div>
              <div style={{ fontFamily: 'var(--ff-body)', fontSize: 14, fontWeight: 600, color: '#475569' }}>Nothing active right now</div>
              <div style={{ fontFamily: 'var(--ff-body)', fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
                {readyToStart.length > 0 ? `${readyToStart.length} subphase${readyToStart.length > 1 ? 's are' : ' is'} ready to start below.` : 'All subphases are locked or complete.'}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {inProgress.map((s) => {
              const overdue = isOverdue(s.planned_end);
              return (
                <Link key={s.id} to={`/supervisor/subphases/${s.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    background: '#fff',
                    border: `1.5px solid ${overdue ? '#FECACA' : '#FDE68A'}`,
                    borderLeft: `4px solid ${overdue ? '#DC2626' : '#F59E0B'}`,
                    borderRadius: 10,
                    padding: '16px 20px',
                    display: 'flex', alignItems: 'center', gap: 16,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  }}>
                    {/* Animated active indicator */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: overdue ? '#DC2626' : '#F59E0B' }} />
                      <div style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: `2px solid ${overdue ? '#FCA5A5' : '#FDE68A'}`, animation: 'ping 1.5s ease-out infinite' }} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: '#94A3B8' }}>
                          #{String(s.sequence).padStart(2, '0')}
                        </span>
                        <span style={{ fontFamily: 'var(--ff-head)', fontSize: 15, fontWeight: 700, color: '#0F172A' }}>
                          {s.name}
                        </span>
                      </div>
                      {s.planned_end && (
                        <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: overdue ? '#DC2626' : '#64748B' }}>
                          {overdue ? '⚠ OVERDUE · was due ' : 'Due '}{fmtDate(s.planned_end)}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, padding: '3px 9px', borderRadius: 5, background: overdue ? '#FEE2E2' : '#FEF3C7', color: overdue ? '#DC2626' : '#D97706', fontWeight: 600 }}>
                        {overdue ? 'OVERDUE' : 'IN PROGRESS'}
                      </span>
                      <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
                        <path d="M1 1l5 5-5 5" stroke="#CBD5E1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ── SECTION 2: Ready to start + Alerts — side by side ───────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {/* Ready to start */}
        <div style={{ background: '#fff', border: '1px solid #E8EDF5', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 18px', borderBottom: '1px solid #F1F5F9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: 'var(--ff-head)', fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Ready to Start</span>
              {readyToStart.length > 0 && (
                <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, background: '#EFF6FF', color: '#2563EB', padding: '2px 7px', borderRadius: 10, fontWeight: 600 }}>
                  {readyToStart.length}
                </span>
              )}
            </div>
            {currentPhase && (
              <Link to={`/supervisor/projects/${primary.id}/phases/${currentPhase.id}`} style={{ textDecoration: 'none' }}>
                <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, color: '#F96167' }}>VIEW ALL →</span>
              </Link>
            )}
          </div>

          {readyToStart.length === 0 ? (
            <div style={{ padding: '24px 18px', textAlign: 'center', color: '#94A3B8', fontFamily: 'var(--ff-body)', fontSize: 13 }}>
              No subphases ready to start.
            </div>
          ) : (
            readyToStart.slice(0, 5).map((s, i, arr) => (
              <Link key={s.id} to={`/supervisor/subphases/${s.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: i < arr.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3B82F6', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--ff-body)', fontSize: 12.5, fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: '#94A3B8', marginRight: 6 }}>{String(s.sequence).padStart(2, '0')}</span>
                    {s.name}
                  </div>
                  {s.planned_start && (
                    <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 9.5, color: '#94A3B8', marginTop: 2 }}>
                      Planned start: {fmtDate(s.planned_start)}
                    </div>
                  )}
                </div>
                <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, padding: '2px 7px', borderRadius: 4, background: '#EFF6FF', color: '#2563EB', fontWeight: 600, flexShrink: 0 }}>
                  READY
                </span>
                <svg width="6" height="10" viewBox="0 0 6 10" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M1 1l4 4-4 4" stroke="#CBD5E1" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
            ))
          )}
        </div>

        {/* Alerts */}
        <div style={{ background: '#fff', border: unreadNotifs.length > 0 ? '1px solid #FECACA' : '1px solid #E8EDF5', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 18px', borderBottom: '1px solid #F1F5F9', background: unreadNotifs.length > 0 ? '#FFF5F5' : undefined }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: 'var(--ff-head)', fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Alerts</span>
              {unreadNotifs.length > 0 && (
                <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, background: '#DC2626', color: '#fff', padding: '2px 7px', borderRadius: 10, fontWeight: 600 }}>
                  {unreadNotifs.length} new
                </span>
              )}
            </div>
            <Link to="/supervisor/alerts" style={{ textDecoration: 'none' }}>
              <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, color: '#F96167' }}>SEE ALL →</span>
            </Link>
          </div>

          {recentNotifs.length === 0 ? (
            <div style={{ padding: '24px 18px', textAlign: 'center', color: '#94A3B8', fontFamily: 'var(--ff-body)', fontSize: 13 }}>
              No alerts yet. You're all clear!
            </div>
          ) : (
            recentNotifs.map((n, i) => (
              <div key={n.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 11, padding: '11px 18px',
                borderBottom: i < recentNotifs.length - 1 ? '1px solid #F8FAFC' : 'none',
                background: !n.read_at ? '#FFFBF5' : undefined,
              }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: !n.read_at ? '#FEF3C7' : '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
                  {NOTIF_ICON[n.type] ?? '🔔'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--ff-body)', fontSize: 12, color: n.read_at ? '#64748B' : '#1E293B', fontWeight: n.read_at ? 400 : 600, lineHeight: 1.45 }}>
                    {n.message}
                  </div>
                  <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 9.5, color: '#94A3B8', marginTop: 3 }}>
                    {timeAgo(n.created_at)}
                  </div>
                </div>
                {!n.read_at && (
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#F59E0B', flexShrink: 0, marginTop: 5 }} />
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── SECTION 3: Quick Actions ─────────────────────────────────────── */}
      <div>
        <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: '#64748B', letterSpacing: 1, marginBottom: 10 }}>
          QUICK ACTIONS
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            {
              to: '/supervisor/log-consumption',
              icon: '📦',
              label: 'Set Material Requirements',
              desc: 'Update what each subphase needs',
              color: '#D97706', bg: '#FFFBEB', border: '#FDE68A',
            },
            {
              to: '/supervisor/my-projects',
              icon: '🏗️',
              label: 'My Projects',
              desc: `${projects?.length ?? 0} project${(projects?.length ?? 0) !== 1 ? 's' : ''} assigned to you`,
              color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE',
            },
            {
              to: '/supervisor/alerts',
              icon: '🔔',
              label: 'All Alerts',
              desc: unreadNotifs.length > 0 ? `${unreadNotifs.length} unread notification${unreadNotifs.length > 1 ? 's' : ''}` : 'No unread notifications',
              color: unreadNotifs.length > 0 ? '#DC2626' : '#16A34A',
              bg: unreadNotifs.length > 0 ? '#FFF5F5' : '#F0FDF4',
              border: unreadNotifs.length > 0 ? '#FECACA' : '#BBF7D0',
            },
          ].map(({ to, icon, label, desc, color, bg, border }) => (
            <Link key={to} to={to} style={{ textDecoration: 'none' }}>
              <div style={{
                background: bg, border: `1px solid ${border}`, borderRadius: 10,
                padding: '16px 18px', display: 'flex', alignItems: 'flex-start', gap: 12,
                cursor: 'pointer',
              }}>
                <div style={{ fontSize: 22, flexShrink: 0, lineHeight: 1 }}>{icon}</div>
                <div>
                  <div style={{ fontFamily: 'var(--ff-body)', fontSize: 13, fontWeight: 700, color }}>{label}</div>
                  <div style={{ fontFamily: 'var(--ff-body)', fontSize: 11.5, color: '#64748B', marginTop: 3, lineHeight: 1.4 }}>{desc}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes ping {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(2); opacity: 0; }
        }
        @keyframes livePulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(34,197,94,0.25); }
          50% { box-shadow: 0 0 0 6px rgba(34,197,94,0.06); }
        }
      `}</style>
    </div>
  );
}
