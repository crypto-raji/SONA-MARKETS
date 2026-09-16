import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import WalletModal from './WalletModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { truncateAddress } from '../utils/format.js';

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: '⌂' },
  { to: '/markets', label: 'Markets', icon: '≡' },
  { to: '/swap', label: 'Trade', icon: '⇄' },
  { to: '/portfolio', label: 'Portfolio', icon: '◔' },
  { to: '/ai-assistant', label: 'Sona AI', icon: '✦' },
  { to: '/transactions', label: 'Transactions', icon: '↔' },
  { to: '/profile', label: 'Profile', icon: '●' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

const navLinkStyle = ({ isActive }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  padding: '10px var(--space-3)',
  borderRadius: 'var(--radius-md)',
  fontSize: 14,
  fontWeight: isActive ? 600 : 500,
  color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
  background: isActive ? 'var(--color-accent-soft)' : 'transparent',
});

export default function Sidebar() {
  const { user, signOut } = useAuth();
  const [walletOpen, setWalletOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <>
      <aside
        className="sidebar-nav"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: 'var(--sidebar-width)',
          borderRight: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          padding: 'var(--space-5) var(--space-4)',
          gap: 'var(--space-4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: '0 var(--space-2)' }}>
          <img
            src="/assets/logo-192.png"
            alt="Sona logo"
            width={32}
            height={32}
            style={{ borderRadius: 9, display: 'block' }}
          />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17 }}>Sona</span>
        </div>

        <nav className="scroll-hide" style={{ display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} style={navLinkStyle}>
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}

          <div style={{ height: 1, background: 'var(--color-border)', margin: 'var(--space-2) var(--space-2)' }} />

          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
              padding: '10px var(--space-3)', borderRadius: 'var(--radius-md)',
              fontSize: 14, fontWeight: 500, color: 'var(--color-negative)', textAlign: 'left', width: '100%',
            }}
          >
            <span aria-hidden="true">⇥</span>
            Logout
          </button>
        </nav>

        <button className="btn btn-primary btn-block" onClick={() => setWalletOpen(true)} style={{ flexShrink: 0 }}>
          {user?.walletAddress ? truncateAddress(user.walletAddress) : 'Connect Wallet'}
        </button>
      </aside>
      <WalletModal open={walletOpen} onClose={() => setWalletOpen(false)} />
    </>
  );
}
