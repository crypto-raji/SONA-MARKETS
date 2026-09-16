/**
 * walletService.js
 * -----------------------------------------------------------------------
 * Phase 1: Real on-chain SOL + SPL token balances via @solana/web3.js.
 * Uses mainnet-beta RPC from constants/network.js.
 * -----------------------------------------------------------------------
 */
import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { getActiveNetwork, getRpcUrl, getUsdcMint } from '../constants/network.js';
import { getSolanaKeypair } from './hdWalletService.js';

// SPL token mint addresses — USDC switches by cluster, others are mainnet Sollet
const SPL_MINTS = {
  USDC: getUsdcMint(),
  BTC:  '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E',
  ETH:  '2FPyTwcZLUg1MDrwsyoP4D6s1tM7hAkHYRjkNb5w6Pxk',
  BNB:  '9gP2kCy3wA1ctvYWQk75guqXuHfrEomqydHLtcTCqiLa',
};

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

// Mint → symbol reverse map
const MINT_TO_SYMBOL = Object.fromEntries(Object.entries(SPL_MINTS).map(([k, v]) => [v, k]));

export const SUPPORTED_WALLETS = [
  { id: 'phantom',  name: 'Phantom',  network: 'Solana' },
  { id: 'solflare', name: 'Solflare', network: 'Solana' },
  { id: 'backpack', name: 'Backpack', network: 'Solana' },
];

function isWalletInstalled(id) {
  if (typeof window === 'undefined') return false;
  if (id === 'phantom')  return Boolean(window?.phantom?.solana || window?.solana?.isPhantom);
  if (id === 'solflare') return Boolean(window?.solflare);
  if (id === 'backpack') return Boolean(window?.backpack);
  return false;
}

export function listAvailableWallets() {
  return SUPPORTED_WALLETS.map((w) => ({ ...w, installed: isWalletInstalled(w.id) }));
}

export async function connectWallet(walletId) {
  const wallet = SUPPORTED_WALLETS.find((w) => w.id === walletId);
  if (!wallet) throw new Error(`Unsupported wallet: ${walletId}`);

  if (walletId === 'phantom' && window?.solana?.isPhantom) {
    const resp = await window.solana.connect();
    return { provider: 'phantom', address: resp.publicKey.toString(), network: getActiveNetwork(), isDemo: false };
  }
  if (walletId === 'solflare' && window?.solflare) {
    await window.solflare.connect();
    return { provider: 'solflare', address: window.solflare.publicKey?.toString(), network: getActiveNetwork(), isDemo: false };
  }
  if (walletId === 'backpack' && window?.backpack) {
    await window.backpack.connect();
    return { provider: 'backpack', address: window.backpack.publicKey?.toString(), network: getActiveNetwork(), isDemo: false };
  }

  return {
    provider: walletId,
    address: `DEMO${walletId.slice(0, 4).toUpperCase()}Wallet1111111111111111111111`,
    network: getActiveNetwork(),
    isDemo: true,
  };
}

export async function disconnectWallet(provider) {
  if (provider === 'phantom'  && window?.solana?.disconnect)   await window.solana.disconnect();
  if (provider === 'solflare' && window?.solflare?.disconnect) await window.solflare.disconnect();
  if (provider === 'backpack' && window?.backpack?.disconnect)  await window.backpack.disconnect();
  return { success: true };
}

export async function getWalletAddress(session) {
  return session?.walletAddress || null;
}

/**
 * Phase 1 — live on-chain balance reading.
 * Fetches SOL (native) + all SPL token balances for the given Solana address.
 * Falls back to zeros on RPC failure so the UI never crashes.
 */
// Devnet RPC endpoints tried in order
const DEVNET_RPCS = [
  'https://api.devnet.solana.com',
  'https://rpc.ankr.com/solana_devnet',
];
const MAINNET_RPCS = [
  'https://api.mainnet-beta.solana.com',
  'https://rpc.ankr.com/solana',
];

function rpcList() {
  const primary = getRpcUrl();
  const fallbacks = getActiveNetwork() === 'mainnet-beta' ? MAINNET_RPCS : DEVNET_RPCS;
  return [primary, ...fallbacks.filter((r) => r !== primary)];
}

// Direct JSON-RPC fetch — avoids web3.js Connection overhead
async function rpcCall(url, method, params, timeoutMs = 6000) {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    return json.result;
  } finally {
    clearTimeout(tid);
  }
}

async function fetchSolBalance(address) {
  const rpcs = rpcList();
  for (const rpc of rpcs) {
    try {
      const result = await rpcCall(rpc, 'getBalance', [address, { commitment: 'confirmed' }]);
      return { lamports: result?.value ?? 0, rpc };
    } catch { /* try next */ }
  }
  return { lamports: 0, rpc: null };
}

async function fetchSplTokens(address, rpc) {
  if (!rpc) return [];
  try {
    const result = await rpcCall(rpc, 'getTokenAccountsByOwner', [
      address,
      { programId: TOKEN_PROGRAM_ID.toBase58() },
      { encoding: 'jsonParsed', commitment: 'confirmed' },
    ], 8000);
    const tokens = [];
    for (const { account } of (result?.value || [])) {
      const info   = account?.data?.parsed?.info;
      const mint   = info?.mint;
      const amount = info?.tokenAmount?.uiAmount ?? 0;
      const symbol = MINT_TO_SYMBOL[mint];
      if (symbol && amount > 0) tokens.push({ symbol, amount });
    }
    return tokens;
  } catch { return []; }
}

export async function getWalletBalance(address) {
  if (!address || address.startsWith('DEMO')) {
    return { sol: 0, tokens: [], isLive: false, network: getActiveNetwork() };
  }

  try {
    new PublicKey(address); // validate address format
    const { lamports, rpc } = await fetchSolBalance(address);
    const sol = lamports / 1e9;

    const splTokens = await fetchSplTokens(address, rpc);
    const tokens = [...splTokens];
    if (sol > 0) tokens.unshift({ symbol: 'SOL', amount: sol });

    return { sol, tokens, isLive: true, network: getActiveNetwork(), rpcUrl: rpc };
  } catch (err) {
    console.error('[Sona] getWalletBalance failed:', err.message);
    return { sol: 0, tokens: [], isLive: false, network: getActiveNetwork() };
  }
}

/**
 * Poll the chain until a balance change is detected or timeout is reached.
 * Used by the Receive page to detect an incoming deposit.
 */
export async function waitForDeposit(address, prevSol, { intervalMs = 4000, timeoutMs = 120_000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const { sol } = await getWalletBalance(address);
    if (sol > prevSol) return { received: true, sol };
  }
  return { received: false };
}

export async function signTransaction(walletProvider, transaction) {
  if (walletProvider === 'phantom' && window?.solana?.signTransaction) {
    return window.solana.signTransaction(transaction);
  }
  throw new Error('No live wallet adapter connected. Connect a wallet extension to sign transactions.');
}

/**
 * Returns an Anchor-compatible wallet wrapper backed by the user's HD keypair.
 * Returns null if no HD wallet is found in localStorage for this uid.
 *
 * Shape: { publicKey, signTransaction, signAllTransactions }
 */
export async function getAnchorWallet(uid) {
  const secretKey = await getSolanaKeypair(uid);
  if (!secretKey) return null;

  const keypair = Keypair.fromSecretKey(secretKey);

  return {
    publicKey: keypair.publicKey,
    async signTransaction(tx) {
      tx.partialSign(keypair);
      return tx;
    },
    async signAllTransactions(txs) {
      return txs.map((tx) => { tx.partialSign(keypair); return tx; });
    },
  };
}

/**
 * Executes a direct on-chain transfer of native SOL from the user's HD wallet.
 * Returns the confirmed transaction signature.
 */
export async function sendOnChainSolanaTransfer(uid, recipientAddress, amountSol) {
  const secretKey = await getSolanaKeypair(uid);
  if (!secretKey) {
    throw new Error('Wallet key not available for signing. Please make sure you are signed in.');
  }

  const senderKeypair = Keypair.fromSecretKey(secretKey);
  const recipientPubkey = new PublicKey(recipientAddress);
  const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);

  const connection = new Connection(getRpcUrl(), 'confirmed');
  const { blockhash } = await connection.getLatestBlockhash('confirmed');

  const tx = new Transaction({
    recentBlockhash: blockhash,
    feePayer: senderKeypair.publicKey,
  }).add(
    SystemProgram.transfer({
      fromPubkey: senderKeypair.publicKey,
      toPubkey: recipientPubkey,
      lamports,
    })
  );

  const signature = await sendAndConfirmTransaction(connection, tx, [senderKeypair], {
    commitment: 'confirmed',
  });

  return signature;
}
