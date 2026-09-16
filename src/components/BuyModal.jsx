import React, { useEffect, useState } from 'react';
import PinModal from './PinModal.jsx';
import AssetLogo from './AssetLogo.jsx';
import { formatCurrency, formatQuantity } from '../utils/format.js';
import { isValidAmount } from '../utils/validators.js';
import * as transactionService from '../services/transactionService.js';
import * as marketService from '../services/marketService.js';
import { usePortfolio } from '../context/PortfolioContext.jsx';
import { FUNDING_ASSETS, getAssetBySymbol } from '../constants/assets.js';

const STEPS = { FORM: 'form', REVIEW: 'review', PIN: 'pin', PROCESSING: 'processing', RESULT: 'result' };

/**
 * Sona funds every buy with USDC or SOL rather than raw fiat — "amount" here
 * is a quantity of the chosen pay asset, converted at that asset's own
 * price. See FUNDING_ASSETS in constants/assets.js.
 */
export default function BuyModal({ asset, open, onClose }) {
  const { portfolio, refreshPortfolio } = usePortfolio();
  const [step, setStep] = useState(STEPS.FORM);
  const [payWithSymbol, setPayWithSymbol] = useState(FUNDING_ASSETS[0]);
  const [amount, setAmount] = useState('');
  const [payQuote, setPayQuote] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    marketService.getAssetPrice(payWithSymbol).then((q) => {
      if (active) setPayQuote(q);
    });
    return () => {
      active = false;
    };
  }, [payWithSymbol, open]);

  if (!open || !asset) return null;

  const payAsset = getAssetBySymbol(payWithSymbol);
  const price = asset.quote?.price || 0;
  const payPrice = payQuote?.price || 0;
  const payHolding = portfolio?.holdings?.find((h) => h.symbol === payWithSymbol);
  const onChainToken = portfolio?.onChainTokens?.find((t) => t.symbol === payWithSymbol);
  const onChainSol = payWithSymbol === 'SOL' ? (portfolio?.availableBalance || 0) : 0;
  const availablePay = Math.max(
    payHolding?.quantity || 0,
    payWithSymbol === 'SOL'
      ? Math.max(onChainSol, onChainToken?.amount || 0)
      : (onChainToken?.amount || 0)
  );

  const usdValue = (Number(amount) || 0) * payPrice;
  const fee = transactionService.estimateFee(usdValue);
  const estimatedQty = price ? (usdValue - fee) / price : 0;

  const reset = () => {
    setStep(STEPS.FORM);
    setAmount('');
    setError(null);
    setResult(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleReview = () => {
    const err = isValidAmount(amount, { max: availablePay });
    if (err) return setError(err);
    setError(null);
    setStep(STEPS.REVIEW);
  };

  const handleConfirmed = async () => {
    setStep(STEPS.PROCESSING);
    try {
      const tx = await transactionService.buyAsset({
        symbol: asset.symbol,
        price,
        payWithSymbol,
        payAmount: Number(amount),
        payPrice,
      });
      setResult({ success: true, tx });
      await refreshPortfolio();
    } catch (e) {
      setResult({ success: false, error: e.message });
    } finally {
      setStep(STEPS.RESULT);
    }
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: 'var(--space-5)' }}>
          <h2 style={{ fontSize: 18, marginBottom: 'var(--space-4)' }}>Buy {asset.name}</h2>

          {step === STEPS.FORM && (
            <>
              <label className="text-secondary" style={{ fontSize: 13 }}>Pay with</label>
              <div style={{ display: 'flex', gap: 'var(--space-2)', margin: '6px 0 var(--space-3)' }}>
                {FUNDING_ASSETS.map((sym) => {
                  const meta = getAssetBySymbol(sym);
                  return (
                    <button
                      key={sym}
                      className={`btn btn-sm ${payWithSymbol === sym ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setPayWithSymbol(sym)}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    >
                      <AssetLogo symbol={sym} color={meta?.color} monogram={meta?.monogram} size={18} />
                      {sym}
                    </button>
                  );
                })}
              </div>

              <label className="text-secondary" style={{ fontSize: 13 }}>
                Amount ({payWithSymbol}) — available: {formatQuantity(availablePay)}
              </label>
              <input
                className="input-field"
                type="number"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{ margin: '6px 0 var(--space-3)', fontSize: 20 }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span className="text-secondary">{asset.symbol} price</span>
                <span>{formatCurrency(price)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span className="text-secondary">Estimated quantity</span>
                <span>{amount ? `${formatQuantity(estimatedQty)} ${asset.symbol}` : '--'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 'var(--space-4)' }}>
                <span className="text-secondary">Estimated fee</span>
                <span>{formatCurrency(fee)}</span>
              </div>
              {error && <p className="text-negative" style={{ fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</p>}
              <button className="btn btn-primary btn-block" onClick={handleReview}>Review order</button>
            </>
          )}

          {step === STEPS.REVIEW && (
            <>
              <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                <Row label="You pay" value={`${formatQuantity(Number(amount))} ${payWithSymbol}`} />
                <Row label="You receive (est.)" value={`${formatQuantity(estimatedQty)} ${asset.symbol}`} />
                <Row label={`${asset.symbol} price`} value={formatCurrency(price)} />
                <Row label="Fee" value={formatCurrency(fee)} />
                <Row label="Estimated total value" value={formatCurrency(usdValue)} bold />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button className="btn btn-ghost" onClick={() => setStep(STEPS.FORM)}>Back</button>
                <button className="btn btn-primary btn-block" onClick={() => setStep(STEPS.PIN)}>Confirm buy</button>
              </div>
            </>
          )}

          {step === STEPS.PROCESSING && <ProcessingBlock label="Processing your order..." />}

          {step === STEPS.RESULT && (
            <ResultBlock
              result={result}
              successLabel={`Bought ${formatQuantity(estimatedQty)} ${asset.symbol} with ${formatQuantity(Number(amount))} ${payWithSymbol}`}
              onDone={handleClose}
            />
          )}
        </div>
      </div>

      <PinModal
        open={step === STEPS.PIN}
        mode="verify"
        onClose={() => setStep(STEPS.REVIEW)}
        onSuccess={handleConfirmed}
      />
    </div>
  );
}

export function Row({ label, value, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontWeight: bold ? 700 : 400 }}>
      <span className="text-secondary" style={{ fontWeight: 400 }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

const SPIN_CSS = `
  @keyframes sonaSpinOuter { to { transform: rotate(360deg); } }
  @keyframes sonaSpinInner { to { transform: rotate(-360deg); } }
`;

export function ProcessingBlock() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6) 0' }}>
      <style>{SPIN_CSS}</style>
      <div style={{ position: 'relative', width: 80, height: 80 }}>
        <svg viewBox="0 0 80 80" width="80" height="80" style={{ position: 'absolute', inset: 0, animation: 'sonaSpinOuter 1.1s linear infinite' }}>
          <circle cx="40" cy="40" r="34" fill="none" stroke="var(--color-accent)" strokeWidth="4" strokeLinecap="round" strokeDasharray="60 154" />
        </svg>
        <svg viewBox="0 0 80 80" width="80" height="80" style={{ position: 'absolute', inset: 0, animation: 'sonaSpinInner 0.8s linear infinite' }}>
          <circle cx="40" cy="40" r="22" fill="none" stroke="var(--color-accent)" strokeWidth="3" strokeOpacity="0.35" strokeLinecap="round" strokeDasharray="30 108" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-accent)', opacity: 0.8 }} />
        </div>
      </div>
    </div>
  );
}

export function ResultBlock({ result, successLabel, onDone }) {
  const txHash = result?.tx?.txHash || result?.txHash;
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!txHash) return;
    navigator.clipboard.writeText(txHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>
      <div style={{
        width: 52, height: 52, borderRadius: 'var(--radius-pill)',
        background: result?.success ? 'var(--color-positive-soft)' : 'var(--color-negative-soft)',
        color: result?.success ? 'var(--color-positive)' : 'var(--color-negative)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 26, margin: '0 auto var(--space-3)',
      }}>
        {result?.success ? '✓' : '✕'}
      </div>
      <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>
        {result?.success ? 'Order Executed Successfully' : 'Order Failed'}
      </h3>
      <p className="text-secondary" style={{ fontSize: 13, marginBottom: txHash ? 'var(--space-3)' : 'var(--space-5)' }}>
        {result?.success ? successLabel : result?.error || 'Something went wrong. Please try again.'}
      </p>

      {txHash && (
        <div className="card" style={{
          padding: 'var(--space-3)', textAlign: 'left', marginBottom: 'var(--space-4)',
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span className="text-tertiary" style={{ fontSize: 11, fontWeight: 600 }}>TRANSACTION SIGNATURE</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-positive)' }}>CONFIRMED ON-CHAIN</span>
          </div>
          <div style={{
            fontSize: 11, fontFamily: 'var(--font-mono)', wordBreak: 'break-all',
            background: 'var(--color-bg)', padding: '6px 8px', borderRadius: 6, marginBottom: 8,
          }}>
            {txHash}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleCopy}
              style={{ flex: 1, fontSize: 11 }}
            >
              {copied ? '✓ Copied!' : '📋 Copy Hash'}
            </button>
            <a
              href={`https://solscan.io/tx/${txHash}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
              style={{ flex: 1, fontSize: 11, textDecoration: 'none', textAlign: 'center' }}
            >
              Solscan ↗
            </a>
            <a
              href={`https://explorer.solana.com/tx/${txHash}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
              style={{ flex: 1, fontSize: 11, textDecoration: 'none', textAlign: 'center' }}
            >
              Explorer ↗
            </a>
          </div>
        </div>
      )}

      <button className="btn btn-primary btn-block" onClick={onDone}>Done</button>
    </div>
  );
}
