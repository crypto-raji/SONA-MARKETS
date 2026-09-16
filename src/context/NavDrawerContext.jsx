import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const NavDrawerContext = createContext(null);

/**
 * Drives the mobile navigation drawer (hamburger overlay). Separate from
 * the desktop Sidebar entirely — on mobile there is no persistent nav
 * chrome, so Header triggers this via the hamburger button, and the
 * drawer itself renders once at the app root so it can overlay all page
 * content rather than being scoped to whichever page happens to render it.
 */
export function NavDrawerProvider({ children }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Safety net: always close on navigation, even if a caller forgets to.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const openDrawer = useCallback(() => setOpen(true), []);
  const closeDrawer = useCallback(() => setOpen(false), []);
  const toggleDrawer = useCallback(() => setOpen((o) => !o), []);

  return (
    <NavDrawerContext.Provider value={{ open, openDrawer, closeDrawer, toggleDrawer }}>
      {children}
    </NavDrawerContext.Provider>
  );
}

export function useNavDrawer() {
  const ctx = useContext(NavDrawerContext);
  if (!ctx) throw new Error('useNavDrawer must be used within NavDrawerProvider');
  return ctx;
}
