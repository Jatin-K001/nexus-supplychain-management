import { NavLink } from 'react-router-dom';
import type { Role } from '@nexus/shared-types';
import { NAV_BY_ROLE, ROLE_LABEL, ROLE_AVATAR_COLOR } from './navConfig';
import { useAuth } from '../../lib/AuthContext';

function initials(fullName: string) {
  return fullName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

export function Sidebar({ role }: { role: Role }) {
  const { profile, signOut } = useAuth();
  const items = NAV_BY_ROLE[role];

  return (
    <div className="laptop-sidebar" style={{ height: '100vh', position: 'sticky', top: 0 }}>
      <div className="sidebar-logo">
        <span className="sn1">Nex</span>
        <span className="sn2">us</span>
      </div>
      <div className="sidebar-nav">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
          >
            <div className="dot" />
            {item.label}
          </NavLink>
        ))}
      </div>
      <div className="sidebar-bottom">
        <div className="sidebar-avatar">
          <div className="av-circle" style={{ background: ROLE_AVATAR_COLOR[role] }}>
            {profile ? initials(profile.full_name) : '..'}
          </div>
          <div>
            <div className="av-name">{profile?.full_name ?? ''}</div>
            <div className="av-role">{ROLE_LABEL[role]}</div>
          </div>
        </div>
        <button
          onClick={() => signOut()}
          className="sidebar-item"
          style={{ marginTop: 8, cursor: 'pointer', border: 'none', background: 'none', width: '100%', textAlign: 'left' }}
        >
          <div className="dot" />
          Sign out
        </button>
      </div>
    </div>
  );
}
