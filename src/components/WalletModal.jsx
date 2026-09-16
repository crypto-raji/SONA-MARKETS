import React, { useState } from 'react';
import * as walletService from '../services/walletService.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getActiveNetwork, getNetworkInfo } from '../constants/network.js';

export default function WalletModal({ open, onClose }) {
  const { connectWalletSession, user } = useAuth();
  const [connecting, setConnecting] = useState(null);
  const [error, setError] = useState(null);
  const wallets = walletService.listAvailableWallets();
  const networkInfo = getNetworkInfo(getActiveNetwork());

  if (!open) return null;

  const handleConnect = async (walletId) => {
    setConnecting(walletId);
    setError(null);
    try {
      const result = await walletService.connectWallet(walletId);
      connectWalletSession({
        ...(user || {}),
        walletAddress: result.address,
        walletProvider: result.provider,
        walletNetwork: result.network,
        authMethod: 'wallet',
      });
      onClose();
    } catch (e) {
      setError(e.message || 'Failed to connect wallet.');
    } finally {
      setConnecting(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: 'var(--space-5)' }}>
          <h2 style={{ fontSize: 18, marginBottom: 4 }}>Connect a wallet</h2>
          <p className="text-secondary" style={{ fontSize: 13, marginBottom: 'var(--space-3)' }}>
            Choose a Solana-compatible wallet to connect.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 'var(--space-5)' }}>
            <span className={`pill ${networkInfo.isProduction ? 'pill-warning' : 'pill-neutral'}`}>
              {networkInfo.label}
            </span>
            <span className="text-tertiary" style={{ fontSize: 12 }}>
              — change this in Settings &gt; Wallet Network
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {wallets.map((wallet) => (
              <button
                key={wallet.id}
                className="btn btn-secondary btn-block"
                style={{ justifyContent: 'space-between' }}
                disabled={connecting === wallet.id}
                onClick={() => handleConnect(wallet.id)}
              >
                <span>{wallet.name}</span>
                <span className="text-tertiary" style={{ fontSize: 12 }}>
                  {connecting === wallet.id ? 'Connecting...' : wallet.installed ? 'Detected' : 'Not detected'}
                </span>
              </button>
            ))}
          </div>

          {error && <p className="text-negative" style={{ fontSize: 13, marginTop: 'var(--space-3)' }}>{error}</p>}

          <p className="text-tertiary" style={{ fontSize: 11, marginTop: 'var(--space-4)' }}>
            Sona never asks for your private key or seed phrase. If an extension
            isn't detected, connecting falls back to a clearly labeled demo address
            so you can explore the UI.
          </p>
        </div>
      </div>
    </div>
  );
}
