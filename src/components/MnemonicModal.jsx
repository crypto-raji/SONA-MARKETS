import React, { useState, useEffect } from 'react';
import { exportRecoveryPhrase, verifyTransactionPin } from '../services/authService.js';

export default function MnemonicModal({ open, onClose, user }) {
  const [mnemonic, setMnemonic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinRequired, setPinRequired] = useState(Boolean(user?.pinIsSet));
  const [pinVerified, setPinVerified] = useState(!user?.pinIsSet);

  useEffect(() => {
    if (open) {
      setRevealed(false);
      setCopied(false);
      setError('');
      setPinInput('');
      setPinRequired(Boolean(user?.pinIsSet));
      setPinVerified(!user?.pinIsSet);
      if (!user?.pinIsSet) {
        loadPhrase();
      }
    }
  }, [open, user]);

  const loadPhrase = async () => {
    setLoading(true);
    setError('');
    try {
      const phrase = await exportRecoveryPhrase();
      if (!phrase) {
        setError('No recovery phrase found for this session.');
      } else {
        setMnemonic(phrase);
      }
    } catch (err) {
      setError('Failed to decrypt recovery phrase: ' + err.message);
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
        await loadPhrase();
      } else {
        setError('Incorrect PIN. Please try again.');
      }
    } catch (err) {
      setError('PIN verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!mnemonic) return;
    try {
      await navigator.clipboard.writeText(mnemonic);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
                Secret Recovery Phrase
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                BIP-39 12-word master key
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

        {/* Content Body */}
        <div style={{ padding: 20 }}>
          {pinRequired && !pinVerified ? (
            /* PIN Verification step */
            <form onSubmit={handleVerifyPin} style={{ textAlign: 'center', padding: '10px 0' }}>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
                Enter your Transaction PIN to unlock your secret recovery phrase.
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
                  {loading ? 'Verifying…' : 'Unlock Recovery Phrase'}
                </button>
              </div>
            </form>
          ) : (
            /* Recovery Phrase Display */
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
              ) : (
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
                      <strong>Keep this secret.</strong> Anyone with these 12 words can access and control all your funds across Solana, Ethereum, BNB, and Bitcoin.
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
                          filter: revealed ? 'none' : 'blur(5px)',
                          userSelect: revealed ? 'text' : 'none',
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

                    {!revealed && (
                      <div
                        onClick={() => setRevealed(true)}
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
                      onClick={() => setRevealed(!revealed)}
                      className="btn btn-secondary"
                      style={{ flex: 1, padding: '10px 14px', fontSize: 12, fontWeight: 600 }}
                    >
                      {revealed ? '🙈 Hide Words' : '👁️ Reveal Words'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCopy}
                      disabled={!mnemonic}
                      className="btn btn-primary"
                      style={{
                        flex: 1, padding: '10px 14px', fontSize: 12, fontWeight: 600,
                        background: copied ? 'var(--color-positive)' : undefined,
                        borderColor: copied ? 'var(--color-positive)' : undefined,
                      }}
                    >
                      {copied ? '✓ Copied All' : '📋 Copy All'}
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
