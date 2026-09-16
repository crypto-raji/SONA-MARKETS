import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as authService from '../services/authService.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Hard cap: always clear loading after 8s so a hanging network call
    // (e.g. ad blocker interfering with Firestore) never freezes the app.
    const safetyTimer = setTimeout(() => setLoading(false), 8000);

    const unsubscribe = authService.onAuthStateChanged((u) => {
      clearTimeout(safetyTimer);
      setUser(u);
      setLoading(false);
    });

    return () => {
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    await authService.signInWithGoogle();
  }, []);

  const signInWithWallet = useCallback(async (opts) => {
    const user = await authService.signInWithWallet(opts);
    setUser(user);
    return user;
  }, []);

  const signInDemo = useCallback(async () => {
    const user = await authService.signInDemo();
    setUser(user);
    return user;
  }, []);

  const connectWalletSession = useCallback(async (address, provider) => {
    const updated = await authService.connectWalletAccount(address, provider);
    setUser(updated);
    return updated;
  }, []);

  const signOut = useCallback(async () => {
    await authService.signOut();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const current = await authService.getCurrentUser();
    setUser(current);
    return current;
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, signInWithGoogle, signInWithWallet, signInDemo, connectWalletSession, signOut, refreshUser, setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
