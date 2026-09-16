import React, { useEffect, useState } from 'react';
import PinModal from './PinModal.jsx';
import AssetLogo from './AssetLogo.jsx';
import { Row, ProcessingBlock, ResultBlock } from './BuyModal.jsx';
import { formatCurrency, formatQuantity } from '../utils/format.js';
import { isValidAmount } from '../utils/validators.js';
import * as transactionService from '../services/transactionService.js';
import * as marketService from '../services/marketService.js';
import { usePortfolio } from '../context/PortfolioContext.jsx';
import { FUNDING_ASSETS, getAssetBySymbol } from '../constants/assets.js';

const STEPS = { FORM: 'form', REVIEW: 'review', PIN: 'pin', PROCESSING: 'processing', RESULT: 'result' };

/**
 * Sona pays out every sell in USDC or SOL rather than raw fiat — proceeds
 * are converted at the chosen payout asset's own price. See FUNDING_ASSETS
 * in constants/assets.js.
 */
export default function SellModal({ asset, holding, open, onClose }) {
  const { refreshPortfolio } = usePortfolio();
  const [step, setStep] = useState(STEPS.FORM);
  const [receiveWithSymbol, setReceiveWithSymbol] = useState(FUNDING_ASSETS[0]);
  const [quantity, setQuantity] = useState('');
  const [receiveQuote, setReceiveQuote] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    marketService.getAssetPrice(receiveWithSymbol).then((q) => {
      if (active) setReceiveQuote(q);
    });
    return () => {
      active = false;
    };
  }, [receiveWithSymbol, open]);

  if (!open || !asset) return null;

  const price = asset.quote?.price || 0;
  const receivePrice = receiveQuote?.price || 0;
  const available = holding?.quantity || 0;
  const estimatedValue = (Number(quantity) || 0) * price;
  const fee = transactionService.estimateFee(estimatedValue);
  const estimatedReceiveAmount = receivePrice ? (estimatedValue - fee) / receivePrice : 0;

  const reset = () => {
    setStep(STEPS.FORM);
    setQuantity('');
    setError(null);
    setResult(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleReview = () => {
    const err = isValidAmount(quantity, { max: available });
    if (err) return setError(err);
    setError(null);
    setStep(STEPS.REVIEW);
  };

  const handleConfirmed = async () => {
    setStep(STEPS.PROCESSING);
    try {
      const tx = await transactionService.sellAsset({
        symbol: asset.symbol,
        quantity: Number(quantity),
        price,
        receiveWithSymbol,
        receivePrice,
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
          <h2 style={{ fontSize: 18, marginBottom: 'var(--space-4)' }}>Sell {asset.name}</h2>

          {step === STEPS.FORM && (
            <>
              <label className="text-secondary" style={{ fontSize: 13 }}>
                Quantity (available: {formatQuantity(available)} {asset.symbol})
              </label>
              <input
                className="input-field"
                type="number"
                min="0"
                placeholder="0.0000"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                style={{ margin: '6px 0 var(--space-3)', fontSize: 20 }}
              />

              <label className="text-secondary" style={{ fontSize: 13 }}>Receive in</label>
              <div style={{ display: 'flex', gap: 'var(--space-2)', margin: '6px 0 var(--space-3)' }}>
                {FUNDING_ASSETS.map((sym) => {
                  const meta = getAssetBySymbol(sym);
                  return (
                    <button
                      key={sym}
                      className={`btn btn-sm ${receiveWithSymbol === sym ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setReceiveWithSymbol(sym)}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    >
                      <AssetLogo symbol={sym} color={meta?.color} monogram={meta?.monogram} size={18} />
                      {sym}
                    </button>
                  );
                })}
              </div>

              <Row label={`${asset.symbol} price`} value={formatCurrency(price)} />
              <Row label="Estimated value" value={formatCurrency(estimatedValue)} />
              <Row label="Estimated fee" value={formatCurrency(fee)} />
              <Row label="You'll receive (est.)" value={quantity ? `${formatQuantity(estimatedReceiveAmount)} ${receiveWithSymbol}` : '--'} />
              {error && <p className="text-negative" style={{ fontSize: 13, margin: 'var(--space-2) 0' }}>{error}</p>}
              <button className="btn btn-primary btn-block" style={{ marginTop: 'var(--space-3)' }} onClick={handleReview}>
                Review order
              </button>
            </>
          )}

          {step === STEPS.REVIEW && (
            <>
              <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                <Row label="You sell" value={`${formatQuantity(Number(quantity))} ${asset.symbol}`} />
                <Row label="Price" value={formatCurrency(price)} />
                <Row label="Fee" value={formatCurrency(fee)} />
                <Row label="You receive (est.)" value={`${formatQuantity(estimatedReceiveAmount)} ${receiveWithSymbol}`} bold />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button className="btn btn-ghost" onClick={() => setStep(STEPS.FORM)}>Back</button>
                <button className="btn btn-primary btn-block" onClick={() => setStep(STEPS.PIN)}>Confirm sell</button>
              </div>
            </>
          )}

          {step === STEPS.PROCESSING && <ProcessingBlock label="Processing your order..." />}

          {step === STEPS.RESULT && (
            <ResultBlock
              result={result}
              successLabel={`Sold ${formatQuantity(Number(quantity))} ${asset.symbol} for ${formatQuantity(estimatedReceiveAmount)} ${receiveWithSymbol}`}
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
