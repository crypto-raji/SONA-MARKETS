import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import PinModal from '../components/PinModal.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import * as userService from '../services/userService.js';
import { DEFAULT_SETTINGS } from '../services/userService.js';
import { SOLANA_NETWORKS, getActiveNetwork, setActiveNetwork } from '../constants/network.js';
import { getAvatarUrl } from '../utils/avatar.js';
import { createHDWallet, restoreHDWallet } from '../services/hdWalletService.js';

/* ── Toggle ─────────────────────────────────────────────────────────────────── */
function Toggle({ checked, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 48, height: 26, borderRadius: 13, border: 'none',
        cursor: 'pointer',
        background: checked
          ? 'linear-gradient(135deg, var(--color-accent), #6366F1)'
          : 'var(--color-border)',
        position: 'relative', flexShrink: 0,
        transition: 'background 0.25s',
        outline: 'none', padding: 0,
        boxShadow: checked ? '0 2px 8px rgba(99,102,241,0.35)' : 'none',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: checked ? 25 : 3,
        width: 20, height: 20, borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.25s cubic-bezier(.4,0,.2,1)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
      }} />
    </button>
  );
}

/* ── Section wrapper ─────────────────────────────────────────────────────────── */
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      {title && (
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: 'var(--color-text-tertiary)',
          marginBottom: 8, paddingLeft: 4,
        }}>
          {title}
        </div>
      )}
      <div style={{
        background: 'var(--color-surface)',
        borderRadius: 16,
        border: '1px solid var(--color-border)',
        overflow: 'hidden',
      }}>
        {children}
      </div>
    </div>
  );
}

/* ── Setting row ─────────────────────────────────────────────────────────────── */
function Row({ label, sublabel, right, onClick, danger, last }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 16px',
        borderBottom: last ? 'none' : '1px solid var(--color-border)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => onClick && (e.currentTarget.style.background = 'var(--color-surface-2)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 500,
          color: danger ? 'var(--color-negative)' : 'var(--color-text)',
        }}>
          {label}
        </div>
        {sublabel && (
          <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
            {sublabel}
          </div>
        )}
      </div>
      {right}
    </div>
  );
}

/* ── Chain metadata ──────────────────────────────────────────────────────────── */
const CHAIN_META = {
  solana:   { label: 'Solana',    symbol: '◎', color: '#14F195', bg: '#14F19514' },
  ethereum: { label: 'Ethereum',  symbol: 'Ξ', color: '#627EEA', bg: '#627EEA14' },
  bnb:      { label: 'BNB Chain', symbol: '⬡', color: '#F0B90B', bg: '#F0B90B14' },
  bitcoin:  { label: 'Bitcoin',   symbol: '₿', color: '#F7931A', bg: '#F7931A14' },
};

/* ── Wallet row ──────────────────────────────────────────────────────────────── */
function WalletChainRow({ chainKey, address, onGenerate, generating, last }) {
  const [copied, setCopied] = useState(false);
  const meta = CHAIN_META[chainKey];

  const copy = () => {
    if (!address) return;
    navigator.clipboard.writeText(address).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
      borderBottom: last ? 'none' : '1px solid var(--color-border)',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: meta.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 15, color: meta.color, fontWeight: 700, flexShrink: 0,
      }}>
        {meta.symbol}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{meta.label}</div>
        <div style={{
          fontSize: 11, color: 'var(--color-text-tertiary)',
          fontFamily: 'var(--font-mono)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {address
            ? `${address.slice(0, 14)}…${address.slice(-8)}`
            : <span style={{ fontStyle: 'italic' }}>No address — click Generate</span>
          }
        </div>
      </div>

      {address ? (
        <button
          onClick={copy}
          style={{
            background: copied ? 'var(--color-positive)' : 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 8, padding: '5px 10px',
            fontSize: 11, fontWeight: 600, cursor: 'pointer',
            color: copied ? '#fff' : 'var(--color-text-secondary)',
            flexShrink: 0, transition: 'all 0.2s',
          }}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      ) : (
        <button
          onClick={() => onGenerate(chainKey)}
          disabled={generating === chainKey}
          style={{
            background: generating === chainKey
              ? 'var(--color-surface-2)'
              : `linear-gradient(135deg, ${meta.color}22, ${meta.color}44)`,
            border: `1px solid ${meta.color}55`,
            borderRadius: 8, padding: '5px 10px',
            fontSize: 11, fontWeight: 600, cursor: 'pointer',
            color: meta.color, flexShrink: 0,
            transition: 'all 0.2s',
          }}
        >
          {generating === chainKey ? '…' : 'Generate'}
        </button>
      )}
    </div>
  );
}

/* ── Main Settings page ───────────────────────────────────────────────────────── */
export default function Settings() {
  const { theme, setTheme }        = useTheme();
  const { user, signOut, setUser } = useAuth();
  const navigate                   = useNavigate();

  // Start with DEFAULT_SETTINGS so the page renders immediately without a spinner.
  // The Firestore-saved settings update the state in the background.
  const [settings, setSettings]    = useState(DEFAULT_SETTINGS);
  const [wallets, setWallets]      = useState({});
  const [generating, setGenerating] = useState(null);
  const [pinModal, setPinModal]    = useState({ open: false, mode: 'create' });

  useEffect(() => {
    userService.getSettings().then(setSettings).catch(() => {});
  }, []);

  useEffect(() => {
    setWallets(user?.wallets || {});
  }, [user]);

  const update = async (section, key, value) => {
    const next = { ...settings, [section]: { ...settings?.[section], [key]: value } };
    setSettings(next);
    await userService.updateSettings({ [section]: next[section] }).catch(() => {});
  };

  const handleRequirePin = async (enabled) => {
    if (enabled && !user?.pinIsSet) {
      // No PIN set yet — open the create flow before saving the setting
      setPinModal({ open: true, mode: 'create', pendingEnable: true });
      return;
    }
    await update('security', 'requirePinForSends', enabled);
  };

  const handlePinCreated = async () => {
    setPinModal({ open: false });
    if (pinModal.pendingEnable) {
      await update('security', 'requirePinForSends', true);
    }
    if (user) {
      const updatedUser = { ...user, pinIsSet: true };
      if (setUser) setUser(updatedUser);
      try {
        localStorage.setItem('sona_wallet_session', JSON.stringify(updatedUser));
      } catch {}
    }
  };

  const handleGenerateWallet = async (chainKey) => {
    if (!user) return;
    setGenerating(chainKey);
    try {
      const uid = user.id || user.uid;
      const restored = await restoreHDWallet(uid);
      const addresses = restored?.addresses ?? (await createHDWallet(uid)).addresses;
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
  const activeNetwork = getActiveNetwork();

  return (
    <div className="app-main">
      <Header title="Settings" />
      <div className="page-container" style={{ maxWidth: 540, paddingBottom: 48 }}>

        {/* ── Profile card ── */}
        <div
          onClick={() => navigate('/profile')}
          style={{
            display: 'flex', alignItems: 'center', gap: 16,
            padding: '16px 20px', marginBottom: 28,
            background: 'var(--color-surface)',
            borderRadius: 18, border: '1px solid var(--color-border)',
            cursor: 'pointer', transition: 'border-color 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-accent)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
        >
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            overflow: 'hidden', flexShrink: 0,
            border: '2px solid var(--color-accent)',
          }}>
            <img src={getAvatarUrl(user)} alt="avatar" width={52} height={52} style={{ display: 'block' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{user?.name || 'User'}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{user?.email || 'Wallet user'}</div>
          </div>
          <div style={{ fontSize: 18, color: 'var(--color-text-tertiary)' }}>›</div>
        </div>

        {/* ── Preferences ── */}
        <Section title="Preferences">
          <Row
            label="Dark mode"
            sublabel="Toggle the app colour theme"
            right={<Toggle checked={theme === 'dark'} onChange={(v) => setTheme(v ? 'dark' : 'light')} />}
          />
          <Row
            label="Price alerts"
            sublabel="Notify on large price movements"
            right={<Toggle checked={settings.notifications?.priceAlerts ?? false} onChange={(v) => update('notifications', 'priceAlerts', v)} />}
          />
          <Row
            label="Transaction updates"
            sublabel="Confirmations and status changes"
            right={<Toggle checked={settings.notifications?.transactionUpdates ?? false} onChange={(v) => update('notifications', 'transactionUpdates', v)} />}
            last
          />
        </Section>

        {/* ── Security ── */}
        <Section title="Security">
          <Row
            label="Require PIN for sends"
            sublabel={user?.pinIsSet ? 'PIN is set — required before every outgoing transfer' : 'You will be prompted to create a PIN'}
            right={<Toggle checked={settings.security?.requirePinForSends ?? false} onChange={handleRequirePin} />}
          />
          {user?.pinIsSet && (
            <Row
              label="Change PIN"
              sublabel="Update your transaction PIN"
              onClick={() => setPinModal({ open: true, mode: 'create' })}
              right={<span style={{ fontSize: 18, color: 'var(--color-text-tertiary)' }}>›</span>}
            />
          )}
          <Row
            label="Biometric unlock"
            sublabel="Face ID or Touch ID to open Sona"
            right={<Toggle checked={settings.security?.biometricUnlock ?? false} onChange={(v) => update('security', 'biometricUnlock', v)} />}
            last
          />
        </Section>

        {/* ── My Wallets ── */}
        <Section title="My Wallets">
          {chains.map((key, i) => (
            <WalletChainRow
              key={key}
              chainKey={key}
              address={wallets[key]}
              onGenerate={handleGenerateWallet}
              generating={generating}
              last={i === chains.length - 1}
            />
          ))}
        </Section>

        {/* ── External wallet ── */}
        <Section title="External Wallet">
          <ExternalWalletPanel user={user} setUser={setUser} />
        </Section>

        {/* ── Network ── */}
        <Section title="Network">
          {Object.values(SOLANA_NETWORKS).map((net, i, arr) => (
            <Row
              key={net.id}
              label={net.label}
              sublabel={net.sublabel}
              onClick={() => activeNetwork !== net.id && setActiveNetwork(net.id)}
              last={i === arr.length - 1}
              right={
                activeNetwork === net.id ? (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 8,
                    background: net.isProduction ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                    color: net.isProduction ? 'var(--color-negative)' : 'var(--color-positive)',
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                    Active
                  </span>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>Switch ›</span>
                )
              }
            />
          ))}
        </Section>

        {/* ── Sign out ── */}
        <button
          onClick={signOut}
          style={{
            width: '100%', padding: '14px 16px',
            background: 'transparent',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 14, fontSize: 14, fontWeight: 600,
            color: 'var(--color-negative)',
            cursor: 'pointer', transition: 'all 0.2s',
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

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: 'var(--color-text-tertiary)' }}>
          Sona v1.0
        </div>
      </div>

      {/* PIN create / change modal */}
      <PinModal
        open={pinModal.open}
        mode={pinModal.mode}
        onClose={() => setPinModal({ open: false })}
        onSuccess={handlePinCreated}
      />
    </div>
  );
}

/* ── External wallet connect panel ───────────────────────────────────────────── */
function ExternalWalletPanel({ user, setUser }) {
  const [state, setState] = useState('idle');
  const [connectedAddr, setConnectedAddr] = useState(null);
  const [msg, setMsg] = useState('');

  const connectPhantom = useCallback(async () => {
    setState('connecting');
    try {
      const provider = window?.phantom?.solana ?? window?.solana;
      if (!provider?.isPhantom) {
        window.open('https://phantom.app/', '_blank');
        setState('idle');
        setMsg('Phantom not found — install it then refresh.');
        return;
      }
      const resp = await provider.connect();
      const addr = resp.publicKey.toString();
      setConnectedAddr(addr);
      setState('connected');
      if (setUser && user) setUser({ ...user, externalWallet: { chain: 'solana', address: addr, provider: 'phantom' } });
    } catch (e) {
      setState('error');
      setMsg(e.message || 'Connection refused.');
    }
  }, [user, setUser]);

  const connectMetaMask = useCallback(async () => {
    setState('connecting');
    try {
      if (!window?.ethereum) {
        window.open('https://metamask.io/', '_blank');
        setState('idle');
        setMsg('MetaMask not found — install it then refresh.');
        return;
      }
      const [addr] = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setConnectedAddr(addr);
      setState('connected');
      if (setUser && user) setUser({ ...user, externalWallet: { chain: 'ethereum', address: addr, provider: 'metamask' } });
    } catch (e) {
      setState('error');
      setMsg(e.message || 'Connection refused.');
    }
  }, [user, setUser]);

  if (state === 'connected') {
    return (
      <div style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: 12, color: 'var(--color-positive)', fontWeight: 600, marginBottom: 4 }}>
          ✓ External wallet linked
        </div>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', wordBreak: 'break-all' }}>
          {connectedAddr}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '14px 16px' }}>
      <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 12 }}>
        Connect a browser extension wallet to access Sona with your own keys.
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          className="btn btn-secondary btn-sm"
          disabled={state === 'connecting'}
          onClick={connectPhantom}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <span style={{ fontSize: 15 }}>👻</span>
          {state === 'connecting' ? '…' : 'Phantom'}
        </button>
        <button
          className="btn btn-secondary btn-sm"
          disabled={state === 'connecting'}
          onClick={connectMetaMask}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <span style={{ fontSize: 15 }}>🦊</span>
          {state === 'connecting' ? '…' : 'MetaMask'}
        </button>
      </div>
      {msg && (
        <div style={{
          marginTop: 10, fontSize: 12,
          color: state === 'error' ? 'var(--color-negative)' : 'var(--color-text-tertiary)',
        }}>
          {msg}
        </div>
      )}
    </div>
  );
}
