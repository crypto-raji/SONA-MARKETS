import React, { useEffect, useState } from 'react';
import Header from '../components/Header.jsx';
import AssetLogo from '../components/AssetLogo.jsx';
import PinModal from '../components/PinModal.jsx';
import { Row, ProcessingBlock, ResultBlock } from '../components/BuyModal.jsx';
import { formatCurrency, formatQuantity } from '../utils/format.js';
import { isValidAmount } from '../utils/validators.js';
import { ALL_ASSETS, getAssetBySymbol } from '../constants/assets.js';
import { usePortfolio } from '../context/PortfolioContext.jsx';
import * as marketService from '../services/marketService.js';
import * as transactionService from '../services/transactionService.js';

const STEPS = { FORM: 'form', REVIEW: 'review', PIN: 'pin', PROCESSING: 'processing', RESULT: 'result' };
const SLIPPAGE_PERCENT = 0.1; // demo constant, shown for realism only

/**
 * General-purpose swap between any two listed assets (stock or token) —
 * distinct from Buy/Sell, which are specialized swaps fixed to USDC/SOL on
 * one side. Ask Sona AI can also propose a swap; approving that proposal
 * lands here with the two assets pre-selected for review.
 */
export default function Swap() {
  const { portfolio, refreshPortfolio } = usePortfolio();
  const [step, setStep] = useState(STEPS.FORM);
  const [fromSymbol, setFromSymbol] = useState('USDC');
  const [toSymbol, setToSymbol] = useState('AAPL');
  const [fromAmount, setFromAmount] = useState('');
  const [fromQuote, setFromQuote] = useState(null);
  const [toQuote, setToQuote] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    refreshPortfolio(true);
  }, [refreshPortfolio]);

  useEffect(() => {
    let active = true;
    marketService.getAssetPrice(fromSymbol).then((q) => active && setFromQuote(q));
    return () => { active = false; };
  }, [fromSymbol]);

  useEffect(() => {
    let active = true;
    marketService.getAssetPrice(toSymbol).then((q) => active && setToQuote(q));
    return () => { active = false; };
  }, [toSymbol]);

  const fromAsset = getAssetBySymbol(fromSymbol);
  const toAsset = getAssetBySymbol(toSymbol);
  const fromPrice = fromQuote?.price || 0;
  const toPrice = toQuote?.price || 0;
  const fromHolding = portfolio?.holdings?.find((h) => h.symbol === fromSymbol);
  const onChainToken = portfolio?.onChainTokens?.find((t) => t.symbol === fromSymbol);
  const onChainSol = fromSymbol === 'SOL' ? (portfolio?.availableBalance || 0) : 0;
  const available = Math.max(
    fromHolding?.quantity || 0,
    fromSymbol === 'SOL'
      ? Math.max(onChainSol, onChainToken?.amount || 0)
      : (onChainToken?.amount || 0)
  );

  const usdValue = (Number(fromAmount) || 0) * fromPrice;
  const fee = transactionService.estimateFee(usdValue);
  const estimatedToAmount = toPrice ? (usdValue - fee) / toPrice : 0;
  const rate = toPrice ? fromPrice / toPrice : 0;

  const reset = () => {
    setStep(STEPS.FORM);
    setFromAmount('');
    setError(null);
    setResult(null);
  };

  const handleFlip = () => {
    setFromSymbol(toSymbol);
    setToSymbol(fromSymbol);
    setFromAmount('');
  };

  const handleReview = () => {
    if (fromSymbol === toSymbol) return setError('Choose two different assets.');
    const err = isValidAmount(fromAmount, { max: available });
    if (err) return setError(err);
    setError(null);
    setStep(STEPS.REVIEW);
  };

  const handleConfirmed = async () => {
    setStep(STEPS.PROCESSING);
    try {
      const tx = await transactionService.swapAsset({
        fromSymbol,
        fromAmount: Number(fromAmount),
        fromPrice,
        toSymbol,
        toPrice,
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
    <div className="app-main">
      <Header title="Trade" />
      <div className="page-container" style={{ maxWidth: 480 }}>
        <p className="text-secondary" style={{ fontSize: 13, marginBottom: 'var(--space-4)' }}>
          Swap tokens, stocks, or assets with ease.
        </p>

        {step === STEPS.FORM && (
          <>
            <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 4 }}>
              <div className="text-secondary" style={{ fontSize: 12, marginBottom: 8 }}>You pay</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)' }}>
                <input
                  className="input-field"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                  style={{ fontSize: 24, border: 'none', padding: '4px 0', background: 'transparent', flex: 1 }}
                />
                <AssetSelect value={fromSymbol} onChange={setFromSymbol} exclude={toSymbol} />
              </div>
              <div className="text-tertiary" style={{ fontSize: 12, marginTop: 6 }}>
                Your balance ≈ {formatQuantity(available)} {fromSymbol}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', margin: '-2px 0' }}>
              <button
                className="btn-secondary"
                onClick={handleFlip}
                aria-label="Swap direction"
                style={{
                  width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  zIndex: 1, fontSize: 15,
                }}
              >
                ⇅
              </button>
            </div>

            <div className="card" style={{ padding: 'var(--space-4)', marginTop: 4, marginBottom: 'var(--space-4)' }}>
              <div className="text-secondary" style={{ fontSize: 12, marginBottom: 8 }}>You receive</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div style={{ fontSize: 24, flex: 1 }}>
                  {fromAmount ? formatQuantity(estimatedToAmount) : '0'}
                </div>
                <AssetSelect value={toSymbol} onChange={setToSymbol} exclude={fromSymbol} />
              </div>
              <div className="text-tertiary" style={{ fontSize: 12, marginTop: 6 }}>
                {rate ? `1 ${fromSymbol} ≈ ${formatQuantity(rate)} ${toSymbol}` : '--'}
                {fromAmount ? ` · ≈${formatCurrency(usdValue)}` : ''}
              </div>
            </div>

            {error && <p className="text-negative" style={{ fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</p>}
            <button className="btn btn-primary btn-block" onClick={handleReview}>Swap</button>
          </>
        )}

        {step === STEPS.REVIEW && (
          <div className="card" style={{ padding: 'var(--space-5)' }}>
            <h2 style={{ fontSize: 17, marginBottom: 'var(--space-1)' }}>Confirm swap</h2>
            <p className="text-secondary" style={{ fontSize: 13, marginBottom: 'var(--space-4)' }}>Review the details below before you confirm.</p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) 0', borderBottom: '1px solid var(--color-border)' }}>
              <AssetLogo symbol={fromAsset.symbol} color={fromAsset.color} monogram={fromAsset.monogram} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{fromAsset.name}</div>
                <div className="text-tertiary" style={{ fontSize: 12 }}>{fromAsset.symbol}</div>
              </div>
              <div style={{ fontWeight: 700 }}>{formatQuantity(Number(fromAmount))}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) 0', borderBottom: '1px solid var(--color-border)' }}>
              <AssetLogo symbol={toAsset.symbol} color={toAsset.color} monogram={toAsset.monogram} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{toAsset.name}</div>
                <div className="text-tertiary" style={{ fontSize: 12 }}>{toAsset.symbol}</div>
              </div>
              <div style={{ fontWeight: 700 }}>≈ {formatQuantity(estimatedToAmount)}</div>
            </div>

            <div style={{ marginTop: 'var(--space-2)' }}>
              <Row label="Fees" value={formatCurrency(fee)} />
              <Row label="Slippage" value={`${SLIPPAGE_PERCENT}%`} />
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
              <button className="btn btn-ghost" onClick={() => setStep(STEPS.FORM)}>Back</button>
              <button className="btn btn-primary btn-block" onClick={() => setStep(STEPS.PIN)}>Confirm swap</button>
            </div>
          </div>
        )}

        {step === STEPS.PROCESSING && (
          <div className="card" style={{ padding: 'var(--space-5)' }}>
            <ProcessingBlock label="Executing your swap..." />
          </div>
        )}

        {step === STEPS.RESULT && (
          <div className="card" style={{ padding: 'var(--space-5)' }}>
            <ResultBlock
              result={result}
              successLabel={`Swapped ${formatQuantity(Number(fromAmount))} ${fromSymbol} for ${formatQuantity(estimatedToAmount)} ${toSymbol}`}
              onDone={reset}
            />
          </div>
        )}
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

function AssetSelect({ value, onChange, exclude }) {
  const meta = getAssetBySymbol(value);
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div
        className="btn btn-secondary btn-sm"
        style={{ display: 'flex', alignItems: 'center', gap: 6, pointerEvents: 'none' }}
      >
        <AssetLogo symbol={meta?.symbol} color={meta?.color} monogram={meta?.monogram} size={18} />
        {value}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Select asset"
        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
      >
        {ALL_ASSETS.filter((a) => a.symbol !== exclude).map((a) => (
          <option key={a.symbol} value={a.symbol}>{a.name} ({a.symbol})</option>
        ))}
      </select>
    </div>
  );
}
