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

// Known mint mappings across Solana mainnet and devnet (both standard SPL & Token-2022)
export const KNOWN_SOLANA_MINTS = {
  // USDC - Mainnet
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC', // Mainnet SPL
  // USDC - Devnet faucets & mints
  '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU': 'USDC', // Devnet SPL (Circle / Solana standard)
  'CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM': 'USDC', // Devnet Token-2022 (Circle Faucet)
  'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr': 'USDC', // Devnet alternate
  'USDCoMPuhwwhMRf4wELGgGgZf5KxU1qA9mE98h7fF4z': 'USDC', // Devnet faucet mint
  'CpMah1WCSngRwGsqbRNMS8nhr5B37B2eXU8kH49xWUVe': 'USDC', // Devnet test mint
  'BXXkv6z8ykpG1xnh2YjEGNo8DpK5tZKYJa759Dg88fgU': 'USDC', // Wormhole devnet USDC
  'AmgGgZf5KxU1qA9mE98h7fF4zEPjFWdd5AufqSSqeM2q': 'USDC',
  // USDT
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
  'EJwZgeZrdC8TXT2sgQjVoVHdpnhE2mCePnoctpkTremb': 'USDT',
  // BTC
  '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E': 'BTC',
  '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh': 'BTC',
  // ETH
  '2FPyTwcZLUg1MDrwsyoP4D6s1tM7hAkHYRjkNb5w6Pxk': 'ETH',
  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': 'ETH',
  // BNB
  '9gP2kCy3wA1ctvYWQk75guqXuHfrEomqydHLtcTCqiLa': 'BNB',
};

const TOKEN_PROGRAMS = [
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // Standard SPL Token Program
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb', // SPL Token-2022 Program
];

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
 * Fetches SOL (native) + all SPL & Token-2022 token balances for the given Solana address.
 * Falls back to zeros on RPC failure so the UI never crashes.
 */
// Devnet RPC endpoints tried in order
const DEVNET_RPCS = [
  'https://api.devnet.solana.com',
  'https://rpc.ankr.com/solana_devnet',
  'https://devnet.helius-rpc.com/?api-key=15319bf4-5b40-4958-ac71-6d44cf7b391e',
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

async function fetchSplTokens(address, primaryRpc) {
  const rpcs = primaryRpc ? [primaryRpc, ...rpcList().filter(r => r !== primaryRpc)] : rpcList();

  for (const rpc of rpcs) {
    try {
      const tokenTotals = {};
      let anySuccess = false;

      await Promise.allSettled(
        TOKEN_PROGRAMS.map(async (progId) => {
          try {
            const result = await rpcCall(
              rpc,
              'getTokenAccountsByOwner',
              [
                address,
                { programId: progId },
                { encoding: 'jsonParsed', commitment: 'confirmed' },
              ],
              8000
            );
            if (result && Array.isArray(result.value)) {
              anySuccess = true;
              for (const { account } of result.value) {
                const info   = account?.data?.parsed?.info;
                const mint   = info?.mint;
                const amount = info?.tokenAmount?.uiAmount ?? 0;
                const symbol = KNOWN_SOLANA_MINTS[mint] || (mint === getUsdcMint() ? 'USDC' : null);
                if (symbol && amount > 0) {
                  tokenTotals[symbol] = (tokenTotals[symbol] || 0) + amount;
                }
              }
            }
          } catch { /* try next program */ }
        })
      );

      if (anySuccess) {
        return Object.entries(tokenTotals).map(([symbol, amount]) => ({
          symbol,
          amount: Number(amount.toFixed(6)),
        }));
      }
    } catch { /* try next RPC */ }
  }

  return [];
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
    if (sol > 0) tokens.unshift({ symbol: 'SOL', amount: Number(sol.toFixed(4)) });

    return { sol, tokens, isLive: true, network: getActiveNetwork(), rpcUrl: rpc };
  } catch (err) {
    console.error('[Sona] getWalletBalance failed:', err.message);
    return { sol: 0, tokens: [], isLive: false, network: getActiveNetwork() };
  }
}

/**
 * Poll the chain until a balance change is detected or timeout is reached.
 * Used by the Receive page to detect an incoming deposit (SOL or any SPL/Token-2022 token).
 */
export async function waitForDeposit(address, prevSnapshot = {}, { intervalMs = 4000, timeoutMs = 120_000 } = {}) {
  const start = Date.now();
  const prevSol = typeof prevSnapshot === 'number' ? prevSnapshot : (prevSnapshot.sol || 0);
  const prevTokens = typeof prevSnapshot === 'number' ? {} : (prevSnapshot.tokensMap || {});

  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const current = await getWalletBalance(address);
    if (current.sol > prevSol + 0.000001) {
      return { received: true, type: 'SOL', amount: current.sol - prevSol, balance: current };
    }
    for (const t of current.tokens) {
      const prevAmt = prevTokens[t.symbol] || 0;
      if (t.amount > prevAmt + 0.000001) {
        return { received: true, type: t.symbol, amount: t.amount - prevAmt, balance: current };
      }
    }
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
 * Executes a direct on-chain transfer of native SOL or SPL token from the user's wallet.
 * Supports both Sona HD Keypairs (embedded wallet) and Browser Extension Wallets (Phantom/Solflare/Backpack).
 * Returns the confirmed transaction signature.
 */
export async function sendOnChainSolanaTransfer({
  uid,
  recipientAddress,
  amount,
  symbol = 'SOL',
  walletProvider = 'sona',
}) {
  const recipientPubkey = new PublicKey(recipientAddress);
  const connection = new Connection(getRpcUrl(), 'confirmed');
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

  // ── Browser extension wallet (Phantom, Solflare, Backpack) ──────────
  if (walletProvider === 'phantom' && window?.phantom?.solana) {
    const provider = window.phantom.solana;
    if (!provider.publicKey) await provider.connect();
    const senderPubkey = provider.publicKey;

    const tx = new Transaction({
      recentBlockhash: blockhash,
      feePayer: senderPubkey,
    });

    if (symbol === 'SOL') {
      const lamports = Math.round(amount * LAMPORTS_PER_SOL);
      tx.add(
        SystemProgram.transfer({
          fromPubkey: senderPubkey,
          toPubkey: recipientPubkey,
          lamports,
        })
      );
    } else {
      // SPL token transfer (USDC or other token)
      const mintAddress = getUsdcMint();
      const mintPubkey = new PublicKey(mintAddress);
      const senderAta = await getAssociatedTokenAddress(mintPubkey, senderPubkey);
      const recipientAta = await getAssociatedTokenAddress(mintPubkey, recipientPubkey);

      const { createAssociatedTokenAccountIdempotentInstruction, createTransferInstruction } = await import('@solana/spl-token');
      
      tx.add(
        createAssociatedTokenAccountIdempotentInstruction(
          senderPubkey,
          recipientAta,
          recipientPubkey,
          mintPubkey
        ),
        createTransferInstruction(
          senderAta,
          recipientAta,
          senderPubkey,
          Math.round(amount * 1_000_000)
        )
      );
    }

    const { signature } = await provider.signAndSendTransaction(tx);
    await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
    return signature;
  }

  if (walletProvider === 'solflare' && window?.solflare) {
    const provider = window.solflare;
    if (!provider.publicKey) await provider.connect();
    const senderPubkey = provider.publicKey;

    const tx = new Transaction({
      recentBlockhash: blockhash,
      feePayer: senderPubkey,
    });

    if (symbol === 'SOL') {
      const lamports = Math.round(amount * LAMPORTS_PER_SOL);
      tx.add(
        SystemProgram.transfer({
          fromPubkey: senderPubkey,
          toPubkey: recipientPubkey,
          lamports,
        })
      );
    } else {
      const mintAddress = getUsdcMint();
      const mintPubkey = new PublicKey(mintAddress);
      const senderAta = await getAssociatedTokenAddress(mintPubkey, senderPubkey);
      const recipientAta = await getAssociatedTokenAddress(mintPubkey, recipientPubkey);

      const { createAssociatedTokenAccountIdempotentInstruction, createTransferInstruction } = await import('@solana/spl-token');

      tx.add(
        createAssociatedTokenAccountIdempotentInstruction(
          senderPubkey,
          recipientAta,
          recipientPubkey,
          mintPubkey
        ),
        createTransferInstruction(
          senderAta,
          recipientAta,
          senderPubkey,
          Math.round(amount * 1_000_000)
        )
      );
    }

    const signedTx = await provider.signTransaction(tx);
    const signature = await connection.sendRawTransaction(signedTx.serialize());
    await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
    return signature;
  }

  // ── Sona Embedded HD Wallet ─────────────────────────────────────────
  const secretKey = await getSolanaKeypair(uid);
  if (!secretKey) {
    throw new Error('Wallet key not available for signing. Please make sure you are signed in.');
  }

  const senderKeypair = Keypair.fromSecretKey(secretKey);

  const tx = new Transaction({
    recentBlockhash: blockhash,
    feePayer: senderKeypair.publicKey,
  });

  if (symbol === 'SOL') {
    const lamports = Math.round(amount * LAMPORTS_PER_SOL);
    tx.add(
      SystemProgram.transfer({
        fromPubkey: senderKeypair.publicKey,
        toPubkey: recipientPubkey,
        lamports,
      })
    );
  } else {
    const mintAddress = getUsdcMint();
    const mintPubkey = new PublicKey(mintAddress);
    const senderAta = await getAssociatedTokenAddress(mintPubkey, senderKeypair.publicKey);
    const recipientAta = await getAssociatedTokenAddress(mintPubkey, recipientPubkey);

    const { createAssociatedTokenAccountIdempotentInstruction, createTransferInstruction } = await import('@solana/spl-token');

    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        senderKeypair.publicKey,
        recipientAta,
        recipientPubkey,
        mintPubkey
      ),
      createTransferInstruction(
        senderAta,
        recipientAta,
        senderKeypair.publicKey,
        Math.round(amount * 1_000_000)
      )
    );
  }

  const signature = await sendAndConfirmTransaction(connection, tx, [senderKeypair], {
    commitment: 'confirmed',
  });

  return signature;
}

/**
 * Request 1 SOL airdrop on Solana Devnet.
 * Throws friendly error if cluster rate limits or user is on mainnet.
 */
export async function requestDevnetAirdrop(address) {
  if (getActiveNetwork() === 'mainnet-beta') {
    throw new Error('Airdrops are only available on Solana Devnet.');
  }
  if (!address || address.startsWith('DEMO')) {
    throw new Error('Invalid address for airdrop.');
  }

  const connection = new Connection(getRpcUrl(), 'confirmed');
  const pubkey = new PublicKey(address);

  try {
    const signature = await connection.requestAirdrop(pubkey, 1 * LAMPORTS_PER_SOL);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
    return { success: true, signature };
  } catch (err) {
    console.error('[Sona] Devnet airdrop failed:', err);
    throw new Error(err.message?.includes('429') ? 'Devnet faucet rate limit reached. Try again in 1 minute.' : 'Could not request airdrop. Please try again or use Solana Devnet Faucet.');
  }
}
