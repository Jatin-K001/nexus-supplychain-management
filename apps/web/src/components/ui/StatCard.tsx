type Tone = 'default' | 'danger' | 'success' | 'warning' | 'accent';

const stripClass: Record<Tone, string> = {
  default: '',
  danger: 'strip-danger',
  success: 'strip-success',
  warning: 'strip-warning',
  accent: 'strip-accent',
};

export function StatCard({
  label, value, sub, tone = 'default',
}: { label: string; value: string | number; sub?: string; tone?: Tone }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-num ${tone !== 'default' ? tone : ''}`}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
      <div className={`stat-strip ${stripClass[tone]}`} />
    </div>
  );
}
