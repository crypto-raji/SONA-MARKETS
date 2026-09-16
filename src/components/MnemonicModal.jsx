import React, { useState, useEffect } from 'react';
import { exportRecoveryPhrase, exportSolanaPrivateKey, verifyTransactionPin } from '../services/authService.js';

export default function MnemonicModal({ open, onClose, user }) {
  const [activeTab, setActiveTab] = useState('mnemonic'); // 'mnemonic' | 'privateKey'
  const [mnemonic, setMnemonic] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [revealedPhrase, setRevealedPhrase] = useState(false);
  const [revealedKey, setRevealedKey] = useState(false);
  const [copiedPhrase, setCopiedPhrase] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinRequired, setPinRequired] = useState(Boolean(user?.pinIsSet));
  const [pinVerified, setPinVerified] = useState(!user?.pinIsSet);

  useEffect(() => {
    if (open) {
      setActiveTab('mnemonic');
      setRevealedPhrase(false);
      setRevealedKey(false);
      setCopiedPhrase(false);
      setCopiedKey(false);
      setError('');
      setPinInput('');
      setPinRequired(Boolean(user?.pinIsSet));
      setPinVerified(!user?.pinIsSet);
      if (!user?.pinIsSet) {
        loadCredentials();
      }
    }
  }, [open, user]);

  const loadCredentials = async () => {
    setLoading(true);
    setError('');
    try {
      const [phrase, pk] = await Promise.all([
        exportRecoveryPhrase(),
        exportSolanaPrivateKey(),
      ]);
      if (!phrase && !pk) {
        setError('No wallet credentials found for this session.');
      } else {
        if (phrase) setMnemonic(phrase);
        if (pk) setPrivateKey(pk);
      }
    } catch (err) {
      setError('Failed to decrypt wallet keys: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPin = async (e) => {
    e.preventDefault();
    if (!pinInput || pinInput.length < 4) {
      setError('Please enter a valid PIN.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const isValid = await verifyTransactionPin(pinInput);
      if (isValid?.success || isValid === true) {
        setPinVerified(true);
        await loadCredentials();
      } else {
        setError('Incorrect PIN. Please try again.');
      }
    } catch (err) {
      setError('PIN verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPhrase = async () => {
    if (!mnemonic) return;
    try {
      await navigator.clipboard.writeText(mnemonic);
      setCopiedPhrase(true);
      setTimeout(() => setCopiedPhrase(false), 2000);
    } catch {}
  };

  const handleCopyPrivateKey = async () => {
    if (!privateKey) return;
    try {
      await navigator.clipboard.writeText(privateKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch {}
  };

  if (!open) return null;

  const words = mnemonic ? mnemonic.trim().split(/\s+/) : [];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(5, 7, 20, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: '100%', maxWidth: 440,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 20,
          boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px', borderBottom: '1px solid var(--color-border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'rgba(201,145,58,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16,
            }}>
              🔑
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text)' }}>
                Wallet Security & Export
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                Export your recovery credentials
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'var(--color-text-secondary)',
              fontSize: 20, cursor: 'pointer', padding: 4, lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        {(!pinRequired || pinVerified) && (
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-surface-2)',
          }}>
            <button
              type="button"
              onClick={() => setActiveTab('mnemonic')}
              style={{
                flex: 1, padding: '12px 14px', fontSize: 12, fontWeight: 600,
                border: 'none', cursor: 'pointer',
                background: activeTab === 'mnemonic' ? 'var(--color-surface)' : 'transparent',
                color: activeTab === 'mnemonic' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                borderBottom: activeTab === 'mnemonic' ? '2px solid var(--color-accent)' : '2px solid transparent',
                transition: 'all 0.15s ease',
              }}
            >
              12-Word Phrase
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('privateKey')}
              style={{
                flex: 1, padding: '12px 14px', fontSize: 12, fontWeight: 600,
                border: 'none', cursor: 'pointer',
                background: activeTab === 'privateKey' ? 'var(--color-surface)' : 'transparent',
                color: activeTab === 'privateKey' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                borderBottom: activeTab === 'privateKey' ? '2px solid var(--color-accent)' : '2px solid transparent',
                transition: 'all 0.15s ease',
              }}
            >
              Solana Private Key
            </button>
          </div>
        )}

        {/* Content Body */}
        <div style={{ padding: 20 }}>
          {pinRequired && !pinVerified ? (
            /* PIN Verification step */
            <form onSubmit={handleVerifyPin} style={{ textAlign: 'center', padding: '10px 0' }}>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
                Enter your Transaction PIN to unlock your secret credentials.
              </div>
              <input
                type="password"
                maxLength={6}
                autoFocus
                placeholder="Enter PIN"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                style={{
                  width: 160, padding: '10px 14px', textAlign: 'center',
                  fontSize: 20, letterSpacing: '0.25em',
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 12, color: 'var(--color-text)',
                  marginBottom: 16, outline: 'none',
                }}
              />
              {error && (
                <div style={{ fontSize: 12, color: 'var(--color-negative)', marginBottom: 12 }}>
                  {error}
                </div>
              )}
              <div>
                <button
                  type="submit"
                  disabled={loading || pinInput.length < 4}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '12px', fontSize: 13, fontWeight: 600 }}
                >
                  {loading ? 'Verifying…' : 'Unlock Credentials'}
                </button>
              </div>
            </form>
          ) : (
            <>
              {error ? (
                <div style={{
                  padding: 14, background: 'rgba(255,79,94,0.1)',
                  border: '1px solid rgba(255,79,94,0.25)',
                  borderRadius: 10, color: 'var(--color-negative)',
                  fontSize: 12, marginBottom: 16,
                }}>
                  {error}
                </div>
              ) : activeTab === 'mnemonic' ? (
                /* TAB 1: 12-Word Mnemonic Phrase */
                <>
                  {/* Warning banner */}
                  <div style={{
                    display: 'flex', gap: 10, padding: 12,
                    background: 'rgba(201,145,58,0.08)',
                    border: '1px solid rgba(201,145,58,0.25)',
                    borderRadius: 12, marginBottom: 16,
                  }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
                    <div style={{ fontSize: 11, color: '#C9913A', lineHeight: 1.5 }}>
                      <strong>Master Recovery Phrase.</strong> Back up these 12 words in a safe place.
                    </div>
                  </div>

                  {/* Words Grid */}
                  <div
                    style={{
                      position: 'relative',
                      background: 'var(--color-surface-2)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 14,
                      padding: 14,
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: 8,
                      marginBottom: 16,
                      minHeight: 140,
                    }}
                  >
                    {words.map((word, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 8,
                          padding: '6px 8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 12,
                          filter: revealedPhrase ? 'none' : 'blur(5px)',
                          userSelect: revealedPhrase ? 'text' : 'none',
                          transition: 'filter 0.2s ease',
                        }}
                      >
                        <span style={{
                          fontSize: 9, color: 'var(--color-text-tertiary)',
                          fontFamily: 'var(--font-mono)', minWidth: 14,
                        }}>
                          {idx + 1}.
                        </span>
                        <span style={{
                          fontWeight: 600, color: 'var(--color-text)',
                          fontFamily: 'var(--font-mono)',
                        }}>
                          {word}
                        </span>
                      </div>
                    ))}

                    {!revealedPhrase && (
                      <div
                        onClick={() => setRevealedPhrase(true)}
                        style={{
                          position: 'absolute', inset: 0,
                          display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', background: 'rgba(10,14,32,0.4)',
                          borderRadius: 14,
                        }}
                      >
                        <span style={{ fontSize: 24, marginBottom: 4 }}>👁️</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-accent)' }}>
                          Click to Reveal Phrase
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setRevealedPhrase(!revealedPhrase)}
                      className="btn btn-secondary"
                      style={{ flex: 1, padding: '10px 14px', fontSize: 12, fontWeight: 600 }}
                    >
                      {revealedPhrase ? '🙈 Hide Words' : '👁️ Reveal Words'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyPhrase}
                      disabled={!mnemonic}
                      className="btn btn-primary"
                      style={{
                        flex: 1, padding: '10px 14px', fontSize: 12, fontWeight: 600,
                        background: copiedPhrase ? 'var(--color-positive)' : undefined,
                        borderColor: copiedPhrase ? 'var(--color-positive)' : undefined,
                      }}
                    >
                      {copiedPhrase ? '✓ Copied All' : '📋 Copy All'}
                    </button>
                  </div>
                </>
              ) : (
                /* TAB 2: Solana Base58 Private Key */
                <>
                  <div style={{
                    display: 'flex', gap: 10, padding: 12,
                    background: 'rgba(99, 102, 241, 0.08)',
                    border: '1px solid rgba(99, 102, 241, 0.25)',
                    borderRadius: 12, marginBottom: 16,
                  }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>⚡</span>
                    <div style={{ fontSize: 11, color: '#818cf8', lineHeight: 1.5 }}>
                      <strong>Solflare & Phantom Import:</strong> Copy this Base58 Private Key and choose <em>"Import Private Key"</em> in Solflare or Phantom to access your exact address and funds.
                    </div>
                  </div>

                  {/* Private Key Box */}
                  <div
                    style={{
                      position: 'relative',
                      background: 'var(--color-surface-2)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 14,
                      padding: 14,
                      marginBottom: 16,
                      minHeight: 100,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        fontSize: 12,
                        lineHeight: 1.6,
                        fontFamily: 'var(--font-mono)',
                        wordBreak: 'break-all',
                        color: 'var(--color-text)',
                        filter: revealedKey ? 'none' : 'blur(6px)',
                        userSelect: revealedKey ? 'text' : 'none',
                        transition: 'filter 0.2s ease',
                      }}
                    >
                      {privateKey || 'No private key available'}
                    </div>

                    {!revealedKey && (
                      <div
                        onClick={() => setRevealedKey(true)}
                        style={{
                          position: 'absolute', inset: 0,
                          display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', background: 'rgba(10,14,32,0.4)',
                          borderRadius: 14,
                        }}
                      >
                        <span style={{ fontSize: 24, marginBottom: 4 }}>👁️</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-accent)' }}>
                          Click to Reveal Private Key
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setRevealedKey(!revealedKey)}
                      className="btn btn-secondary"
                      style={{ flex: 1, padding: '10px 14px', fontSize: 12, fontWeight: 600 }}
                    >
                      {revealedKey ? '🙈 Hide Key' : '👁️ Reveal Key'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyPrivateKey}
                      disabled={!privateKey}
                      className="btn btn-primary"
                      style={{
                        flex: 1, padding: '10px 14px', fontSize: 12, fontWeight: 600,
                        background: copiedKey ? 'var(--color-positive)' : undefined,
                        borderColor: copiedKey ? 'var(--color-positive)' : undefined,
                      }}
                    >
                      {copiedKey ? '✓ Copied Key' : '📋 Copy Private Key'}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
