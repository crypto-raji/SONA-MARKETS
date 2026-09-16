import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useBalanceVisibility } from '../context/BalanceVisibilityContext.jsx';
import { useNavDrawer } from '../context/NavDrawerContext.jsx';
import SearchModal from './SearchModal.jsx';

export default function Header({ title }) {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { hidden, toggle: toggleBalance } = useBalanceVisibility();
  const { toggleDrawer } = useNavDrawer();
  const [searchOpen, setSearchOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <header className="app-header">
      <div className="header-left">
        <button className="hamburger-btn" onClick={toggleDrawer} aria-label="Open menu">
          ☰
        </button>
        <div className="header-brand">
          <img src="/assets/logo-192.png" alt="" width={28} height={28} style={{ borderRadius: 8, display: 'block' }} />
          <span>Sona</span>
        </div>
        <h1 className="header-page-title" style={{ fontSize: 18 }}>{title}</h1>
      </div>
      <div className="header-actions">
        <button
          className="pill pill-neutral header-balance-pill"
          onClick={toggleBalance}
          aria-label={hidden ? 'Show balance' : 'Hide balance'}
          style={{ border: 'none', cursor: 'pointer', flexShrink: 0 }}
        >
          <span aria-hidden="true">{hidden ? '◡' : '◉'}</span>{' '}
          <span className="header-balance-label">{hidden ? 'Show Balance' : 'Hide Balance'}</span>
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setSearchOpen(true)}
          aria-label="Search assets"
          style={{ flexShrink: 0 }}
        >
          <span aria-hidden="true">⌕</span> <span className="header-search-label">Search</span>
        </button>
        <button
          className="btn-ghost"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{ fontSize: 16, flexShrink: 0 }}
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
        <button
          className="btn-ghost"
          onClick={() => navigate('/profile')}
          aria-label="Open profile"
          style={{
            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
            background: 'var(--color-accent-soft)', color: 'var(--color-accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
          }}
        >
          {(user?.name || 'G').slice(0, 1)}
        </button>
      </div>
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
