import type { Role } from '@nexus/shared-types';

export interface NavItem {
  label: string;
  path: string;
}

// Exact nav lists + order from nexus_master_reference_1.html's sidebars.
export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  pm: [
    { label: 'Dashboard', path: '/pm/dashboard' },
    { label: 'Projects', path: '/pm/projects' },
    { label: 'Stock Requests', path: '/pm/stock-requests' },
    { label: 'Reports', path: '/pm/reports' },
    { label: 'New Project Setup', path: '/pm/new-project' },
  ],
  supervisor: [
    { label: 'Home', path: '/supervisor/home' },
    { label: 'Projects', path: '/supervisor/projects' },
    { label: 'Log Consumption', path: '/supervisor/log-consumption' },
    { label: 'Alerts', path: '/supervisor/alerts' },
  ],
  procurement: [
    { label: 'Stock Requests', path: '/procurement/stock-requests' },
    { label: 'Vendor Management', path: '/procurement/vendors' },
    { label: 'Log Delivery', path: '/procurement/log-delivery' },
  ],
};

export const ROLE_LABEL: Record<Role, string> = {
  pm: 'PROJECT MANAGER',
  supervisor: 'SITE SUPERVISOR',
  procurement: 'PROCUREMENT',
};

export const ROLE_AVATAR_COLOR: Record<Role, string> = {
  pm: 'var(--accent)',
  supervisor: 'var(--info)',
  procurement: 'var(--teal)',
};

export const ROLE_DEFAULT_PATH: Record<Role, string> = {
  pm: '/pm/dashboard',
  supervisor: '/supervisor/home',
  procurement: '/procurement/stock-requests',
};
