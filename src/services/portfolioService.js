/**
 * portfolioService.js — real portfolio data from Firebase Firestore.
 *
 * Firestore structure:
 *   users/{uid}/positions/{symbol}  → { symbol, quantity, avgPrice, updatedAt }
 *
 * Holdings are written by transactionService on every buy/sell/swap.
 * Prices are fetched live from marketService to compute current values.
 */
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase.js';
import { getWalletSession } from './authService.js';
import * as marketService from './marketService.js';
import * as transactionService from './transactionService.js';
import { getWalletBalance } from './walletService.js';
import { restoreHDWallet } from './hdWalletService.js';

function getUserId() {
  const user = auth.currentUser;
  if (user?.uid) return user.uid;
  const session = getWalletSession();
  if (session?.id || session?.uid) return session.id || session.uid;
  return 'sona_default_user';
}

function requireAuth() {
  const uid = getUserId();
  if (!uid) throw new Error('Not signed in.');
  return { uid };
}

const POSITIONS_STORAGE_KEY = (uid) => `sona_positions_${uid}`;

function readLocalPositions(uid) {
  try {
    const raw = localStorage.getItem(POSITIONS_STORAGE_KEY(uid));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeLocalPositions(uid, map) {
  try {
    localStorage.setItem(POSITIONS_STORAGE_KEY(uid), JSON.stringify(map));
  } catch {}
}

function positionsRef(uid) {
  return collection(db, 'users', uid, 'positions');
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getHoldings() {
  const user = requireAuth();
  const uid = user.uid;

  let positionsMap = readLocalPositions(uid);

  if (isFirebaseConfigured && auth.currentUser) {
    try {
      const firestoreTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 2000)
      );
      const snap = await Promise.race([getDocs(positionsRef(uid)), firestoreTimeout]);
      if (snap?.docs?.length) {
        for (const d of snap.docs) {
          positionsMap[d.id] = d.data();
        }
        writeLocalPositions(uid, positionsMap);
      }
    } catch {}
  }

  const rawPositions = Object.values(positionsMap).filter((p) => (p.quantity || 0) > 0);

  const rows = await Promise.all(
    rawPositions.map(async (p) => {
      const quote = await marketService.getAssetPrice(p.symbol);
      const currentValue = Number((p.quantity * (quote.price || 0)).toFixed(2));
      const costBasis    = Number((p.quantity * (p.avgPrice || quote.price || 0)).toFixed(2));
      const profitLoss   = Number((currentValue - costBasis).toFixed(2));
      const profitLossPercent = costBasis
        ? Number(((profitLoss / costBasis) * 100).toFixed(2))
        : 0;
      return { ...p, currentValue, costBasis, profitLoss, profitLossPercent, quote };
    })
  );

  return rows;
}

export async function getPortfolio() {
  const user = requireAuth();

  const [holdings, recentTransactions, onChain] = await Promise.all([
    getHoldings(),
    transactionService.getTransactionHistory().then((txs) => txs.slice(0, 5)),
    // Read the user's Solana address from local storage, session, or Firestore
    (async () => {
      try {
        let solanaAddress = null;
        try {
          const localRestored = await restoreHDWallet(user.uid);
          if (localRestored?.addresses?.solana) {
            solanaAddress = localRestored.addresses.solana;
          }
        } catch {}

        if (!solanaAddress) {
          const session = getWalletSession();
          if (session?.wallets?.solana) solanaAddress = session.wallets.solana;
        }

        if (!solanaAddress && isFirebaseConfigured) {
          try {
            const snap = await getDoc(doc(db, 'users', user.uid));
            solanaAddress = snap.data()?.wallets?.solana || snap.data()?.walletAddress || null;
          } catch {}
        }

        if (!solanaAddress) return { sol: 0, address: null, tokens: [] };
        const result = await getWalletBalance(solanaAddress);
        return { ...result, address: solanaAddress };
      } catch { return { sol: 0, address: null, tokens: [] }; }
    })(),
  ]);

  const onChainTokens = onChain.tokens || [];
  let onChainTokensValue = 0;
  for (const t of onChainTokens) {
    if (t.symbol === 'USDC' || t.symbol === 'USDT') {
      onChainTokensValue += t.amount;
    } else if (t.symbol === 'SOL') {
      try {
        const quote = await marketService.getAssetPrice('SOL');
        const solPrice = quote?.price || 150;
        onChainTokensValue += t.amount * solPrice;
      } catch {
        onChainTokensValue += t.amount * 150;
      }
    } else {
      try {
        const quote = await marketService.getAssetPrice(t.symbol);
        onChainTokensValue += t.amount * (quote?.price || 0);
      } catch {}
    }
  }

  const investedValue     = holdings.reduce((s, h) => s + h.costBasis, 0);
  const internalTotal     = holdings.reduce((s, h) => s + h.currentValue, 0);
  const totalValue        = Number((internalTotal + onChainTokensValue).toFixed(2));
  const profitLoss        = Number((internalTotal - investedValue).toFixed(2));
  const profitLossPercent = investedValue
    ? Number(((profitLoss / investedValue) * 100).toFixed(2))
    : 0;

  return {
    totalValue,
    availableBalance: Number((onChain.sol || 0).toFixed(4)),
    onChainTokens,
    balanceIsLive:    onChain.isLive || false,
    walletAddress:    onChain.address || null,
    investedValue:    Number(investedValue.toFixed(2)),
    profitLoss,
    profitLossPercent,
    holdings,
    recentTransactions,
  };
}

export async function getPortfolioPerformance(timeframe = '1M') {
  const holdings = await getHoldings();
  if (holdings.length === 0) return { timeframe, series: [] };

  // Use the largest holding's history as a proxy for portfolio curve.
  const largest = holdings.sort((a, b) => b.currentValue - a.currentValue)[0];
  const history = await marketService.getHistoricalPrices(largest.symbol, timeframe);
  const base    = largest.costBasis || 1;
  const first   = history.series[0]?.price || 1;

  return {
    timeframe,
    series: history.series.map((p) => ({
      t:     p.t,
      value: Number((base * (p.price / first)).toFixed(2)),
    })),
  };
}

export async function getPortfolioAllocation() {
  const holdings = await getHoldings();
  const total    = holdings.reduce((s, h) => s + h.currentValue, 0) || 1;
  return holdings.map((h) => ({
    symbol:  h.symbol,
    value:   h.currentValue,
    percent: Number(((h.currentValue / total) * 100).toFixed(1)),
  }));
}

// ── Internal — called by transactionService ────────────────────────────────

/**
 * Update a user's position after a buy or sell.
 * Called by transactionService — not called directly from UI.
 */
export async function updatePosition(uid, symbol, quantityDelta, price) {
  // 1. Update local cache immediately (instant real-time UI)
  const localMap = readLocalPositions(uid);
  const existing = localMap[symbol] || { symbol, quantity: 0, avgPrice: price };
  let newQty = (existing.quantity || 0) + quantityDelta;
  let newAvgPrice = existing.avgPrice || price;

  if (quantityDelta > 0) {
    const totalCost = (existing.quantity || 0) * (existing.avgPrice || price) + quantityDelta * price;
    newAvgPrice = newQty > 0 ? totalCost / newQty : price;
  }

  if (newQty < 0) {
    newQty = 0;
  }

  const updatedPosition = {
    symbol,
    quantity: Number(newQty.toFixed(8)),
    avgPrice: Number(newAvgPrice.toFixed(8)),
    updatedAt: new Date().toISOString(),
  };

  localMap[symbol] = updatedPosition;
  writeLocalPositions(uid, localMap);

  // 2. Sync to Firestore in background without blocking
  if (isFirebaseConfigured && auth.currentUser) {
    try {
      const ref = doc(db, 'users', uid, 'positions', symbol);
      setDoc(ref, {
        symbol,
        quantity: Number(newQty.toFixed(8)),
        avgPrice: Number(newAvgPrice.toFixed(8)),
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    } catch {}
  }
}
