import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { ROLE_DEFAULT_PATH } from '../components/layout/navConfig';

const FEATURES = [
  { label: 'Demand Forecasting', desc: 'LSTM-driven shortfall prediction per material', color: 'var(--accent)' },
  { label: 'Vendor Reliability Scoring', desc: 'Live, recomputed after every delivery', color: 'var(--teal)' },
  { label: 'Delay Cascade Tracing', desc: 'Full dependency-graph impact, in real time', color: 'var(--info)' },
];

export function Login() {
  const { session, profile, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (session && profile) {
    return <Navigate to={ROLE_DEFAULT_PATH[profile.role]} replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg)' }}>
      {/* Left — brand story */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px 64px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -180,
            right: -180,
            width: 480,
            height: 480,
            borderRadius: '50%',
            background: 'radial-gradient(circle, var(--accent-fill) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <div style={{ position: 'relative' }}>
          <div className="page-logo" style={{ marginBottom: 28 }}>
            <span className="n1" style={{ color: 'var(--text)' }}>Nex</span>
            <span className="n2">us</span>
          </div>
          <div
            style={{
              fontFamily: 'var(--ff-body)',
              fontSize: 15,
              color: 'var(--text-2)',
              maxWidth: 380,
              lineHeight: 1.7,
              marginBottom: 40,
            }}
          >
            AI-driven supply chain intelligence for construction companies — demand forecasting,
            vendor scoring, and delay-cascade tracing in one system.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 380 }}>
            {FEATURES.map((f) => (
              <div key={f.label} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: 8, height: 8, borderRadius: '50%', background: f.color,
                    marginTop: 6, flexShrink: 0,
                  }}
                />
                <div>
                  <div style={{ fontFamily: 'var(--ff-head)', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                    {f.label}
                  </div>
                  <div style={{ fontFamily: 'var(--ff-body)', fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                    {f.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: 0.5, position: 'relative' }}>
          BUILDUNIX · SUPPLY CHAIN MODULE
        </div>
      </div>

      {/* Right — credential form */}
      <div
        style={{
          width: 420,
          background: 'var(--primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
        }}
      >
        <form
          onSubmit={onSubmit}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16,
            padding: 36,
            width: '100%',
            maxWidth: 340,
            boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
          }}
        >
          <div style={{ fontFamily: 'var(--ff-head)', fontSize: 20, fontWeight: 700, color: 'white', marginBottom: 6 }}>
            Sign in to Nexus
          </div>
          <div
            style={{
              fontFamily: 'var(--ff-mono)', fontSize: 9.5, color: 'var(--dark-text-muted)',
              marginBottom: 26, letterSpacing: 0.5,
            }}
          >
            ROLE DETECTED AUTOMATICALLY ON SIGN-IN
          </div>

          <div className="form-group">
            <label className="form-label" style={{ color: 'var(--dark-text-2)' }}>Email</label>
            <input
              className="form-input"
              style={{
                background: 'var(--dark-elevated)', borderColor: 'var(--dark-border)', color: 'white',
                transition: 'border-color 0.15s',
              }}
              placeholder="you@nexus.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--dark-border)')}
              type="email"
              autoFocus
              required
            />
          </div>
          <div className="form-group" style={{ marginBottom: 6 }}>
            <label className="form-label" style={{ color: 'var(--dark-text-2)' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                style={{
                  background: 'var(--dark-elevated)', borderColor: 'var(--dark-border)', color: 'white',
                  paddingRight: 52, transition: 'border-color 0.15s',
                }}
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--dark-border)')}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--dark-text-muted)',
                  letterSpacing: 0.5,
                }}
              >
                {showPassword ? 'HIDE' : 'SHOW'}
              </button>
            </div>
          </div>

          <div style={{ minHeight: 20, marginTop: 8 }}>
            {error && (
              <div style={{ color: 'var(--accent-light)', fontSize: 12, fontFamily: 'var(--ff-body)' }}>
                {error}
              </div>
            )}
          </div>

          <button
            className="login-btn"
            type="submit"
            disabled={submitting}
            style={{
              marginTop: 8,
              opacity: submitting ? 0.7 : 1,
              cursor: submitting ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'opacity 0.15s, transform 0.1s',
            }}
            onMouseDown={(e) => !submitting && (e.currentTarget.style.transform = 'scale(0.98)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            {submitting && (
              <span
                style={{
                  width: 14, height: 14, borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white',
                  display: 'inline-block', animation: 'nexus-spin 0.7s linear infinite',
                }}
              />
            )}
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
      <style>{`@keyframes nexus-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
