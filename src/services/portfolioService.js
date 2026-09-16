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
import { auth, db } from './firebase.js';
import * as marketService from './marketService.js';
import * as transactionService from './transactionService.js';
import { getWalletBalance } from './walletService.js';

function requireAuth() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in.');
  return user;
}

function positionsRef(uid) {
  return collection(db, 'users', uid, 'positions');
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getHoldings() {
  const user = requireAuth();
  const snap = await getDocs(positionsRef(user.uid));

  const rows = await Promise.all(
    snap.docs
      .map((d) => d.data())
      .filter((p) => p.quantity > 0)
      .map(async (p) => {
        const quote = await marketService.getAssetPrice(p.symbol);
        const currentValue = Number((p.quantity * quote.price).toFixed(2));
        const costBasis    = Number((p.quantity * p.avgPrice).toFixed(2));
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
    // Read the user's Solana address from Firestore profile (saved when they generate/connect a wallet)
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const solanaAddress = snap.data()?.wallets?.solana || snap.data()?.walletAddress || null;
        if (!solanaAddress) return { sol: 0, address: null };
        const result = await getWalletBalance(solanaAddress);
        return { ...result, address: solanaAddress };
      } catch { return { sol: 0, address: null }; }
    })(),
  ]);

  const onChainTokens = onChain.tokens || [];
  let onChainTokensValue = 0;
  for (const t of onChainTokens) {
    if (t.symbol === 'USDC' || t.symbol === 'USDT') {
      onChainTokensValue += t.amount;
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
  const ref  = doc(db, 'users', uid, 'positions', symbol);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      symbol,
      quantity: quantityDelta,
      avgPrice: price,
      updatedAt: serverTimestamp(),
    });
    return;
  }

  const existing = snap.data();
  let newQty      = existing.quantity + quantityDelta;
  let newAvgPrice = existing.avgPrice;

  if (quantityDelta > 0) {
    // Buying more: compute volume-weighted average
    const totalCost = existing.quantity * existing.avgPrice + quantityDelta * price;
    newAvgPrice     = newQty > 0 ? totalCost / newQty : price;
  }

  if (newQty < 0) throw new Error(`Cannot sell more ${symbol} than you hold.`);

  await setDoc(ref, {
    symbol,
    quantity:  Number(newQty.toFixed(8)),
    avgPrice:  Number(newAvgPrice.toFixed(8)),
    updatedAt: serverTimestamp(),
  });
}
