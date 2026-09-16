import React, { useState } from 'react';
import PinModal from './PinModal.jsx';
import AssetLogo from './AssetLogo.jsx';
import { Row, ProcessingBlock, ResultBlock } from './BuyModal.jsx';
import { formatCurrency, formatQuantity } from '../utils/format.js';
import { isValidAmount, isValidAddress } from '../utils/validators.js';
import { ALL_ASSETS, SUPPORTED_NETWORKS, getAssetBySymbol } from '../constants/assets.js';
import * as transactionService from '../services/transactionService.js';
import { usePortfolio } from '../context/PortfolioContext.jsx';

const STEPS = { FORM: 'form', REVIEW: 'review', PIN: 'pin', PROCESSING: 'processing', RESULT: 'result' };

/**
 * Shared Send flow. Renders as a modal overlay by default (`asModal`), or as
 * an inline panel for use directly on the dedicated Send page.
 */
export default function SendModal({ open = true, onClose, defaultSymbol, asModal = true }) {
  const { portfolio, refreshPortfolio } = usePortfolio();
  const [step, setStep] = useState(STEPS.FORM);
  const [symbol, setSymbol] = useState(defaultSymbol || 'USDC');
  const [network, setNetwork] = useState('Solana');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  if (!open) return null;

  const asset = getAssetBySymbol(symbol);
  const holding = portfolio?.holdings?.find((h) => h.symbol === symbol);
  const available = holding?.quantity || 0;
  const networkFee = network === 'Solana' ? 0.000005 : 0.0015;

  const reset = () => {
    setStep(STEPS.FORM);
    setRecipient('');
    setAmount('');
    setError(null);
    setResult(null);
  };

  const handleClose = () => {
    reset();
    onClose?.();
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
      const tx = await transactionService.sendAsset({ symbol, amount: Number(amount), recipient, network });
      setResult({ success: true, tx });
      await refreshPortfolio();
    } catch (e) {
      setResult({ success: false, error: e.message });
    } finally {
      setStep(STEPS.RESULT);
    }
  };

  const content = (
    <div style={{ padding: asModal ? 'var(--space-5)' : 0 }}>
      {asModal && <h2 style={{ fontSize: 18, marginBottom: 'var(--space-4)' }}>Send assets</h2>}

      {step === STEPS.FORM && (
        <>
          <label className="text-secondary" style={{ fontSize: 13 }}>Asset</label>
          <select className="input-field" value={symbol} onChange={(e) => setSymbol(e.target.value)} style={{ margin: '6px 0 var(--space-3)' }}>
            {ALL_ASSETS.map((a) => (
              <option key={a.symbol} value={a.symbol}>{a.name} ({a.symbol})</option>
            ))}
          </select>

          <label className="text-secondary" style={{ fontSize: 13 }}>Network</label>
          <select className="input-field" value={network} onChange={(e) => setNetwork(e.target.value)} style={{ margin: '6px 0 var(--space-3)' }}>
            {SUPPORTED_NETWORKS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>

          <label className="text-secondary" style={{ fontSize: 13 }}>Recipient address</label>
          <input
            className="input-field"
            placeholder={`${network} address`}
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            style={{ margin: '6px 0 var(--space-3)' }}
          />

          <label className="text-secondary" style={{ fontSize: 13 }}>Amount</label>
          <input
            className="input-field"
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ margin: '6px 0 var(--space-3)' }}
          />

          <Row label="Available balance" value={`${formatQuantity(available)} ${symbol}`} />
          <Row label="Network fee" value={network === 'Solana' ? `${networkFee} SOL` : formatCurrency(networkFee)} />
          <Row label="Estimated total" value={amount ? `${amount} ${symbol}` : '--'} />

          {error && <p className="text-negative" style={{ fontSize: 13, margin: 'var(--space-2) 0' }}>{error}</p>}
          <button className="btn btn-primary btn-block" style={{ marginTop: 'var(--space-3)' }} onClick={handleReview}>
            Review transaction
          </button>
        </>
      )}

      {step === STEPS.REVIEW && (
        <>
          <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <AssetLogo symbol={asset.symbol} color={asset.color} monogram={asset.monogram} />
            <div>
              <div style={{ fontWeight: 600 }}>{amount} {symbol}</div>
              <div className="text-tertiary" style={{ fontSize: 12 }}>on {network}</div>
            </div>
          </div>
          <Row label="To" value={recipient} />
          <Row label="Network fee" value={network === 'Solana' ? `${networkFee} SOL` : formatCurrency(networkFee)} />
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
            <button className="btn btn-ghost" onClick={() => setStep(STEPS.FORM)}>Back</button>
            <button className="btn btn-primary btn-block" onClick={() => setStep(STEPS.PIN)}>Confirm send</button>
          </div>
        </>
      )}

      {step === STEPS.PROCESSING && <ProcessingBlock label="Broadcasting transaction..." />}

      {step === STEPS.RESULT && (
        <ResultBlock result={result} successLabel={`Sent ${amount} ${symbol} to ${recipient.slice(0, 10)}...`} onDone={handleClose} />
      )}

      <PinModal
        open={step === STEPS.PIN}
        mode="verify"
        onClose={() => setStep(STEPS.REVIEW)}
        onSuccess={handleConfirmed}
      />
    </div>
  );

  if (!asModal) return content;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>{content}</div>
    </div>
  );
}
