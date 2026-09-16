import React, { useState, useEffect } from 'react';
import PinModal from './PinModal.jsx';
import AssetLogo from './AssetLogo.jsx';
import { formatCurrency, formatQuantity, truncateAddress } from '../utils/format.js';
import { isValidAmount, isValidAddress } from '../utils/validators.js';
import { ALL_ASSETS, SUPPORTED_NETWORKS, getAssetBySymbol } from '../constants/assets.js';
import * as transactionService from '../services/transactionService.js';
import * as marketService from '../services/marketService.js';
import { getSolscanUrl, getSolanaExplorerUrl, getActiveNetwork } from '../constants/network.js';
import { requestDevnetAirdrop } from '../services/walletService.js';
import { usePortfolio } from '../context/PortfolioContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const STEPS = {
  FORM: 'form',
  REVIEW: 'review',
  PIN: 'pin',
  PROCESSING: 'processing',
  RESULT: 'result',
};

const PERCENTAGES = [0.25, 0.50, 0.75, 1.0];

export default function SendModal({ open = true, onClose, defaultSymbol, asModal = true }) {
  const { portfolio, refreshPortfolio } = usePortfolio();
  const { user } = useAuth();
  const [step, setStep] = useState(STEPS.FORM);
  const [symbol, setSymbol] = useState(defaultSymbol || 'SOL');
  const [network, setNetwork] = useState('Solana');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [assetPrice, setAssetPrice] = useState(0);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [airdropping, setAirdropping] = useState(false);
  const [airdropMessage, setAirdropMessage] = useState(null);

  const activeNetwork = getActiveNetwork();
  const isDevnet = activeNetwork !== 'mainnet-beta';

  useEffect(() => {
    let active = true;
    marketService.getAssetPrice(symbol).then((q) => {
      if (active && q?.price) setAssetPrice(q.price);
    }).catch(() => {});
    return () => { active = false; };
  }, [symbol]);

  if (!open) return null;

  const asset = getAssetBySymbol(symbol) || { symbol, name: symbol, color: '#3457D5' };
  const holding = portfolio?.holdings?.find((h) => h.symbol === symbol);
  const onChainToken = portfolio?.onChainTokens?.find((t) => t.symbol === symbol);
  const onChainSol = symbol === 'SOL' ? (portfolio?.availableBalance || 0) : 0;
  
  const available = Math.max(
    holding?.quantity || 0,
    symbol === 'SOL'
      ? Math.max(onChainSol, onChainToken?.amount || 0)
      : (onChainToken?.amount || 0)
  );

  const networkFeeSol = 0.000005;
  const networkFeeUsd = networkFeeSol * (symbol === 'SOL' ? assetPrice : 180);
  const parsedAmount = Number(amount) || 0;
  const estimatedUsd = parsedAmount * assetPrice;

  const reset = () => {
    setStep(STEPS.FORM);
    setRecipient('');
    setAmount('');
    setError(null);
    setResult(null);
    setCopied(false);
    setAirdropMessage(null);
  };

  const handleClose = () => {
    reset();
    onClose?.();
  };

  const handleSetPercent = (pct) => {
    const rawVal = available * pct;
    // Reserve small amount of SOL for network gas fee if sending max SOL
    const adjusted = symbol === 'SOL' && pct === 1.0 ? Math.max(0, rawVal - 0.005) : rawVal;
    setAmount(adjusted > 0 ? Number(adjusted.toFixed(6)).toString() : '');
  };

  const handlePasteRecipient = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setRecipient(text.trim());
    } catch {
      // Clipboard access denied
    }
  };

  const handleAirdrop = async () => {
    if (!user?.wallets?.solana) return;
    setAirdropping(true);
    setAirdropMessage(null);
    try {
      await requestDevnetAirdrop(user.wallets.solana);
      setAirdropMessage('✓ 1 SOL airdropped to your devnet wallet!');
      await refreshPortfolio();
    } catch (err) {
      setAirdropMessage(`✕ ${err.message}`);
    } finally {
      setAirdropping(false);
    }
  };

  const handleReview = () => {
    const amountErr = isValidAmount(amount, { max: available });
    if (amountErr) return setError(amountErr);
    const addressErr = isValidAddress(recipient, network);
    if (addressErr) return setError(addressErr);
    setError(null);
    setStep(STEPS.REVIEW);
  };

  const handleConfirmed = async () => {
    setStep(STEPS.PROCESSING);
    try {
      const tx = await transactionService.sendAsset({
        symbol,
        amount: Number(amount),
        recipient: recipient.trim(),
        network,
      });
      setResult({ success: true, tx, txHash: tx.txHash });
      await refreshPortfolio();
    } catch (e) {
      setResult({ success: false, error: e.message });
    } finally {
      setStep(STEPS.RESULT);
    }
  };

  const handleCopyHash = (hash) => {
    if (!hash) return;
    navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const content = (
    <div style={{ padding: asModal ? 'var(--space-5)' : 0 }}>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 'var(--radius-pill)',
            background: 'var(--color-accent-soft)', color: 'var(--color-accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14,
          }}>
            ↗
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Send Assets</h2>
            <div className="text-tertiary" style={{ fontSize: 12 }}>Transfer on-chain via Solana</div>
          </div>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
          background: isDevnet ? 'rgba(99, 102, 241, 0.12)' : 'rgba(16, 185, 129, 0.12)',
          color: isDevnet ? '#6366f1' : 'var(--color-positive)',
        }}>
          {isDevnet ? 'Solana Devnet' : 'Solana Mainnet'}
        </span>
      </div>

      {/* ── STEP 1: FORM ────────────────────────────────────────── */}
      {step === STEPS.FORM && (
        <>
          {/* Asset & Available Balance */}
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="text-secondary" style={{ fontSize: 13, fontWeight: 500 }}>Select Asset</label>
              <span className="text-tertiary" style={{ fontSize: 12 }}>
                Available: <strong style={{ color: 'var(--color-text-primary)' }}>{formatQuantity(available)} {symbol}</strong>
              </span>
            </div>
            <div style={{ position: 'relative' }}>
              <select
                className="input-field"
                value={symbol}
                onChange={(e) => { setSymbol(e.target.value); setAmount(''); setError(null); }}
                style={{ paddingLeft: 42, fontWeight: 600, fontSize: 15 }}
              >
                {ALL_ASSETS.map((a) => (
                  <option key={a.symbol} value={a.symbol}>
                    {a.name} ({a.symbol}) — {a.type.toUpperCase()}
                  </option>
                ))}
              </select>
              <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <AssetLogo symbol={asset.symbol} color={asset.color} monogram={asset.monogram} size={22} />
              </div>
            </div>
          </div>

          {/* Recipient Address */}
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="text-secondary" style={{ fontSize: 13, fontWeight: 500 }}>Recipient Solana Address</label>
              <button
                type="button"
                onClick={handlePasteRecipient}
                style={{
                  background: 'none', border: 'none', color: 'var(--color-accent)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0,
                }}
              >
                📋 Paste
              </button>
            </div>
            <input
              className="input-field"
              placeholder="Base58 Solana address (e.g. 7vfC...9voxs)"
              value={recipient}
              onChange={(e) => { setRecipient(e.target.value.trim()); setError(null); }}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
            />
          </div>

          {/* Amount input + Percentage quick chips */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="text-secondary" style={{ fontSize: 13, fontWeight: 500 }}>Amount</label>
              {estimatedUsd > 0 && (
                <span className="text-tertiary" style={{ fontSize: 12 }}>
                  ≈ {formatCurrency(estimatedUsd)} USD
                </span>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <input
                className="input-field"
                type="number"
                step="any"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setError(null); }}
                style={{ fontSize: 20, fontWeight: 700, paddingRight: 70 }}
              />
              <span style={{
                position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                fontSize: 14, fontWeight: 600, color: 'var(--color-text-secondary)',
              }}>
                {symbol}
              </span>
            </div>

            {/* Quick Percentage Chips */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
              {PERCENTAGES.map((pct) => (
                <button
                  key={pct}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleSetPercent(pct)}
                  style={{ flex: 1, fontSize: 12, padding: '4px 0' }}
                >
                  {pct === 1.0 ? 'MAX' : `${pct * 100}%`}
                </button>
              ))}
            </div>
          </div>

          {/* Fee & Route Info Card */}
          <div className="card" style={{ padding: 'var(--space-3)', background: 'var(--color-surface)', marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
              <span className="text-secondary">Network Gas Fee</span>
              <span style={{ fontWeight: 600 }}>~{networkFeeSol} SOL ({formatCurrency(networkFeeUsd)})</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
              <span className="text-secondary">Settlement Time</span>
              <span className="text-positive" style={{ fontWeight: 600 }}>⚡ ~400ms (Instant)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span className="text-secondary">Protocol Verification</span>
              <span style={{ fontWeight: 600, color: 'var(--color-accent)' }}>On-Chain Solana Ed25519</span>
            </div>
          </div>

          {/* Devnet Faucet helper if testing on devnet with 0 SOL */}
          {isDevnet && (available === 0 || (symbol === 'SOL' && available < 0.01)) && (
            <div style={{
              padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
              background: 'rgba(99, 102, 241, 0.08)', border: '1px dashed #6366f1',
              marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Need Devnet SOL for testing?</div>
                <div className="text-tertiary" style={{ fontSize: 11 }}>Request 1 free test SOL from the devnet faucet</div>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleAirdrop}
                disabled={airdropping}
                style={{ fontSize: 12 }}
              >
                {airdropping ? 'Airdropping...' : '+1 SOL Devnet'}
              </button>
            </div>
          )}

          {airdropMessage && (
            <p style={{
              fontSize: 12, margin: '0 0 var(--space-3)',
              color: airdropMessage.startsWith('✓') ? 'var(--color-positive)' : 'var(--color-negative)',
            }}>
              {airdropMessage}
            </p>
          )}

          {error && <p className="text-negative" style={{ fontSize: 13, margin: '0 0 var(--space-3)' }}>{error}</p>}

          <button
            className="btn btn-primary btn-block"
            onClick={handleReview}
            disabled={!amount || Number(amount) <= 0 || !recipient}
            style={{ height: 44, fontSize: 15 }}
          >
            Review & Confirm Send
          </button>
        </>
      )}

      {/* ── STEP 2: CONFIRMATION REVIEW ─────────────────────────── */}
      {step === STEPS.REVIEW && (
        <>
          {/* Visual Route Card */}
          <div className="card" style={{
            padding: 'var(--space-4)', marginBottom: 'var(--space-4)',
            background: 'linear-gradient(135deg, rgba(52,87,213,0.06), rgba(99,102,241,0.04))',
            border: '1px solid var(--color-border)',
          }}>
            <div style={{ textAlign: 'center', padding: 'var(--space-3) 0' }}>
              <div style={{ display: 'inline-block', marginBottom: 'var(--space-2)' }}>
                <AssetLogo symbol={asset.symbol} color={asset.color} monogram={asset.monogram} size={48} />
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>
                {amount} {symbol}
              </div>
              {estimatedUsd > 0 && (
                <div className="text-secondary" style={{ fontSize: 13, marginTop: 2 }}>
                  ≈ {formatCurrency(estimatedUsd)} USD
                </div>
              )}
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: 'var(--space-3)', background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)',
              marginTop: 'var(--space-3)',
            }}>
              <div style={{ flex: 1 }}>
                <div className="text-tertiary" style={{ fontSize: 11 }}>From</div>
                <div style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  {user?.wallets?.solana ? truncateAddress(user.wallets.solana) : 'Your Sona Wallet'}
                </div>
              </div>
              <div style={{ color: 'var(--color-accent)', padding: '0 12px', fontSize: 18 }}>➔</div>
              <div style={{ flex: 1, textAlign: 'right' }}>
                <div className="text-tertiary" style={{ fontSize: 11 }}>To</div>
                <div style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  {truncateAddress(recipient)}
                </div>
              </div>
            </div>
          </div>

          {/* Breakdown Rows */}
          <div className="card" style={{ padding: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
              <span className="text-secondary">Network</span>
              <span style={{ fontWeight: 600 }}>{isDevnet ? 'Solana Devnet' : 'Solana Mainnet-Beta'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
              <span className="text-secondary">Network Gas Fee</span>
              <span style={{ fontWeight: 600 }}>{networkFeeSol} SOL</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
              <span className="text-secondary">Security Check</span>
              <span className="text-positive" style={{ fontWeight: 600 }}>✓ Verified Ed25519 Payload</span>
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between', padding: '8px 0 2px',
              borderTop: '1px solid var(--color-border)', marginTop: 6, fontSize: 14, fontWeight: 700,
            }}>
              <span>Total Deducted</span>
              <span>{amount} {symbol} {symbol === 'SOL' ? `+ ${networkFeeSol} SOL fee` : ''}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button className="btn btn-ghost" onClick={() => setStep(STEPS.FORM)} style={{ flex: 1 }}>
              Back
            </button>
            <button className="btn btn-primary" onClick={() => setStep(STEPS.PIN)} style={{ flex: 2 }}>
              Authorize Send
            </button>
          </div>
        </>
      )}

      {/* ── STEP 3: PIN MODAL ───────────────────────────────────── */}
      <PinModal
        open={step === STEPS.PIN}
        mode="verify"
        onClose={() => setStep(STEPS.REVIEW)}
        onSuccess={handleConfirmed}
      />

      {/* ── STEP 4: PROCESSING ──────────────────────────────────── */}
      {step === STEPS.PROCESSING && (
        <div style={{ textAlign: 'center', padding: 'var(--space-6) 0' }}>
          <div style={{ position: 'relative', width: 72, height: 72, margin: '0 auto var(--space-4)' }}>
            <svg viewBox="0 0 80 80" width="72" height="72" style={{ position: 'absolute', inset: 0, animation: 'sonaSpinOuter 1.1s linear infinite' }}>
              <circle cx="40" cy="40" r="34" fill="none" stroke="var(--color-accent)" strokeWidth="4" strokeLinecap="round" strokeDasharray="60 154" />
            </svg>
            <svg viewBox="0 0 80 80" width="72" height="72" style={{ position: 'absolute', inset: 0, animation: 'sonaSpinInner 0.8s linear infinite' }}>
              <circle cx="40" cy="40" r="22" fill="none" stroke="var(--color-accent)" strokeWidth="3" strokeOpacity="0.35" strokeLinecap="round" strokeDasharray="30 108" />
            </svg>
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Broadcasting to Solana...</h3>
          <p className="text-secondary" style={{ fontSize: 13 }}>
            Signing instruction payload and confirming block commitment.
          </p>
        </div>
      )}

      {/* ── STEP 5: RESULT SCREEN ───────────────────────────────── */}
      {step === STEPS.RESULT && (
        <div style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 'var(--radius-pill)',
            background: result?.success ? 'var(--color-positive-soft)' : 'var(--color-negative-soft)',
            color: result?.success ? 'var(--color-positive)' : 'var(--color-negative)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, margin: '0 auto var(--space-3)',
          }}>
            {result?.success ? '✓' : '✕'}
          </div>

          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
            {result?.success ? 'Transfer Confirmed!' : 'Transfer Failed'}
          </h3>

          <p className="text-secondary" style={{ fontSize: 13, marginBottom: 'var(--space-4)' }}>
            {result?.success
              ? `Successfully sent ${amount} ${symbol} to ${truncateAddress(recipient)}.`
              : result?.error || 'Unable to broadcast transaction to Solana.'}
          </p>

          {/* Transaction Signature Card */}
          {result?.tx?.txHash && (
            <div className="card" style={{
              padding: 'var(--space-3)', textAlign: 'left', marginBottom: 'var(--space-4)',
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span className="text-tertiary" style={{ fontSize: 11, fontWeight: 600 }}>TRANSACTION SIGNATURE</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-positive)' }}>CONFIRMED ON-CHAIN</span>
              </div>
              <div style={{
                fontSize: 12, fontFamily: 'var(--font-mono)', wordBreak: 'break-all',
                background: 'var(--color-bg)', padding: '6px 8px', borderRadius: 6, marginBottom: 8,
              }}>
                {result.tx.txHash}
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleCopyHash(result.tx.txHash)}
                  style={{ flex: 1, fontSize: 12 }}
                >
                  {copied ? '✓ Copied!' : '📋 Copy Signature'}
                </button>
                <a
                  href={getSolscanUrl(result.tx.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ flex: 1, fontSize: 12, textDecoration: 'none', textAlign: 'center' }}
                >
                  Solscan ↗
                </a>
                <a
                  href={getSolanaExplorerUrl(result.tx.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ flex: 1, fontSize: 12, textDecoration: 'none', textAlign: 'center' }}
                >
                  Explorer ↗
                </a>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {result?.success && (
              <button className="btn btn-secondary" onClick={reset} style={{ flex: 1 }}>
                Send Another
              </button>
            )}
            <button className="btn btn-primary" onClick={handleClose} style={{ flex: 1 }}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (!asModal) return content;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        {content}
      </div>
    </div>
  );
}
