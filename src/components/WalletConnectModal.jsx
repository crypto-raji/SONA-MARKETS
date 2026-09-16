/**
 * WalletConnectModal — RainbowKit-style single connect button + modal.
 *
 * Detects all installed browser wallets automatically, shows them first
 * with a "Detected" badge, and lists others as install prompts.
 * Supports Solana (Phantom, Backpack, Solflare) and EVM (MetaMask, Coinbase,
 * Brave, OKX, Trust Wallet, Rainbow).
 *
 * No external SDK, no API key, no WalletConnect project ID required.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';

// ── Wallet registry ─────────────────────────────────────────────────────────

const WALLETS = [
  {
    id: 'phantom', name: 'Phantom', chain: 'solana',
    icon: (
      <svg width="32" height="32" viewBox="0 0 128 128" fill="none">
        <rect width="128" height="128" rx="28" fill="#AB71F9"/>
        <path d="M110.584 64.9142C110.584 88.2924 91.3088 107.121 67.4511 107.121C43.5934 107.121 24.3184 88.2924 24.3184 64.9142C24.3184 41.536 43.5934 22.707 67.4511 22.707C91.3088 22.707 110.584 41.536 110.584 64.9142Z" fill="white"/>
        <path d="M88.5 64.5C88.5 74.165 80.665 82 71 82C61.335 82 53.5 74.165 53.5 64.5C53.5 54.835 61.335 47 71 47C80.665 47 88.5 54.835 88.5 64.5Z" fill="#AB71F9"/>
        <circle cx="71" cy="60" r="5" fill="white"/>
        <circle cx="83" cy="57" r="5" fill="white"/>
      </svg>
    ),
    detect: () => !!(window?.phantom?.solana?.isPhantom || window?.solana?.isPhantom),
    connect: async () => {
      const p = window?.phantom?.solana ?? window?.solana;
      if (!p?.isPhantom) { window.open('https://phantom.app/', '_blank'); throw new Error('Phantom not installed'); }
      const r = await p.connect();
      return { address: r.publicKey.toString(), chain: 'solana', provider: 'phantom' };
    },
    url: 'https://phantom.app',
  },
  {
    id: 'metamask', name: 'MetaMask', chain: 'ethereum',
    icon: (
      <svg width="32" height="32" viewBox="0 0 35 33" fill="none">
        <polygon points="32.9582,1 19.8241,10.7183 22.2665,4.99085" fill="#E17726" stroke="#E17726" strokeWidth="0.25" strokeLinejoin="round"/>
        <polygon points="2.66284,1 15.6899,10.809 13.3535,4.99085" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinejoin="round"/>
        <polygon points="28.2295,23.5335 24.7975,28.872 32.2503,30.9316 34.3917,23.6501" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinejoin="round"/>
        <polygon points="1.23047,23.6501 3.36024,30.9316 10.8025,28.872 7.3811,23.5335" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinejoin="round"/>
        <polygon points="10.4285,14.5149 8.34668,17.6507 15.7384,17.9893 15.4895,9.9805" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinejoin="round"/>
        <polygon points="25.1917,14.5149 20.1451,9.89185 19.9478,17.9893 27.2833,17.6507" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinejoin="round"/>
        <polygon points="10.8025,28.872 15.2955,26.7014 11.4372,23.7032" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinejoin="round"/>
        <polygon points="20.3247,26.7014 24.7975,28.872 24.1831,23.7032" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinejoin="round"/>
      </svg>
    ),
    detect: () => !!(window?.ethereum?.isMetaMask && !window?.ethereum?.isBraveWallet),
    connect: async () => {
      if (!window?.ethereum) { window.open('https://metamask.io/', '_blank'); throw new Error('MetaMask not installed'); }
      const [address] = await window.ethereum.request({ method: 'eth_requestAccounts' });
      return { address, chain: 'ethereum', provider: 'metamask' };
    },
    url: 'https://metamask.io',
  },
  {
    id: 'coinbase', name: 'Coinbase Wallet', chain: 'ethereum',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="#1652F0"/>
        <path fillRule="evenodd" clipRule="evenodd" d="M16 6C10.477 6 6 10.477 6 16s4.477 10 10 10 10-4.477 10-10S21.523 6 16 6zm-3 8a1 1 0 000 2h6a1 1 0 100-2h-6z" fill="white"/>
      </svg>
    ),
    detect: () => !!(window?.ethereum?.isCoinbaseWallet || window?.coinbaseWalletExtension),
    connect: async () => {
      const eth = window?.ethereum?.isCoinbaseWallet ? window.ethereum : window?.coinbaseWalletExtension;
      if (!eth) { window.open('https://www.coinbase.com/wallet', '_blank'); throw new Error('Coinbase Wallet not installed'); }
      const [address] = await eth.request({ method: 'eth_requestAccounts' });
      return { address, chain: 'ethereum', provider: 'coinbase' };
    },
    url: 'https://www.coinbase.com/wallet',
  },
  {
    id: 'backpack', name: 'Backpack', chain: 'solana',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="#E7352B"/>
        <path d="M16 5C11.029 5 7 9.029 7 14v2a1 1 0 001 1h2v5a2 2 0 002 2h8a2 2 0 002-2v-5h2a1 1 0 001-1v-2c0-4.971-4.029-9-9-9zm0 2a7 7 0 017 7v1H9v-1a7 7 0 017-7z" fill="white"/>
      </svg>
    ),
    detect: () => !!(window?.backpack?.isBackpack),
    connect: async () => {
      if (!window?.backpack) { window.open('https://backpack.app/', '_blank'); throw new Error('Backpack not installed'); }
      await window.backpack.connect();
      return { address: window.backpack.publicKey?.toString(), chain: 'solana', provider: 'backpack' };
    },
    url: 'https://backpack.app',
  },
  {
    id: 'solflare', name: 'Solflare', chain: 'solana',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="#FC7227"/>
        <path d="M16 6L26 26H6L16 6Z" fill="white" opacity="0.9"/>
        <path d="M16 12L22 24H10L16 12Z" fill="#FC7227"/>
      </svg>
    ),
    detect: () => !!(window?.solflare?.isSolflare),
    connect: async () => {
      if (!window?.solflare) { window.open('https://solflare.com/', '_blank'); throw new Error('Solflare not installed'); }
      await window.solflare.connect();
      return { address: window.solflare.publicKey?.toString(), chain: 'solana', provider: 'solflare' };
    },
    url: 'https://solflare.com',
  },
  {
    id: 'brave', name: 'Brave Wallet', chain: 'ethereum',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="#FB542B"/>
        <path d="M16 5L23 8.5L25 14L23 20L16 27L9 20L7 14L9 8.5L16 5Z" fill="white"/>
        <path d="M16 9L21 11.5L22.5 15.5L21 20L16 24L11 20L9.5 15.5L11 11.5L16 9Z" fill="#FB542B"/>
      </svg>
    ),
    detect: () => !!(window?.ethereum?.isBraveWallet),
    connect: async () => {
      if (!window?.ethereum?.isBraveWallet) { throw new Error('Open in Brave browser to use Brave Wallet'); }
      const [address] = await window.ethereum.request({ method: 'eth_requestAccounts' });
      return { address, chain: 'ethereum', provider: 'brave' };
    },
    url: 'https://brave.com/wallet/',
  },
  {
    id: 'okx', name: 'OKX Wallet', chain: 'ethereum',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="#000"/>
        <rect x="7" y="7" width="7" height="7" rx="1" fill="white"/>
        <rect x="18" y="7" width="7" height="7" rx="1" fill="white"/>
        <rect x="7" y="18" width="7" height="7" rx="1" fill="white"/>
        <rect x="18" y="18" width="7" height="7" rx="1" fill="white"/>
        <rect x="12.5" y="12.5" width="7" height="7" rx="1" fill="white"/>
      </svg>
    ),
    detect: () => !!(window?.okxwallet),
    connect: async () => {
      if (!window?.okxwallet) { window.open('https://www.okx.com/web3', '_blank'); throw new Error('OKX Wallet not installed'); }
      const [address] = await window.okxwallet.request({ method: 'eth_requestAccounts' });
      return { address, chain: 'ethereum', provider: 'okx' };
    },
    url: 'https://www.okx.com/web3',
  },
  {
    id: 'trust', name: 'Trust Wallet', chain: 'ethereum',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="#3375BB"/>
        <path d="M16 5L9 8V15C9 19.418 12.02 23.573 16 25C19.98 23.573 23 19.418 23 15V8L16 5Z" fill="white"/>
      </svg>
    ),
    detect: () => !!(window?.ethereum?.isTrust || window?.trustwallet),
    connect: async () => {
      const eth = window?.trustwallet ?? window?.ethereum;
      if (!eth) { window.open('https://trustwallet.com/', '_blank'); throw new Error('Trust Wallet not installed'); }
      const [address] = await eth.request({ method: 'eth_requestAccounts' });
      return { address, chain: 'ethereum', provider: 'trust' };
    },
    url: 'https://trustwallet.com',
  },
];

const CHAIN_LABEL = { solana: 'Solana', ethereum: 'Ethereum / EVM' };

// ── Modal component ──────────────────────────────────────────────────────────

const CSS = `
  .wcm-overlay {
    position: fixed; inset: 0; z-index: 9999;
    display: flex; align-items: flex-end; justify-content: center;
    background: rgba(0,0,0,0.7);
    backdrop-filter: blur(6px);
    animation: wcm-fade-in 0.18s ease;
    padding: 0 0 env(safe-area-inset-bottom);
  }
  @media (min-width: 520px) {
    .wcm-overlay { align-items: center; }
  }
  @keyframes wcm-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  .wcm-panel {
    background: #13152A;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 24px 24px 0 0;
    width: 100%;
    max-width: 440px;
    max-height: 90vh;
    overflow-y: auto;
    padding: 0 0 24px;
    animation: wcm-slide-up 0.22s cubic-bezier(0.34,1.56,0.64,1);
    position: relative;
  }
  @media (min-width: 520px) {
    .wcm-panel {
      border-radius: 24px;
      max-height: 80vh;
    }
  }
  @keyframes wcm-slide-up {
    from { transform: translateY(32px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }

  .wcm-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px 20px 0;
    position: sticky; top: 0; background: #13152A; z-index: 1;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    padding-bottom: 16px;
  }
  .wcm-title {
    font-size: 15px; font-weight: 700;
    color: #E8EDF8; letter-spacing: -0.2px;
  }
  .wcm-close {
    width: 28px; height: 28px; border-radius: 50%;
    border: none; background: rgba(255,255,255,0.06);
    color: #8A9FBF; font-size: 14px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: background 0.15s;
    flex-shrink: 0;
  }
  .wcm-close:hover { background: rgba(255,255,255,0.12); }

  .wcm-section-label {
    font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
    text-transform: uppercase; color: #3D4F6E;
    padding: 16px 20px 8px;
  }

  .wcm-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    padding: 0 16px;
  }
  @media (max-width: 360px) {
    .wcm-grid { grid-template-columns: repeat(3, 1fr); }
  }

  .wcm-wallet {
    display: flex; flex-direction: column; align-items: center;
    gap: 6px; padding: 12px 4px;
    border-radius: 14px; border: 1px solid transparent;
    background: rgba(255,255,255,0.03);
    cursor: pointer; position: relative;
    transition: background 0.15s, border-color 0.15s, transform 0.12s;
    text-align: center;
  }
  .wcm-wallet:hover:not(:disabled) {
    background: rgba(255,255,255,0.07);
    border-color: rgba(255,255,255,0.10);
    transform: translateY(-2px);
  }
  .wcm-wallet:active:not(:disabled) { transform: translateY(0); }
  .wcm-wallet:disabled { opacity: 0.45; cursor: not-allowed; }

  .wcm-wallet-icon {
    width: 48px; height: 48px; border-radius: 12px;
    overflow: hidden; display: flex; align-items: center;
    justify-content: center; flex-shrink: 0;
  }
  .wcm-wallet-name {
    font-size: 11px; font-weight: 500; color: #8A9FBF;
    line-height: 1.2; max-width: 70px;
  }
  .wcm-wallet-badge {
    position: absolute; top: 6px; right: 6px;
    width: 8px; height: 8px; border-radius: 50%;
    background: #00C48C;
    box-shadow: 0 0 0 2px #13152A;
  }
  .wcm-wallet-loading {
    position: absolute; inset: 0; border-radius: 14px;
    background: rgba(19,21,42,0.75);
    display: flex; align-items: center; justify-content: center;
  }
  .wcm-spinner {
    width: 18px; height: 18px; border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.15);
    border-top-color: #C9913A;
    animation: wcm-spin 0.7s linear infinite;
  }
  @keyframes wcm-spin { to { transform: rotate(360deg); } }

  .wcm-status {
    font-size: 12px; text-align: center; padding: 10px 20px 0;
    line-height: 1.4;
  }
  .wcm-status--error   { color: #FF4F5E; }
  .wcm-status--info    { color: #8A9FBF; }

  .wcm-footer {
    font-size: 11px; color: #2D3D5A; text-align: center;
    padding: 16px 20px 0; line-height: 1.5;
  }
  .wcm-footer a { color: #4A5A7A; text-decoration: underline; }

  /* ── Trigger button ── */
  .wcm-trigger {
    display: inline-flex; align-items: center; gap: 8px;
    border: 1px solid rgba(255,255,255,0.10);
    background: rgba(255,255,255,0.04);
    border-radius: 10px; padding: 0 18px;
    height: 50px; width: 100%;
    font-family: 'Outfit', system-ui, sans-serif;
    font-size: 14px; font-weight: 500;
    color: #C8D3E8; cursor: pointer;
    justify-content: center;
    transition: background 0.18s, border-color 0.18s, transform 0.12s;
    letter-spacing: 0.01em;
  }
  .wcm-trigger:hover:not(:disabled) {
    background: rgba(255,255,255,0.08);
    border-color: rgba(255,255,255,0.18);
    transform: translateY(-1px);
  }
  .wcm-trigger:active:not(:disabled) { transform: translateY(0); }
  .wcm-trigger:disabled { opacity: 0.5; cursor: not-allowed; }
`;

function WalletIcon({ wallet }) {
  return (
    <div className="wcm-wallet-icon">
      {wallet.icon}
    </div>
  );
}

export function WalletConnectModal({ onConnect, disabled }) {
  const [open, setOpen]         = useState(false);
  const [detected, setDetected] = useState([]);
  const [others, setOthers]     = useState([]);
  const [loading, setLoading]   = useState(null);
  const [status, setStatus]     = useState(null);
  const overlayRef              = useRef(null);

  useEffect(() => {
    const det = WALLETS.filter((w) => w.detect());
    const oth = WALLETS.filter((w) => !w.detect());
    setDetected(det);
    setOthers(oth);
  }, [open]);

  const handleOpen = () => { setStatus(null); setOpen(true); };
  const handleClose = () => { if (!loading) setOpen(false); };

  const handleConnect = useCallback(async (wallet) => {
    setStatus(null);
    setLoading(wallet.id);
    try {
      const result = await wallet.connect();
      await onConnect?.(result);
      setOpen(false);
    } catch (e) {
      const msg = e.message?.includes('not installed')
        ? `${wallet.name} not installed — opening download page…`
        : (e.message || 'Connection declined.');
      setStatus({ msg, type: 'error' });
    } finally {
      setLoading(null);
    }
  }, [onConnect]);

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) handleClose();
  };

  return (
    <>
      <style>{CSS}</style>

      <button
        className="wcm-trigger"
        onClick={handleOpen}
        disabled={disabled}
        aria-haspopup="dialog"
      >
        <WalletIcon2 />
        Connect a Wallet
      </button>

      {open && (
        <div className="wcm-overlay" ref={overlayRef} onClick={handleOverlayClick} role="dialog" aria-modal="true" aria-label="Connect wallet">
          <div className="wcm-panel">
            <div className="wcm-header">
              <span className="wcm-title">Connect a Wallet</span>
              <button className="wcm-close" onClick={handleClose} aria-label="Close">✕</button>
            </div>

            {detected.length > 0 && (
              <>
                <div className="wcm-section-label">Detected</div>
                <div className="wcm-grid">
                  {detected.map((w) => (
                    <WalletButton key={w.id} wallet={w} loading={loading} onConnect={handleConnect} />
                  ))}
                </div>
              </>
            )}

            {others.length > 0 && (
              <>
                <div className="wcm-section-label">{detected.length > 0 ? 'Popular wallets' : 'Choose a wallet'}</div>
                <div className="wcm-grid">
                  {others.map((w) => (
                    <WalletButton key={w.id} wallet={w} loading={loading} onConnect={handleConnect} />
                  ))}
                </div>
              </>
            )}

            {status && (
              <div className={`wcm-status wcm-status--${status.type}`}>{status.msg}</div>
            )}

            <p className="wcm-footer">
              New to wallets?{' '}
              <a href="https://phantom.app" target="_blank" rel="noopener noreferrer">Get Phantom</a> for Solana
              {' '}or{' '}
              <a href="https://metamask.io" target="_blank" rel="noopener noreferrer">MetaMask</a> for Ethereum.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function WalletButton({ wallet, loading, onConnect }) {
  const isLoading = loading === wallet.id;
  const isDetected = wallet.detect();
  return (
    <button
      className="wcm-wallet"
      onClick={() => onConnect(wallet)}
      disabled={loading !== null}
      title={isDetected ? `Connect ${wallet.name}` : `Install ${wallet.name}`}
    >
      <WalletIcon wallet={wallet} />
      <span className="wcm-wallet-name">{wallet.name}</span>
      {isDetected && <span className="wcm-wallet-badge" title="Installed" />}
      {isLoading && (
        <span className="wcm-wallet-loading">
          <span className="wcm-spinner" />
        </span>
      )}
    </button>
  );
}

function WalletIcon2() {
  return (
    <svg width="16" height="14" viewBox="0 0 16 14" fill="none" aria-hidden="true">
      <rect x="0.5" y="0.5" width="15" height="13" rx="2.5" stroke="currentColor" strokeOpacity="0.5"/>
      <rect x="10" y="5" width="5" height="4" rx="1" fill="currentColor" opacity="0.7"/>
      <circle cx="12.5" cy="7" r="1" fill="currentColor"/>
    </svg>
  );
}
