import { ReactNode } from 'react';
import type { Role } from '@nexus/shared-types';
import { Sidebar } from './Sidebar';

export function AppShell({ role, children }: { role: Role; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar role={role} />
      <div className="laptop-content" style={{ flex: 1 }}>
        <div className="content-pad">{children}</div>
      </div>
    </div>
  );
}
