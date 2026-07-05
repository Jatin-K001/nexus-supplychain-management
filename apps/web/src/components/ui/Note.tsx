import { ReactNode } from 'react';

type Tone = 'info' | 'accent' | 'success' | 'warning' | 'danger' | 'teal';

export function Note({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <div className={`note note-${tone}`}>{children}</div>;
}

export function NoteText({ tone, children, bold = false }: { tone: Tone; children: ReactNode; bold?: boolean }) {
  return (
    <div className={`note-text ${tone}`} style={bold ? { fontWeight: 700, marginBottom: 3 } : undefined}>
      {children}
    </div>
  );
}
