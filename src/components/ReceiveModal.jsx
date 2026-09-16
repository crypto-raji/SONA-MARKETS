import React, { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import AssetLogo from './AssetLogo.jsx';
import { ALL_ASSETS, SUPPORTED_NETWORKS, getAssetBySymbol } from '../constants/assets.js';
import { useAuth } from '../context/AuthContext.jsx';
import { createHDWallet, restoreHDWallet } from '../services/hdWalletService.js';
import { getWalletBalance, waitForDeposit } from '../services/walletService.js';
import { receiveAsset } from '../services/transactionService.js';

// Map network names to the wallet key in user.wallets
const NETWORK_TO_WALLET_KEY = {
  'Solana':    'solana',
  'Ethereum':  'ethereum',
  'BNB Chain': 'bnb',
  'Bitcoin':   'bitcoin',
};

// Which assets live on which network
const ASSET_NETWORK = {
  SOL:  'Solana',
  USDC: 'Solana',
  ETH:  'Ethereum',
  BNB:  'BNB Chain',
  BTC:  'Bitcoin',
};

function getDefaultNetwork(symbol) {
  return ASSET_NETWORK[symbol] || 'Solana';
}

function useQRCode(text) {
  const [dataUrl, setDataUrl] = useState(null);
  useEffect(() => {
    if (!text) { setDataUrl(null); return; }
    QRCode.toDataURL(text, {
      width: 200,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    }).then(setDataUrl).catch(() => setDataUrl(null));
  }, [text]);
  return dataUrl;
}

export default function ReceiveModal({ open = true, onClose, defaultSymbol, asModal = true }) {
  const { user, setUser } = useAuth();
  const [symbol, setSymbol] = useState(defaultSymbol || 'SOL');
  const [network, setNetwork] = useState(getDefaultNetwork(defaultSymbol || 'SOL'));
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [localWallets, setLocalWallets] = useState(user?.wallets || {});

  // Keep localWallets in sync when user changes
  useEffect(() => { setLocalWallets(user?.wallets || {}); }, [user]);

  // Sync network when symbol changes
  function handleSymbolChange(s) {
    setSymbol(s);
    setNetwork(getDefaultNetwork(s));
  }

  const walletKey = NETWORK_TO_WALLET_KEY[network];
  const address = localWallets[walletKey] || null;
  const qrUrl   = useQRCode(address);

  // ── Deposit detection (Solana only) ─────────────────────────────────────────
  const [depositStatus, setDepositStatus] = useState('idle'); // idle | watching | confirmed | timeout
  const [depositedSol, setDepositedSol] = useState(null);
  const watchingRef = useRef(false);
  const prevSolRef  = useRef(null);

  const startWatching = useCallback(async () => {
    if (!address || network !== 'Solana' || watchingRef.current) return;
    watchingRef.current = true;
    setDepositStatus('watching');
    setDepositedSol(null);

    // Snapshot current balance before watching
    const { sol: currentSol } = await getWalletBalance(address);
    prevSolRef.current = currentSol;

    const result = await waitForDeposit(address, currentSol, { intervalMs: 5000, timeoutMs: 180_000 });
    watchingRef.current = false;

    if (result.received) {
      setDepositStatus('confirmed');
      setDepositedSol(result.sol - currentSol);
      // Record in Firestore
      try { await receiveAsset({ symbol: 'SOL', network: 'Solana' }); } catch {}
    } else {
      setDepositStatus('timeout');
    }
  }, [address, network]);

  // Reset watcher when address or network changes
  useEffect(() => {
    watchingRef.current = false;
    setDepositStatus('idle');
    setDepositedSol(null);
  }, [address, network]);

  async function handleGenerate() {
    if (!user || generating) return;
    setGenerating(true);
    try {
      const uid = user.id || user.uid;
      const restored = await restoreHDWallet(uid);
      const addresses = restored?.addresses || (await createHDWallet(uid)).addresses;
      const newWallets = { ...localWallets, ...addresses };
      setLocalWallets(newWallets);
      if (setUser) setUser({ ...user, wallets: newWallets });
    } catch (e) {
      console.error('[Sona] Wallet gen failed:', e);
    } finally {
      setGenerating(false);
    }
  }

  if (!open) return null;

  const asset = getAssetBySymbol(symbol);

  const handleCopy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const content = (
    <div style={{ padding: asModal ? 'var(--space-5)' : 0 }}>
      {asModal && <h2 style={{ fontSize: 18, marginBottom: 'var(--space-4)' }}>Receive assets</h2>}

      <label className="text-secondary" style={{ fontSize: 13 }}>Asset</label>
      <select
        className="input-field"
        value={symbol}
        onChange={(e) => handleSymbolChange(e.target.value)}
        style={{ margin: '6px 0 var(--space-3)' }}
      >
        {ALL_ASSETS.map((a) => (
          <option key={a.symbol} value={a.symbol}>{a.name} ({a.symbol})</option>
        ))}
      </select>

      <label className="text-secondary" style={{ fontSize: 13 }}>Network</label>
      <select
        className="input-field"
        value={network}
        onChange={(e) => setNetwork(e.target.value)}
        style={{ margin: '6px 0 var(--space-4)' }}
      >
        {SUPPORTED_NETWORKS.map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>

      <div className="card" style={{ padding: 'var(--space-5)', textAlign: 'center', marginBottom: 'var(--space-4)' }}>
        {asset && <AssetLogo symbol={asset.symbol} color={asset.color} monogram={asset.monogram} size={44} />}

        {/* QR code */}
        <div style={{ margin: 'var(--space-4) auto', width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {address ? (
            qrUrl ? (
              <img src={qrUrl} alt={`QR code for ${network} address`} width={200} height={200} style={{ borderRadius: 8 }} />
            ) : (
              <div style={{ width: 200, height: 200, background: 'var(--color-surface-2)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="text-tertiary" style={{ fontSize: 12 }}>Generating QR…</span>
              </div>
            )
          ) : (
            <div style={{ width: 200, height: 200, background: 'var(--color-surface-2)', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 }}>
              <span style={{ fontSize: 32 }}>🔑</span>
              <span className="text-tertiary" style={{ fontSize: 12, textAlign: 'center', lineHeight: 1.5 }}>
                No {network} address yet. Generate one to start receiving.
              </span>
              <button
                onClick={handleGenerate}
                disabled={generating}
                style={{
                  padding: '7px 18px', borderRadius: 8, border: 'none',
                  background: 'var(--color-accent)', color: '#fff',
                  fontSize: 12, fontWeight: 600, cursor: generating ? 'default' : 'pointer',
                  opacity: generating ? 0.7 : 1,
                }}
              >
                {generating ? 'Generating…' : 'Generate Address'}
              </button>
            </div>
          )}
        </div>

        <p className="text-secondary" style={{ fontSize: 12, marginBottom: 4 }}>{network} receiving address</p>
        {address ? (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, wordBreak: 'break-all', padding: '0 var(--space-2)' }}>
            {address}
          </p>
        ) : (
          <p className="text-tertiary" style={{ fontSize: 12 }}>No address — tap Generate above</p>
        )}
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <button
          className="btn btn-secondary btn-block"
          onClick={handleCopy}
          disabled={!address}
        >
          {copied ? 'Copied!' : 'Copy address'}
        </button>
        {navigator.share && address && (
          <button className="btn btn-secondary" onClick={() => navigator.share({ text: address })}>Share</button>
        )}
      </div>

      {/* Deposit detection — Solana only */}
      {address && network === 'Solana' && (
        <div style={{ marginTop: 'var(--space-4)' }}>
          {depositStatus === 'idle' && (
            <button
              className="btn btn-ghost btn-block"
              onClick={startWatching}
              style={{ fontSize: 13 }}
            >
              Watch for incoming deposit
            </button>
          )}

          {depositStatus === 'watching' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: 'var(--space-3) var(--space-4)',
              background: 'var(--color-surface-2)', borderRadius: 10,
              fontSize: 13, color: 'var(--color-text-secondary)',
            }}>
              <span style={{
                display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                background: 'var(--color-accent)', animation: 'sonaSpinOuter 1s linear infinite',
              }} />
              Waiting for deposit… (up to 3 min)
            </div>
          )}

          {depositStatus === 'confirmed' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: 'var(--space-3) var(--space-4)',
              background: 'rgba(34,197,94,0.12)', borderRadius: 10,
              fontSize: 13, color: '#16a34a',
            }}>
              ✓ Deposit detected — {depositedSol !== null ? `+${depositedSol.toFixed(4)} SOL` : ''}
              <button
                onClick={() => { setDepositStatus('idle'); setDepositedSol(null); }}
                style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.7, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
              >
                Dismiss
              </button>
            </div>
          )}

          {depositStatus === 'timeout' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: 'var(--space-3) var(--space-4)',
              background: 'var(--color-surface-2)', borderRadius: 10,
              fontSize: 13, color: 'var(--color-text-secondary)',
            }}>
              No deposit detected in 3 min.
              <button
                onClick={() => setDepositStatus('idle')}
                style={{ marginLeft: 'auto', fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent)' }}
              >
                Try again
              </button>
            </div>
          )}
        </div>
      )}

      <p className="text-tertiary" style={{ fontSize: 11, marginTop: 'var(--space-4)' }}>
        Only send {symbol} on the {network} network to this address. Sending on
        the wrong network can result in permanent loss of funds.
      </p>
    </div>
  );

  if (!asModal) return content;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>{content}</div>
    </div>
  );
}
