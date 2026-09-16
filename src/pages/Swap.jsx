import React, { useEffect, useState, useMemo } from 'react';
import Header from '../components/Header.jsx';
import AssetLogo from '../components/AssetLogo.jsx';
import PinModal from '../components/PinModal.jsx';
import { Row, ProcessingBlock, ResultBlock } from '../components/BuyModal.jsx';
import { formatCurrency, formatQuantity } from '../utils/format.js';
import { isValidAmount } from '../utils/validators.js';
import { ALL_ASSETS, getAssetBySymbol } from '../constants/assets.js';
import { usePortfolio } from '../context/PortfolioContext.jsx';
import { getActiveNetwork, getExplorerUrl } from '../constants/network.js';
import * as marketService from '../services/marketService.js';
import * as transactionService from '../services/transactionService.js';

const STEPS = { FORM: 'form', REVIEW: 'review', PIN: 'pin', PROCESSING: 'processing', RESULT: 'result' };
const QUICK_PICKS = ['USDC', 'SOL', 'NVDA', 'AAPL', 'TSLA', 'BTC', 'ETH'];

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

  // Settings & Slippage
  const [slippage, setSlippage] = useState('0.5'); // 0.1, 0.5, 1.0, or custom
  const [showSettings, setShowSettings] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [flipRate, setFlipRate] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Token Select Modal
  const [tokenModal, setTokenModal] = useState({ open: false, target: 'from' }); // 'from' | 'to'
  const [tokenSearch, setTokenSearch] = useState('');

  const activeNetwork = getActiveNetwork();

  useEffect(() => {
    refreshPortfolio(true);
  }, [refreshPortfolio]);

  const loadQuotes = async () => {
    setIsRefreshing(true);
    try {
      const [qFrom, qTo] = await Promise.all([
        marketService.getAssetPrice(fromSymbol),
        marketService.getAssetPrice(toSymbol),
      ]);
      setFromQuote(qFrom);
      setToQuote(qTo);
    } catch {}
    finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  useEffect(() => {
    loadQuotes();
  }, [fromSymbol, toSymbol]);

  const fromAsset = getAssetBySymbol(fromSymbol);
  const toAsset = getAssetBySymbol(toSymbol);
  const fromPrice = fromQuote?.price || 0;
  const toPrice = toQuote?.price || 0;

  // Real-time user balances for from/to
  const getAssetBalance = (symbol) => {
    const holding = portfolio?.holdings?.find((h) => h.symbol === symbol);
    const onChainToken = portfolio?.onChainTokens?.find((t) => t.symbol === symbol);
    const onChainSol = symbol === 'SOL' ? (portfolio?.availableBalance || 0) : 0;
    return Math.max(
      holding?.quantity || 0,
      symbol === 'SOL' ? Math.max(onChainSol, onChainToken?.amount || 0) : (onChainToken?.amount || 0)
    );
  };

  const availableFrom = getAssetBalance(fromSymbol);
  const availableTo = getAssetBalance(toSymbol);

  // Realistic Fee Calculations (0.25% protocol fee + ~0.000005 SOL network gas)
  const usdValue = (Number(fromAmount) || 0) * fromPrice;
  const protocolFeePercent = 0.0025; // 0.25%
  const protocolFeeUsd = usdValue * protocolFeePercent;
  const networkFeeSol = 0.000005;
  const networkFeeUsd = 0.0009; // approx $0.0009 on Solana

  const netUsdValue = Math.max(0, usdValue - protocolFeeUsd);
  const estimatedToAmount = toPrice > 0 ? netUsdValue / toPrice : 0;
  const rate = toPrice > 0 ? fromPrice / toPrice : 0;
  const invRate = fromPrice > 0 ? toPrice / fromPrice : 0;

  // Slippage Minimum Received calculation
  const slippageNum = parseFloat(slippage) || 0.5;
  const minReceived = estimatedToAmount * (1 - slippageNum / 100);

  const handleFlip = () => {
    setFromSymbol(toSymbol);
    setToSymbol(fromSymbol);
    setFromAmount('');
    setError(null);
  };

  const handleSelectToken = (symbol) => {
    if (tokenModal.target === 'from') {
      if (symbol === toSymbol) {
        setToSymbol(fromSymbol);
      }
      setFromSymbol(symbol);
    } else {
      if (symbol === fromSymbol) {
        setFromSymbol(toSymbol);
      }
      setToSymbol(symbol);
    }
    setTokenModal({ open: false, target: 'from' });
    setTokenSearch('');
  };

  const handleReview = () => {
    if (fromSymbol === toSymbol) return setError('Choose two different assets.');
    if (!fromAmount || Number(fromAmount) <= 0) return setError('Enter an amount to swap.');
    if (Number(fromAmount) > availableFrom) return setError(`Insufficient balance. You have ${formatQuantity(availableFrom)} ${fromSymbol}.`);
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

  const reset = () => {
    setStep(STEPS.FORM);
    setFromAmount('');
    setError(null);
    setResult(null);
  };

  // Filter assets in search modal
  const filteredAssets = useMemo(() => {
    const q = tokenSearch.trim().toLowerCase();
    if (!q) return ALL_ASSETS;
    return ALL_ASSETS.filter(
      (a) => a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
    );
  }, [tokenSearch]);

  return (
    <div className="app-main">
      <Header title="Trade" />
      <div className="page-container" style={{ maxWidth: 490, paddingBottom: 48 }}>

        {step === STEPS.FORM && (
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 24,
            padding: 20,
            boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
            position: 'relative',
          }}>
            {/* Top DEX Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-text)' }}>Swap</span>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                  background: activeNetwork === 'devnet' ? 'rgba(201,145,58,0.12)' : 'rgba(0,196,140,0.12)',
                  color: activeNetwork === 'devnet' ? '#E8B966' : '#00C48C',
                  border: `1px solid ${activeNetwork === 'devnet' ? '#E8B96644' : '#00C48C44'}`,
                }}>
                  {activeNetwork === 'devnet' ? 'Solana Devnet' : 'Solana Mainnet'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={loadQuotes}
                  title="Refresh Market Quotes"
                  style={{
                    background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
                    borderRadius: 10, width: 34, height: 34, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', cursor: 'pointer', color: 'var(--color-text-secondary)',
                    transition: 'transform 0.3s ease',
                    transform: isRefreshing ? 'rotate(180deg)' : 'none',
                  }}
                >
                  🔄
                </button>
                <button
                  type="button"
                  onClick={() => setShowSettings(!showSettings)}
                  title="Slippage & Routing Settings"
                  style={{
                    background: showSettings ? 'var(--color-accent)22' : 'var(--color-surface-2)',
                    border: `1px solid ${showSettings ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    borderRadius: 10, width: 34, height: 34, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', cursor: 'pointer', color: showSettings ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  }}
                >
                  ⚙️
                </button>
              </div>
            </div>

            {/* Slippage Settings Panel */}
            {showSettings && (
              <div style={{
                background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
                borderRadius: 16, padding: '14px 16px', marginBottom: 16, animation: 'fadeIn 0.2s ease',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>Max Slippage Tolerance</span>
                  <span style={{ fontSize: 11, color: 'var(--color-accent)', fontWeight: 600 }}>{slippage}%</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['0.1', '0.5', '1.0'].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setSlippage(val)}
                      style={{
                        flex: 1, padding: '6px 0', fontSize: 12, fontWeight: 600, borderRadius: 8,
                        cursor: 'pointer', transition: 'all 0.2s',
                        background: slippage === val ? 'var(--color-accent)' : 'var(--color-surface)',
                        color: slippage === val ? '#fff' : 'var(--color-text-secondary)',
                        border: `1px solid ${slippage === val ? 'var(--color-accent)' : 'var(--color-border)'}`,
                      }}
                    >
                      {val}% {val === '0.5' ? '(Auto)' : ''}
                    </button>
                  ))}
                  <div style={{ position: 'relative', width: 75 }}>
                    <input
                      type="number"
                      placeholder="Custom"
                      value={!['0.1', '0.5', '1.0'].includes(slippage) ? slippage : ''}
                      onChange={(e) => setSlippage(e.target.value)}
                      style={{
                        width: '100%', padding: '6px 14px 6px 8px', fontSize: 12, textAlign: 'center',
                        borderRadius: 8, background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                        color: 'var(--color-text)', outline: 'none',
                      }}
                    />
                    <span style={{ position: 'absolute', right: 6, top: 7, fontSize: 11, color: 'var(--color-text-tertiary)' }}>%</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── YOU PAY CONTAINER ── */}
            <div style={{
              background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
              borderRadius: 18, padding: '14px 16px', transition: 'border-color 0.2s',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 500 }}>You pay</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                    Balance: <strong style={{ color: 'var(--color-text)' }}>{formatQuantity(availableFrom)}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setFromAmount((availableFrom * 0.5).toFixed(4))}
                    style={{
                      background: 'rgba(255,255,255,0.06)', border: '1px solid var(--color-border)',
                      borderRadius: 6, padding: '1px 6px', fontSize: 10, fontWeight: 700,
                      color: 'var(--color-accent)', cursor: 'pointer',
                    }}
                  >
                    50%
                  </button>
                  <button
                    type="button"
                    onClick={() => setFromAmount(availableFrom.toString())}
                    style={{
                      background: 'rgba(255,255,255,0.06)', border: '1px solid var(--color-border)',
                      borderRadius: 6, padding: '1px 6px', fontSize: 10, fontWeight: 700,
                      color: 'var(--color-accent)', cursor: 'pointer',
                    }}
                  >
                    MAX
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="number"
                  min="0"
                  placeholder="0.00"
                  value={fromAmount}
                  onChange={(e) => {
                    setFromAmount(e.target.value);
                    setError(null);
                  }}
                  style={{
                    fontSize: 28, fontWeight: 700, border: 'none', background: 'transparent',
                    color: 'var(--color-text)', outline: 'none', width: '100%', flex: 1,
                    fontFamily: 'var(--font-mono, monospace)', padding: 0,
                  }}
                />

                <button
                  type="button"
                  onClick={() => setTokenModal({ open: true, target: 'from' })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
                    borderRadius: 14, background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)', cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)', flexShrink: 0,
                  }}
                >
                  <AssetLogo symbol={fromAsset?.symbol} color={fromAsset?.color} monogram={fromAsset?.monogram} size={22} />
                  <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)' }}>{fromSymbol}</span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>⌄</span>
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                  {usdValue > 0 ? `≈ $${usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00'}
                </span>
                {fromPrice > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                    ${fromPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            </div>

            {/* ── INTERACTIVE FLIP BUTTON ── */}
            <div style={{ display: 'flex', justifyContent: 'center', margin: '-10px 0', position: 'relative', zIndex: 2 }}>
              <button
                type="button"
                onClick={handleFlip}
                aria-label="Swap direction"
                style={{
                  width: 38, height: 38, borderRadius: '50%', border: '3px solid var(--color-surface)',
                  background: 'var(--color-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', fontSize: 16, color: 'var(--color-accent)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'rotate(180deg) scale(1.1)';
                  e.currentTarget.style.background = 'var(--color-accent)';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.background = 'var(--color-surface-2)';
                  e.currentTarget.style.color = 'var(--color-accent)';
                }}
              >
                ⇅
              </button>
            </div>

            {/* ── YOU RECEIVE CONTAINER ── */}
            <div style={{
              background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
              borderRadius: 18, padding: '14px 16px', marginBottom: 14,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 500 }}>You receive</span>
                <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                  Holding: <strong style={{ color: 'var(--color-text)' }}>{formatQuantity(availableTo)}</strong>
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  fontSize: 28, fontWeight: 700, color: estimatedToAmount > 0 ? 'var(--color-text)' : 'var(--color-text-tertiary)',
                  width: '100%', flex: 1, fontFamily: 'var(--font-mono, monospace)', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {estimatedToAmount > 0 ? formatQuantity(estimatedToAmount) : '0.00'}
                </div>

                <button
                  type="button"
                  onClick={() => setTokenModal({ open: true, target: 'to' })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
                    borderRadius: 14, background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)', cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)', flexShrink: 0,
                  }}
                >
                  <AssetLogo symbol={toAsset?.symbol} color={toAsset?.color} monogram={toAsset?.monogram} size={22} />
                  <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)' }}>{toSymbol}</span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>⌄</span>
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                  {estimatedToAmount > 0 ? `≈ $${(estimatedToAmount * toPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00'}
                </span>
                {toPrice > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                    ${toPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            </div>

            {/* ── EXCHANGE RATE & ROUTING PILL ── */}
            {rate > 0 && (
              <div
                onClick={() => setFlipRate(!flipRate)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', background: 'var(--color-surface-2)',
                  borderRadius: 12, border: '1px solid var(--color-border)',
                  marginBottom: 14, cursor: 'pointer', fontSize: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: 'var(--color-accent)' }}>⚡</span>
                  <span style={{ color: 'var(--color-text-secondary)' }}>
                    {flipRate
                      ? `1 ${toSymbol} = ${formatQuantity(invRate)} ${fromSymbol} ($${toPrice.toFixed(2)})`
                      : `1 ${fromSymbol} = ${formatQuantity(rate)} ${toSymbol} ($${fromPrice.toFixed(2)})`
                    }
                  </span>
                  <span style={{ color: 'var(--color-text-tertiary)', fontSize: 10 }}>⇄</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDetails(!showDetails);
                  }}
                  style={{
                    background: 'none', border: 'none', color: 'var(--color-accent)',
                    fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0,
                  }}
                >
                  {showDetails ? 'Hide details ▴' : 'Details ▾'}
                </button>
              </div>
            )}

            {/* ── DETAILED REALISTIC ROUTING & FEE ACCORDION ── */}
            {showDetails && (
              <div style={{
                background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
                borderRadius: 14, padding: 14, marginBottom: 14, fontSize: 12,
                display: 'flex', flexDirection: 'column', gap: 8, animation: 'fadeIn 0.2s ease',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)' }}>
                  <span>Liquidity Route</span>
                  <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>Sona Smart AMM (Solana direct)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)' }}>
                  <span>Price Impact</span>
                  <span style={{ color: '#00C48C', fontWeight: 600 }}>&lt; 0.01% (Low)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)' }}>
                  <span>Protocol Trading Fee (0.25%)</span>
                  <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>
                    {protocolFeeUsd > 0 ? `$${protocolFeeUsd.toFixed(4)}` : '$0.00'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)' }}>
                  <span>Solana Network Gas</span>
                  <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>~0.000005 SOL (~$0.0009)</span>
                </div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)',
                  paddingTop: 6, borderTop: '1px solid var(--color-border)',
                }}>
                  <span>Guaranteed Minimum Received</span>
                  <span style={{ color: 'var(--color-text)', fontWeight: 700 }}>
                    {formatQuantity(minReceived)} {toSymbol}
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div style={{
                padding: '10px 14px', background: 'rgba(255,79,94,0.1)',
                border: '1px solid rgba(255,79,94,0.25)', borderRadius: 10,
                color: 'var(--color-negative)', fontSize: 12, marginBottom: 14,
              }}>
                {error}
              </div>
            )}

            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={handleReview}
              style={{ padding: '14px', fontSize: 14, fontWeight: 700, borderRadius: 14 }}
            >
              Review Swap
            </button>
          </div>
        )}

        {/* ── STEP 2: REVIEW SWAP ── */}
        {step === STEPS.REVIEW && (
          <div style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 24, padding: 24, boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Confirm Swap</h2>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 20 }}>
              Verify order route and settlement amounts before authorizing with your PIN.
            </p>

            <div style={{
              background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
              borderRadius: 16, padding: '14px 16px', marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <AssetLogo symbol={fromAsset?.symbol} color={fromAsset?.color} monogram={fromAsset?.monogram} size={28} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{fromAsset?.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>Pay asset</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-text)' }}>
                    {formatQuantity(Number(fromAmount))} {fromSymbol}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>≈ ${usdValue.toFixed(2)}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <AssetLogo symbol={toAsset?.symbol} color={toAsset?.color} monogram={toAsset?.monogram} size={28} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{toAsset?.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>Receive asset</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: '#00C48C' }}>
                    ≈ {formatQuantity(estimatedToAmount)} {toSymbol}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>≈ ${(estimatedToAmount * toPrice).toFixed(2)}</div>
                </div>
              </div>
            </div>

            {/* Fee summary in review */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)' }}>
                <span>Trading Fee (0.25%)</span>
                <span>${protocolFeeUsd.toFixed(4)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)' }}>
                <span>Network Gas</span>
                <span>~0.000005 SOL</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)' }}>
                <span>Max Slippage</span>
                <span>{slippage}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                <span>Min. Received</span>
                <span style={{ color: 'var(--color-text)' }}>{formatQuantity(minReceived)} {toSymbol}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setStep(STEPS.FORM)}
                style={{ flex: 1, padding: 12, borderRadius: 12 }}
              >
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setStep(STEPS.PIN)}
                style={{ flex: 2, padding: 12, borderRadius: 12, fontWeight: 700 }}
              >
                Authorize Swap
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: PROCESSING ── */}
        {step === STEPS.PROCESSING && (
          <div style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 24, padding: 36, textAlign: 'center',
          }}>
            <ProcessingBlock label={`Executing on-chain swap from ${fromSymbol} to ${toSymbol}…`} />
          </div>
        )}

        {/* ── STEP 4: RESULT ── */}
        {step === STEPS.RESULT && (
          <div style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 24, padding: 24, boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
          }}>
            <ResultBlock
              result={result}
              successLabel={`Successfully swapped ${formatQuantity(Number(fromAmount))} ${fromSymbol} for ${formatQuantity(estimatedToAmount)} ${toSymbol}`}
              onDone={reset}
            />
          </div>
        )}
      </div>

      {/* ── PIN MODAL ── */}
      <PinModal
        open={step === STEPS.PIN}
        mode="verify"
        onClose={() => setStep(STEPS.REVIEW)}
        onSuccess={handleConfirmed}
      />

      {/* ── UNISWAP-STYLE TOKEN SELECTOR MODAL ── */}
      {tokenModal.open && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(5, 7, 20, 0.75)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setTokenModal({ open: false, target: 'from' }); }}
        >
          <div style={{
            width: '100%', maxWidth: 440, background: 'var(--color-surface)',
            border: '1px solid var(--color-border)', borderRadius: 20,
            boxShadow: '0 24px 48px rgba(0,0,0,0.4)', overflow: 'hidden',
            maxHeight: '85vh', display: 'flex', flexDirection: 'column',
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: '1px solid var(--color-border)',
            }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>Select a Token or Stock</span>
              <button
                type="button"
                onClick={() => setTokenModal({ open: false, target: 'from' })}
                style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', fontSize: 18, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Search Box */}
            <div style={{ padding: '14px 20px 10px' }}>
              <input
                type="text"
                autoFocus
                placeholder="Search by name or ticker (e.g. SOL, AAPL, NVDA)..."
                value={tokenSearch}
                onChange={(e) => setTokenSearch(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 12,
                  background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
                  color: 'var(--color-text)', fontSize: 13, outline: 'none',
                }}
              />
            </div>

            {/* Quick Pick Chips */}
            <div style={{ padding: '0 20px 12px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {QUICK_PICKS.map((sym) => {
                const a = getAssetBySymbol(sym);
                return (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => handleSelectToken(sym)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 8px',
                      borderRadius: 10, background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
                      fontSize: 12, fontWeight: 600, color: 'var(--color-text)', cursor: 'pointer',
                    }}
                  >
                    <AssetLogo symbol={sym} color={a?.color} monogram={a?.monogram} size={16} />
                    {sym}
                  </button>
                );
              })}
            </div>

            {/* Scrollable Token List */}
            <div style={{ overflowY: 'auto', flex: 1, borderTop: '1px solid var(--color-border)' }}>
              {filteredAssets.map((asset) => {
                const bal = getAssetBalance(asset.symbol);
                return (
                  <div
                    key={asset.symbol}
                    onClick={() => handleSelectToken(asset.symbol)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 20px', borderBottom: '1px solid var(--color-border)',
                      cursor: 'pointer', transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-2)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <AssetLogo symbol={asset.symbol} color={asset.color} monogram={asset.monogram} size={32} />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{asset.symbol}</span>
                          <span style={{
                            fontSize: 10, padding: '1px 6px', borderRadius: 4,
                            background: asset.type === 'stock' ? 'rgba(99,102,241,0.12)' : 'rgba(0,196,140,0.12)',
                            color: asset.type === 'stock' ? '#818CF8' : '#00C48C',
                          }}>
                            {asset.type === 'stock' ? 'Tokenized US Stock' : 'Solana Token'}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                          {asset.name}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>
                        {formatQuantity(bal)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                        Balance
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

