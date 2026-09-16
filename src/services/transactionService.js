/**
 * transactionService.js — real buy/sell/swap/send/receive backed by Firestore.
 *
 * Firestore structure:
 *   users/{uid}/transactions/{txId}  → transaction record
 *
 * On every buy/sell/swap, the corresponding position in Firestore is updated
 * via portfolioService.updatePosition. On-chain settlement via contractService
 * will replace these Firestore writes once the Solana program is deployed.
 */
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from './firebase.js';
import { updatePosition } from './portfolioService.js';
import { getAnchorWallet } from './walletService.js';

const FEE_RATE = 0.001; // 0.1% platform fee
const FEE_RECIPIENT = import.meta.env.VITE_PLATFORM_FEE_RECIPIENT || null;

function requireAuth() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in.');
  return user;
}

function txCollectionRef(uid) {
  return collection(db, 'users', uid, 'transactions');
}

export function estimateFee(amount) {
  return Number((amount * FEE_RATE).toFixed(2));
}

async function recordTransaction(uid, data) {
  const record = { ...data, timestamp: serverTimestamp() };
  if (FEE_RECIPIENT && data.fee) record.feeRecipient = FEE_RECIPIENT;
  const ref = await addDoc(txCollectionRef(uid), record);
  return { id: ref.id, ...data };
}

// ── On-chain helper ────────────────────────────────────────────────────────────

/**
 * Try to execute fn() on-chain; if it fails for any reason, log and return null.
 * The caller falls back to Firestore simulation on null.
 */
async function tryOnChain(uid, fn) {
  try {
    const wallet = await getAnchorWallet(uid);
    if (!wallet) return null;
    // Dynamic import so @coral-xyz/anchor is never loaded at startup
    const cs = await import('./contractService.js');
    return await fn(wallet, cs);
  } catch (err) {
    console.warn('[Sona] on-chain call failed, falling back to simulation:', err.message);
    return null;
  }
}

// ── Buy ───────────────────────────────────────────────────────────────────────
/**
 * @param {object} p
 * @param {string} p.symbol          — asset being bought (e.g. 'AAPL')
 * @param {number} p.price           — current USD price of the asset
 * @param {string} p.payWithSymbol   — 'USDC' | 'SOL'
 * @param {number} p.payAmount       — human-readable amount of payWithSymbol
 * @param {number} p.payPrice        — current USD price of payWithSymbol
 */
export async function buyAsset({ symbol, price, payWithSymbol, payAmount, payPrice }) {
  const user     = requireAuth();
  const usdValue = payAmount * payPrice;
  const fee      = estimateFee(usdValue);
  const quantity = Number(((usdValue - fee) / price).toFixed(6));

  // Attempt on-chain settlement; falls back to Firestore simulation on failure
  const txHash = await tryOnChain(user.uid, (wallet, cs) =>
    cs.buyAsset({ symbol, payWithSymbol, payAmount, assetPrice: price, solPriceUsd: payPrice, wallet })
  );

  if (!txHash) {
    // Firestore simulation: update positions locally
    await updatePosition(user.uid, payWithSymbol, -payAmount, payPrice);
    await updatePosition(user.uid, symbol, quantity, price);
  } else {
    // On-chain succeeded: only update Firestore portfolio mirror
    await updatePosition(user.uid, payWithSymbol, -payAmount, payPrice);
    await updatePosition(user.uid, symbol, quantity, price);
  }

  return recordTransaction(user.uid, {
    type: 'BUY',
    symbol,
    quantity,
    price,
    payWithSymbol,
    payAmount,
    amountUsd: Number(usdValue.toFixed(2)),
    fee: Number(fee.toFixed(2)),
    status: 'Completed',
    txHash: txHash || null,
    onChain: Boolean(txHash),
  });
}

// ── Sell ──────────────────────────────────────────────────────────────────────
/**
 * @param {object} p
 * @param {string} p.symbol              — asset being sold
 * @param {number} p.quantity            — units to sell
 * @param {number} p.price               — current USD price of the asset
 * @param {string} p.receiveWithSymbol   — 'USDC' | 'SOL'
 * @param {number} p.receivePrice        — current USD price of receiveWithSymbol
 */
export async function sellAsset({ symbol, quantity, price, receiveWithSymbol, receivePrice }) {
  const user          = requireAuth();
  const usdValue      = quantity * price;
  const fee           = estimateFee(usdValue);
  const receiveAmount = Number(((usdValue - fee) / receivePrice).toFixed(6));

  const txHash = await tryOnChain(user.uid, (wallet, cs) =>
    cs.sellAsset({ symbol, quantity, assetPrice: price, receiveWithSymbol, wallet })
  );

  await updatePosition(user.uid, symbol, -quantity, price);
  await updatePosition(user.uid, receiveWithSymbol, receiveAmount, receivePrice);

  return recordTransaction(user.uid, {
    type: 'SELL',
    symbol,
    quantity,
    price,
    receiveWithSymbol,
    receiveAmount,
    amountUsd: Number((usdValue - fee).toFixed(2)),
    fee: Number(fee.toFixed(2)),
    status: 'Completed',
    txHash: txHash || null,
    onChain: Boolean(txHash),
  });
}

// ── Swap ──────────────────────────────────────────────────────────────────────
export async function swapAsset({ fromSymbol, fromAmount, fromPrice, toSymbol, toPrice }) {
  const user     = requireAuth();
  const usdValue = fromAmount * fromPrice;
  const fee      = estimateFee(usdValue);
  const toAmount = Number(((usdValue - fee) / toPrice).toFixed(6));

  const txHash = await tryOnChain(user.uid, (wallet, cs) =>
    cs.swapAsset({ fromSymbol, fromAmount, fromPrice, toSymbol, toPrice, wallet })
  );

  await updatePosition(user.uid, fromSymbol, -fromAmount, fromPrice);
  await updatePosition(user.uid, toSymbol, toAmount, toPrice);

  return recordTransaction(user.uid, {
    type: 'SWAP',
    fromSymbol,
    fromAmount,
    toSymbol,
    toAmount,
    amountUsd: Number(usdValue.toFixed(2)),
    fee: Number(fee.toFixed(2)),
    status: 'Completed',
    txHash: txHash || null,
    onChain: Boolean(txHash),
  });
}

// ── Send ──────────────────────────────────────────────────────────────────────
export async function sendAsset({ symbol, amount, recipient, network }) {
  if (!recipient || recipient.length < 8) throw new Error('Invalid recipient address.');
  if (!amount || amount <= 0)            throw new Error('Invalid amount.');

  const user = requireAuth();
  const fee  = network === 'Solana' ? 0.000005 : estimateFee(amount);

  // For Solana sends, attempt real on-chain transfer
  const txHash = network === 'Solana'
    ? await tryOnChain(user.uid, (wallet, cs) =>
        cs.transferAsset({ symbol, amount, recipient, wallet })
      )
    : null;

  await updatePosition(user.uid, symbol, -(amount + fee), 0);

  return recordTransaction(user.uid, {
    type: 'SEND',
    symbol,
    quantity: amount,
    recipient,
    network,
    fee,
    status: 'Completed',
    txHash: txHash || null,
    onChain: Boolean(txHash),
  });
}

// ── Receive ───────────────────────────────────────────────────────────────────
export async function receiveAsset({ symbol, network }) {
  const user = requireAuth();
  return recordTransaction(user.uid, {
    type: 'RECEIVE',
    symbol,
    network,
    status: 'Pending',
  });
}

// ── Query helpers ─────────────────────────────────────────────────────────────

export async function getTransactionHistory() {
  const user = requireAuth();
  const q    = query(txCollectionRef(user.uid), orderBy('timestamp', 'desc'), limit(100));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    timestamp: d.data().timestamp?.toDate?.()?.toISOString() || null,
  }));
}

export async function getTransaction(id) {
  const user = requireAuth();
  const snap = await getDoc(doc(db, 'users', user.uid, 'transactions', id));
  if (!snap.exists()) return null;
  return {
    id: snap.id,
    ...snap.data(),
    timestamp: snap.data().timestamp?.toDate?.()?.toISOString() || null,
  };
}
