import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import PinModal from '../components/PinModal.jsx';
import MnemonicModal from '../components/MnemonicModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getAvatarUrl } from '../utils/avatar.js';
import { truncateAddress } from '../utils/format.js';
import { createHDWallet, restoreHDWallet } from '../services/hdWalletService.js';

const CHAIN_META = {
  solana:   { label: 'Solana',    symbol: '◎', color: '#14F195', bg: '#14F19514' },
  ethereum: { label: 'Ethereum',  symbol: 'Ξ', color: '#627EEA', bg: '#627EEA14' },
  bnb:      { label: 'BNB Chain', symbol: '⬡', color: '#F0B90B', bg: '#F0B90B14' },
  bitcoin:  { label: 'Bitcoin',   symbol: '₿', color: '#F7931A', bg: '#F7931A14' },
};

function WalletRow({ chain, address, onGenerate, generating, last }) {
  const [copied, setCopied] = useState(false);
  const meta = CHAIN_META[chain];

  const copy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '13px 20px',
      borderBottom: last ? 'none' : '1px solid var(--color-border)',
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 11,
        background: meta.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, color: meta.color, fontWeight: 700, flexShrink: 0,
      }}>
        {meta.symbol}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{meta.label}</div>
        {address ? (
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--color-text-secondary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {truncateAddress(address)}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
            Not generated
          </div>
        )}
      </div>

      {address ? (
        <button
          onClick={copy}
          style={{
            background: copied ? 'var(--color-positive)' : 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 8, padding: '5px 12px',
            fontSize: 11, fontWeight: 600,
            cursor: 'pointer',
            color: copied ? '#fff' : 'var(--color-text-secondary)',
            flexShrink: 0, transition: 'all 0.2s', minWidth: 70,
          }}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      ) : (
        <button
          onClick={() => onGenerate(chain)}
          disabled={generating === chain}
          style={{
            background: generating === chain
              ? 'var(--color-surface-2)'
              : `linear-gradient(135deg, ${meta.color}22, ${meta.color}44)`,
            border: `1px solid ${meta.color}55`,
            borderRadius: 8, padding: '5px 12px',
            fontSize: 11, fontWeight: 600,
            cursor: generating === chain ? 'default' : 'pointer',
            color: meta.color, flexShrink: 0, minWidth: 70,
          }}
        >
          {generating === chain ? '…' : 'Generate'}
        </button>
      )}
    </div>
  );
}

export default function Profile() {
  const { user, signOut, setUser } = useAuth();
  const navigate                   = useNavigate();
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [mnemonicModalOpen, setMnemonicModalOpen] = useState(false);
  const [wallets, setWallets]      = useState(user?.wallets || {});
  const [generating, setGenerating] = useState(null);

  const handleGenerate = async (chainKey) => {
    if (!user) return;
    setGenerating(chainKey);
    try {
      const uid = user.id || user.uid;
      let addresses = user?.wallets;
      const restored = await restoreHDWallet(uid);
      if (restored?.addresses) {
        addresses = restored.addresses;
      } else if (!addresses?.solana) {
        const hd = await createHDWallet(uid);
        addresses = hd.addresses;
      }
      const newWallets = { ...wallets, ...addresses };
      setWallets(newWallets);
      if (setUser) setUser({ ...user, wallets: newWallets });
    } catch (e) {
      console.error('[Sona] Wallet generation failed:', e);
    } finally {
      setGenerating(null);
    }
  };

  const chains = ['solana', 'ethereum', 'bnb', 'bitcoin'];
  const hasAnyWallet = chains.some(c => wallets[c]);

  return (
    <div className="app-main">
      <Header title="Profile" />
      <div className="page-container" style={{ maxWidth: 540, paddingBottom: 48 }}>

        {user && (
          <>
            {/* ── Avatar hero ── */}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '28px 20px 24px',
              background: 'var(--color-surface)',
              borderRadius: 20, border: '1px solid var(--color-border)',
              marginBottom: 20,
            }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                overflow: 'hidden', flexShrink: 0,
                border: '3px solid var(--color-accent)',
                boxShadow: '0 0 0 6px var(--color-accent)15, 0 8px 24px rgba(0,0,0,0.2)',
                marginBottom: 14,
              }}>
                <img
                  src={getAvatarUrl(user)}
                  alt="avatar"
                  width={80} height={80}
                  style={{ display: 'block' }}
                />
              </div>
              <div style={{ fontWeight: 800, fontSize: 20, textAlign: 'center' }}>
                {user.name || 'Sona User'}
              </div>
              {user.email && (
                <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                  {user.email}
                </div>
              )}
              <div style={{
                marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'var(--color-accent)15',
                borderRadius: 20, padding: '5px 12px',
                border: '1px solid var(--color-accent)30',
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: 'var(--color-positive)',
                  display: 'inline-block',
                  boxShadow: '0 0 6px var(--color-positive)',
                }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-accent)' }}>
                  Sona Wallet Active
                </span>
              </div>
            </div>

            {/* ── Wallets ── */}
            <div style={{
              background: 'var(--color-surface)',
              borderRadius: 18, border: '1px solid var(--color-border)',
              overflow: 'hidden', marginBottom: 20,
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 20px 10px',
                borderBottom: '1px solid var(--color-border)',
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>My Wallets</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                    {hasAnyWallet ? '' : 'Generate addresses to receive crypto'}
                  </div>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => navigate('/receive')}
                  style={{ fontSize: 11 }}
                >
                  Receive ↓
                </button>
              </div>
              {chains.map((chain, i) => (
                <WalletRow
                  key={chain}
                  chain={chain}
                  address={wallets[chain]}
                  onGenerate={handleGenerate}
                  generating={generating}
                  last={i === chains.length - 1}
                />
              ))}
            </div>

            {/* ── Security ── */}
            <div style={{
              background: 'var(--color-surface)',
              borderRadius: 18, border: '1px solid var(--color-border)',
              overflow: 'hidden', marginBottom: 20,
            }}>
              <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Security & Recovery</div>
              </div>
              <InfoRow label="Sign-in method" value={user.authMethod === 'google' ? '🔵 Google' : '🔐 Wallet'} />
              <InfoRow label="Transaction PIN" value={user.pinIsSet ? '✓ Configured' : 'Not set'} />
              <InfoRow label="Secret Seed Phrase" value="🔑 12 Words Backed Up" last />
              
              <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: 13, width: '100%' }}
                  onClick={() => setPinModalOpen(true)}
                >
                  {user.pinIsSet ? 'Change Transaction PIN' : 'Create Transaction PIN'}
                </button>
                <button
                  className="btn btn-secondary"
                  style={{
                    fontSize: 13, width: '100%',
                    background: 'rgba(201,145,58,0.12)',
                    borderColor: 'rgba(201,145,58,0.35)',
                    color: '#E8B966',
                    fontWeight: 600,
                  }}
                  onClick={() => setMnemonicModalOpen(true)}
                >
                  🔑 View Secret Recovery Phrase (12 Words)
                </button>
              </div>
            </div>

            {/* ── Sign out ── */}
            <button
              onClick={signOut}
              style={{
                width: '100%', padding: '14px',
                background: 'transparent',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 14, fontSize: 14, fontWeight: 600,
                color: 'var(--color-negative)', cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(239,68,68,0.08)';
                e.currentTarget.style.borderColor = 'var(--color-negative)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)';
              }}
            >
              Sign out
            </button>
          </>
        )}
      </div>

      <PinModal
        open={pinModalOpen}
        mode={user?.pinIsSet ? 'verify' : 'create'}
        onClose={() => setPinModalOpen(false)}
        onSuccess={() => {
          setPinModalOpen(false);
          if (user && setUser) {
            setUser({ ...user, pinIsSet: true });
          }
        }}
      />

      <MnemonicModal
        open={mnemonicModalOpen}
        onClose={() => setMnemonicModalOpen(false)}
        user={user}
      />
    </div>
  );
}

function InfoRow({ label, value, last }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '11px 20px',
      borderBottom: last ? 'none' : '1px solid var(--color-border)',
      fontSize: 13,
    }}>
      <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}
