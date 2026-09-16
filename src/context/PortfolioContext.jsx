import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import * as portfolioService from '../services/portfolioService.js';
import * as watchlistService from '../services/watchlistService.js';
import * as marketService from '../services/marketService.js';
import { getWalletBalance } from '../services/walletService.js';
import { restoreHDWallet } from '../services/hdWalletService.js';
import { useAuth } from './AuthContext.jsx';

const PortfolioContext = createContext(null);

const CACHE_KEY = 'sona_portfolio_cache';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min — stale data beyond this triggers a visible refresh

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    return { data, stale: Date.now() - ts > CACHE_TTL_MS };
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

export function PortfolioProvider({ children }) {
  const { user } = useAuth();
  // Seed from localStorage immediately so Home renders with data on first paint
  const cached = readCache();
  const [portfolio, setPortfolio] = useState(cached?.data ?? null);
  const [watchlist, setWatchlist] = useState([]);
  // Only show spinner when there is no cached data to display
  const [loading, setLoading] = useState(!cached?.data);

  // Wallet address comes directly from auth state or fallback to local HD wallet
  const solanaAddress = user?.wallets?.solana || user?.walletAddress || null;

  const refreshPortfolio = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      let targetAddress = solanaAddress;
      if (!targetAddress && user?.id) {
        try {
          const restored = await restoreHDWallet(user.id);
          targetAddress = restored?.addresses?.solana || null;
        } catch {}
      }

      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('portfolio_timeout')), 20000)
      );
      // Fetch portfolio data and on-chain balance in parallel
      const [data, onChain] = await Promise.all([
        Promise.race([portfolioService.getPortfolio(), timeout]),
        targetAddress ? getWalletBalance(targetAddress) : Promise.resolve({ sol: 0, tokens: [], isLive: false }),
      ]);

      // Calculate total value from on-chain tokens + internal positions
      let computedTotalValue = data?.totalValue || 0;
      if (onChain?.tokens?.length || (onChain?.sol && onChain.sol > 0)) {
        let onChainVal = 0;
        for (const t of (onChain.tokens || [])) {
          if (t.symbol === 'USDC' || t.symbol === 'USDT') {
            onChainVal += t.amount;
          } else if (t.symbol === 'SOL') {
            try {
              const quote = await marketService.getAssetPrice('SOL');
              onChainVal += t.amount * (quote?.price || 150);
            } catch {
              onChainVal += t.amount * 150;
            }
          } else {
            try {
              const quote = await marketService.getAssetPrice(t.symbol);
              onChainVal += t.amount * (quote?.price || 0);
            } catch {}
          }
        }
        const internalTotal = (data?.holdings || []).reduce((s, h) => s + (h.currentValue || 0), 0);
        computedTotalValue = Number((internalTotal + onChainVal).toFixed(2));
      }

      const merged = {
        ...data,
        walletAddress: targetAddress,
        totalValue: computedTotalValue,
        availableBalance: onChain.sol ?? data.availableBalance,
        onChainTokens: onChain.tokens ?? [],
        balanceIsLive: onChain.isLive ?? false,
      };
      setPortfolio(merged);
      writeCache(merged);
    } catch (e) {
      if (e.message === 'portfolio_timeout') {
        console.warn('[Sona] Portfolio load timed out.');
      } else if (e.message !== 'Not signed in.') {
        console.error('[Sona] Portfolio load error:', e.message);
      }
      setPortfolio((prev) => prev ?? {
        totalValue: 0, availableBalance: 0, investedValue: 0,
        profitLoss: 0, profitLossPercent: 0,
        walletAddress: solanaAddress,
        holdings: [], recentTransactions: [], onChainTokens: [],
      });
    } finally {
      setLoading(false);
    }
  }, [solanaAddress, user?.id]);

  const refreshWatchlist = useCallback(async () => {
    try {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('wl_timeout')), 5000)
      );
      const list = await Promise.race([watchlistService.getWatchlist(), timeout]);
      setWatchlist(list);
    } catch {
      setWatchlist([]);
    }
  }, []);

  useEffect(() => {
    const cached = readCache();
    // Invalidate cache if it's from before walletAddress was added
    if (cached?.data && cached.data.walletAddress === undefined) {
      try { localStorage.removeItem(CACHE_KEY); } catch {}
    }
    const fresh = readCache();
    const silent = Boolean(fresh?.data && !fresh.stale);
    refreshPortfolio(silent);
    refreshWatchlist();
  }, [refreshPortfolio, refreshWatchlist]);

  const toggleWatchlist = useCallback(async (symbol) => {
    const inList = watchlist.includes(symbol);
    if (inList) {
      await watchlistService.removeFromWatchlist(symbol);
    } else {
      await watchlistService.addToWatchlist(symbol);
    }
    await refreshWatchlist();
  }, [watchlist, refreshWatchlist]);

  return (
    <PortfolioContext.Provider
      value={{ portfolio, watchlist, loading, refreshPortfolio, toggleWatchlist }}
    >
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error('usePortfolio must be used within PortfolioProvider');
  return ctx;
}
