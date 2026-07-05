import { createContext, useCallback, useContext, useState, ReactNode } from 'react';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem { id: number; kind: ToastKind; message: string; }

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastCtx = createContext<ToastApi | null>(null);

const KIND_STYLE: Record<ToastKind, { bg: string; border: string; icon: string }> = {
  success: { bg: 'var(--success-fill)', border: 'var(--success)', icon: '✓' },
  error: { bg: 'var(--danger-fill)', border: 'var(--danger)', icon: '✕' },
  info: { bg: 'var(--info-fill)', border: 'var(--info)', icon: 'ℹ' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  const api: ToastApi = {
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    info: (m) => push('info', m),
  };

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 9999,
          display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 380,
        }}
      >
        {items.map((t) => {
          const style = KIND_STYLE[t.kind];
          return (
            <div
              key={t.id}
              style={{
                background: 'white', border: `1px solid var(--border)`, borderLeft: `4px solid ${style.border}`,
                borderRadius: 10, padding: '12px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                display: 'flex', gap: 10, alignItems: 'flex-start',
                animation: 'nexus-toast-in 0.2s ease-out',
              }}
            >
              <div
                style={{
                  width: 20, height: 20, borderRadius: '50%', background: style.bg, color: style.border,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
                  flexShrink: 0, marginTop: 1,
                }}
              >
                {style.icon}
              </div>
              <div style={{ fontFamily: 'var(--ff-body)', fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>
                {t.message}
              </div>
            </div>
          );
        })}
      </div>
      <style>{`@keyframes nexus-toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
