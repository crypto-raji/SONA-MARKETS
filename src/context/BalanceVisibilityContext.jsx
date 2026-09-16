import React, { createContext, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'sona-balance-hidden';
const BalanceVisibilityContext = createContext(null);

/**
 * Lets the user hide dollar amounts/quantities across the app (e.g. over
 * someone's shoulder) without signing out. Purely a display preference —
 * it never affects what data is fetched or held in state.
 */
export function BalanceVisibilityProvider({ children }) {
  const [hidden, setHidden] = useState(() => window.localStorage.getItem(STORAGE_KEY) === 'true');

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, String(hidden));
  }, [hidden]);

  const toggle = () => setHidden((h) => !h);

  return (
    <BalanceVisibilityContext.Provider value={{ hidden, toggle }}>
      {children}
    </BalanceVisibilityContext.Provider>
  );
}

export function useBalanceVisibility() {
  const ctx = useContext(BalanceVisibilityContext);
  if (!ctx) throw new Error('useBalanceVisibility must be used within BalanceVisibilityProvider');
  return ctx;
}

/** Renders `value` normally, or a fixed-width mask when balances are hidden. */
export function Masked({ hidden, children }) {
  if (!hidden) return children;
  return <span aria-label="Hidden">••••••</span>;
}
