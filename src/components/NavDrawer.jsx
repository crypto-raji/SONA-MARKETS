import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useNavDrawer } from '../context/NavDrawerContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: '⌂' },
  { to: '/swap', label: 'Trade', icon: '⇄' },
  { to: '/ai-assistant', label: 'Sona AI', icon: '✦' },
  { to: '/portfolio', label: 'Portfolio', icon: '◔' },
  { to: '/profile', label: 'Profile', icon: '●' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

/**
 * Mobile navigation drawer: opens as an overlay ON TOP of the current page
 * (fixed position + backdrop) rather than pushing content aside. Only
 * rendered/relevant below the desktop breakpoint — see .nav-drawer-* rules
 * in responsive.css, which is also where the hamburger trigger in Header
 * is shown/hidden. Desktop keeps the persistent Sidebar and never uses this.
 */
export default function NavDrawer() {
  const { open, closeDrawer } = useNavDrawer();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  if (!open) return null;

  const handleLogout = async () => {
    await signOut();
    closeDrawer();
    navigate('/');
  };

  return (
    <div className="nav-drawer-overlay" onClick={closeDrawer} role="presentation">
      <div
        className="nav-drawer-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div className="nav-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <img src="/assets/logo-192.png" alt="Sona logo" width={32} height={32} style={{ borderRadius: 9, display: 'block' }} />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, color: '#F1F3F7' }}>Sona</span>
          </div>
          <button className="nav-drawer-close" onClick={closeDrawer} aria-label="Close menu">✕</button>
        </div>

        <nav className="nav-drawer-list">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={closeDrawer}
              className={({ isActive }) => `nav-drawer-item${isActive ? ' active' : ''}`}
            >
              <span className="nav-drawer-item-icon" aria-hidden="true">{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              <span aria-hidden="true">›</span>
            </NavLink>
          ))}
        </nav>

        <div className="nav-drawer-divider" />

        <button className="nav-drawer-item nav-drawer-logout" onClick={handleLogout}>
          <span className="nav-drawer-item-icon" aria-hidden="true">⇥</span>
          <span style={{ flex: 1, textAlign: 'left' }}>Logout</span>
        </button>

        <svg className="nav-drawer-wave" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0,80 C80,120 160,40 240,70 C320,100 360,60 400,80 L400,120 L0,120 Z" fill="rgba(108,140,255,0.12)" />
          <path d="M0,95 C90,60 180,110 260,85 C330,65 370,95 400,90 L400,120 L0,120 Z" fill="rgba(108,140,255,0.08)" />
        </svg>
      </div>
    </div>
  );
}
