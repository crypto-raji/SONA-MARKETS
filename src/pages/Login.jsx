import React, { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { WalletConnectModal } from '../components/WalletConnectModal.jsx';

const TICKERS_A = [
  { symbol: 'AAPL', price: '211.42', change: '+1.24%', up: true },
  { symbol: 'BTC',  price: '67,340', change: '+3.41%', up: true },
  { symbol: 'NVDA', price: '875.60', change: '+5.12%', up: true },
  { symbol: 'SOL',  price: '182.33', change: '+7.89%', up: true },
  { symbol: 'MSFT', price: '415.22', change: '+0.94%', up: true },
  { symbol: 'META', price: '523.10', change: '+4.33%', up: true },
];
const TICKERS_B = [
  { symbol: 'ETH',  price: '3,421',  change: '-0.87%', up: false },
  { symbol: 'TSLA', price: '247.80', change: '-1.23%', up: false },
  { symbol: 'BNB',  price: '601.55', change: '+2.15%', up: true  },
  { symbol: 'AMZN', price: '191.90', change: '+1.67%', up: true  },
  { symbol: 'GOOGL',price: '178.40', change: '+0.56%', up: true  },
  { symbol: 'COIN', price: '238.75', change: '+8.02%', up: true  },
];

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Outfit:wght@300;400;500;600&display=swap');

  .lp-root {
    min-height: 100vh;
    display: flex;
    background: #07091A;
    font-family: 'Outfit', system-ui, sans-serif;
    overflow: hidden;
  }

  /* ── Brand panel ── */
  .lp-brand {
    flex: 0 0 55%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 48px 52px;
    position: relative;
    overflow: hidden;
    background:
      radial-gradient(ellipse 60% 50% at 20% 30%, rgba(201,145,58,0.10) 0%, transparent 70%),
      radial-gradient(ellipse 40% 40% at 80% 80%, rgba(0,196,140,0.06) 0%, transparent 60%),
      #07091A;
  }

  /* Dot-grid texture */
  .lp-brand::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px);
    background-size: 28px 28px;
    pointer-events: none;
  }

  .lp-logo-mark {
    display: flex;
    align-items: center;
    gap: 10px;
    position: relative;
  }

  .lp-wordmark {
    font-family: 'Outfit', sans-serif;
    font-weight: 600;
    font-size: 18px;
    letter-spacing: 0.08em;
    color: #E8EDF8;
    text-transform: uppercase;
  }

  .lp-headline {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: clamp(42px, 5vw, 72px);
    font-weight: 600;
    line-height: 1.08;
    color: #E8EDF8;
    text-wrap: balance;
    position: relative;
    margin: 0;
  }

  .lp-headline em {
    font-style: italic;
    color: #C9913A;
  }

  .lp-subline {
    font-family: 'Outfit', sans-serif;
    font-size: 15px;
    font-weight: 300;
    color: #4A5A7A;
    margin-top: 16px;
    letter-spacing: 0.01em;
    line-height: 1.6;
  }

  /* ── Ticker strips ── */
  .lp-tickers {
    display: flex;
    flex-direction: column;
    gap: 10px;
    position: relative;
    overflow: hidden;
    mask-image: linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%);
    -webkit-mask-image: linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%);
  }

  .lp-ticker-row {
    display: flex;
    gap: 0;
    white-space: nowrap;
  }

  .lp-ticker-row--fwd { animation: ticker-fwd 28s linear infinite; }
  .lp-ticker-row--rev { animation: ticker-rev 24s linear infinite; }

  @keyframes ticker-fwd {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }
  @keyframes ticker-rev {
    from { transform: translateX(-50%); }
    to   { transform: translateX(0); }
  }

  .lp-ticker-item {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 7px 20px 7px 0;
    font-size: 13px;
  }

  .lp-ticker-symbol {
    font-weight: 600;
    color: #8A9FBF;
    letter-spacing: 0.05em;
    font-size: 12px;
  }

  .lp-ticker-price {
    font-variant-numeric: tabular-nums;
    color: #C8D3E8;
    font-size: 13px;
  }

  .lp-ticker-change {
    font-size: 11px;
    font-weight: 500;
    padding: 2px 7px;
    border-radius: 4px;
  }
  .lp-ticker-change--up   { color: #00C48C; background: rgba(0,196,140,0.12); }
  .lp-ticker-change--down { color: #FF4F5E; background: rgba(255,79,94,0.12); }

  .lp-ticker-sep {
    color: #1A2540;
    margin-right: 20px;
    font-size: 16px;
    line-height: 1;
  }

  /* ── Stats bar ── */
  .lp-stats {
    display: flex;
    gap: 32px;
    position: relative;
  }

  .lp-stat-label {
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #2D3D5A;
    margin-bottom: 4px;
  }

  .lp-stat-value {
    font-size: 15px;
    font-weight: 600;
    color: #5A6A8A;
  }

  /* ── Form panel ── */
  .lp-form-panel {
    flex: 0 0 45%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48px 40px;
    background: #0A0E20;
    border-left: 1px solid rgba(255,255,255,0.04);
    position: relative;
  }

  .lp-form-inner {
    width: 100%;
    max-width: 360px;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .lp-form-eyebrow {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #C9913A;
    margin-bottom: 12px;
  }

  .lp-form-title {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: 38px;
    font-weight: 600;
    color: #E8EDF8;
    line-height: 1.1;
    margin: 0 0 6px;
    text-wrap: balance;
  }

  .lp-form-desc {
    font-size: 14px;
    color: #3D4F6E;
    margin: 0 0 36px;
    line-height: 1.55;
    font-weight: 300;
  }

  .lp-error {
    font-size: 13px;
    color: #FF4F5E;
    background: rgba(255,79,94,0.08);
    border: 1px solid rgba(255,79,94,0.2);
    border-radius: 8px;
    padding: 10px 14px;
    margin-bottom: 16px;
    line-height: 1.4;
  }

  .lp-google-btn {
    width: 100%;
    height: 50px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.10);
    background: rgba(255,255,255,0.04);
    color: #C8D3E8;
    font-family: 'Outfit', sans-serif;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    transition: background 0.18s, border-color 0.18s, transform 0.12s;
    letter-spacing: 0.01em;
  }
  .lp-google-btn:hover:not(:disabled) {
    background: rgba(255,255,255,0.08);
    border-color: rgba(255,255,255,0.18);
    transform: translateY(-1px);
  }
  .lp-google-btn:active:not(:disabled) { transform: translateY(0); }
  .lp-google-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .lp-divider {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 28px 0;
  }
  .lp-divider::before,
  .lp-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: rgba(255,255,255,0.05);
  }
  .lp-divider span {
    font-size: 11px;
    color: #2D3D5A;
    white-space: nowrap;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .lp-features {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .lp-feature {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  .lp-feature-icon {
    width: 28px;
    height: 28px;
    border-radius: 7px;
    background: rgba(201,145,58,0.10);
    border: 1px solid rgba(201,145,58,0.18);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .lp-feature-text strong {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: #8A9FBF;
    margin-bottom: 1px;
  }
  .lp-feature-text span {
    font-size: 12px;
    color: #2D3D5A;
    line-height: 1.4;
  }

  .lp-legal {
    font-size: 11px;
    color: #2D3D5A;
    text-align: center;
    margin-top: 28px;
    line-height: 1.55;
  }


  /* ── Responsive ── */
  @media (max-width: 768px) {
    .lp-root { flex-direction: column; }
    .lp-brand {
      flex: none;
      padding: 32px 24px 28px;
    }
    .lp-headline { font-size: 36px; }
    .lp-stats { gap: 20px; }
    .lp-form-panel {
      flex: none;
      padding: 36px 24px 48px;
      border-left: none;
      border-top: 1px solid rgba(255,255,255,0.04);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .lp-ticker-row--fwd,
    .lp-ticker-row--rev { animation: none; }
  }
`;

function TickerRow({ items, direction }) {
  const doubled = [...items, ...items];
  return (
    <div className={`lp-ticker-row lp-ticker-row--${direction}`}>
      {doubled.map((t, i) => (
        <span key={i} className="lp-ticker-item">
          <span className="lp-ticker-symbol">{t.symbol}</span>
          <span className="lp-ticker-price">{t.price}</span>
          <span className={`lp-ticker-change lp-ticker-change--${t.up ? 'up' : 'down'}`}>
            {t.change}
          </span>
          <span className="lp-ticker-sep" aria-hidden="true">·</span>
        </span>
      ))}
    </div>
  );
}

export default function Login() {
  const { signInWithGoogle, signInWithWallet } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  async function handleGoogle() {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e.message || 'Sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const handleWalletConnect = useCallback(async (result) => {
    await signInWithWallet(result);
  }, [signInWithWallet]);

  return (
    <>
      <style>{CSS}</style>
      <div className="lp-root">

        {/* ── Brand panel ── */}
        <div className="lp-brand">
          <div className="lp-logo-mark">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <circle cx="14" cy="14" r="5"  fill="#C9913A"/>
              <circle cx="14" cy="14" r="9"  fill="none" stroke="#C9913A" strokeWidth="1.2" opacity="0.45"/>
              <circle cx="14" cy="14" r="13" fill="none" stroke="#C9913A" strokeWidth="0.7" opacity="0.2"/>
            </svg>
            <span className="lp-wordmark">Sona</span>
          </div>

          <div>
            <h1 className="lp-headline">
              Every market,<br />
              <em>one account.</em>
            </h1>
            <p className="lp-subline">
              Stocks, crypto, AI-powered insights<br />and your wallets on four blockchains.
            </p>
          </div>

          <div className="lp-tickers">
            <TickerRow items={TICKERS_A} direction="fwd" />
            <TickerRow items={TICKERS_B} direction="rev" />
          </div>

          <div className="lp-stats">
            {[
              ['Markets', '14+'],
              ['Blockchains', '4'],
              ['Data latency', '<1s'],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="lp-stat-label">{label}</div>
                <div className="lp-stat-value">{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Form panel ── */}
        <div className="lp-form-panel">
          <div className="lp-form-inner">
            <div className="lp-form-eyebrow">Get started</div>
            <h2 className="lp-form-title">Welcome<br />to Sona</h2>
            <p className="lp-form-desc">
              Sign in to access your portfolio, trade assets, and track markets in real time.
            </p>

            {error && <div className="lp-error" role="alert">{error}</div>}

            <button
              className="lp-google-btn"
              onClick={handleGoogle}
              disabled={loading}
            >
              {loading ? (
                <span>Signing in…</span>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                    <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                    <path d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
                    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </>
              )}
            </button>

            {/* ── Wallet connect ── */}
            <div className="lp-divider" style={{ margin: '20px 0 16px' }}>
              <span>or connect a wallet</span>
            </div>

            <WalletConnectModal onConnect={handleWalletConnect} disabled={loading} />

            <div className="lp-divider" style={{ margin: '24px 0 16px' }}><span>What you get</span></div>

            <div className="lp-features">
              {[
                {
                  icon: (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <polyline points="1,10 4,6 7,8 10,3 13,5" stroke="#C9913A" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ),
                  title: 'Live market data',
                  desc: 'Real-time prices for stocks and crypto via Finnhub & CoinGecko.',
                },
                {
                  icon: (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <rect x="3" y="6" width="8" height="7" rx="1.5" stroke="#C9913A" strokeWidth="1.3"/>
                      <path d="M5 6V4.5a2 2 0 014 0V6" stroke="#C9913A" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                  ),
                  title: 'PIN-protected transactions',
                  desc: 'Every trade requires your personal PIN. Your keys stay on your device.',
                },
                {
                  icon: (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <circle cx="7" cy="7" r="2.5" stroke="#C9913A" strokeWidth="1.3"/>
                      <circle cx="7" cy="7" r="5.5" stroke="#C9913A" strokeWidth="0.8" opacity="0.4"/>
                    </svg>
                  ),
                  title: 'Sona AI assistant',
                  desc: 'Ask anything about markets. Get portfolio analysis and trade ideas.',
                },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="lp-feature">
                  <div className="lp-feature-icon">{icon}</div>
                  <div className="lp-feature-text">
                    <strong>{title}</strong>
                    <span>{desc}</span>
                  </div>
                </div>
              ))}
            </div>

            <p className="lp-legal">
              By signing in you agree to Sona's Terms of Service<br />and Privacy Policy.
            </p>
          </div>
        </div>

      </div>
    </>
  );
}
