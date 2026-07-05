import { createContext, useContext, useState, ReactNode } from 'react';
import { Button } from '../components/ui/Button';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: 'primary' | 'danger';
}

type ConfirmApi = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmCtx = createContext<ConfirmApi | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ options: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);

  const confirm: ConfirmApi = (options) =>
    new Promise((resolve) => setState({ options, resolve }));

  const close = (result: boolean) => {
    state?.resolve(result);
    setState(null);
  };

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,17,30,0.5)', zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => close(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: 14, padding: 26, width: 400, maxWidth: '90vw',
              boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ fontFamily: 'var(--ff-head)', fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
              {state.options.title}
            </div>
            <div style={{ fontFamily: 'var(--ff-body)', fontSize: 13, color: 'var(--text-2)', marginTop: 8, lineHeight: 1.6 }}>
              {state.options.message}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
              <Button variant="ghost" onClick={() => close(false)}>Cancel</Button>
              <Button variant={state.options.tone === 'danger' ? 'danger' : 'primary'} onClick={() => close(true)}>
                {state.options.confirmLabel ?? 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}
