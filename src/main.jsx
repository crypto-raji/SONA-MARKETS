// Polyfill Buffer for browser — required by bip39, @solana/web3.js and HD wallet libs
import { Buffer } from 'buffer';
globalThis.Buffer = Buffer;

import React, { Component } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { PortfolioProvider } from './context/PortfolioContext.jsx';
import { BalanceVisibilityProvider } from './context/BalanceVisibilityContext.jsx';
import { NavDrawerProvider } from './context/NavDrawerContext.jsx';
import './styles/globals.css';
// Imported after globals.css so its media-query overrides win the cascade
// on equal-specificity selectors (e.g. .app-main, .page-container) — see
// responsive.css's header comment for why import order matters here.
import './styles/responsive.css';
import { prefetchMarket } from './services/marketService.js';

// Kick off market data fetch immediately so it's cached by the time the home page renders
try {
  prefetchMarket();
} catch (e) {
  console.warn('[Market] Prefetch skipped:', e);
}

class RootErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('[Sona Global Error]:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          background: '#07091A',
          color: '#E2E8F0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: 'center'
        }}>
          <div style={{
            maxWidth: 480,
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 16,
            padding: '32px 24px',
            backdropFilter: 'blur(10px)'
          }}>
            <h2 style={{ fontSize: 22, fontWeight: 600, color: '#C9913A', marginBottom: 12 }}>
              Sona Platform Ready
            </h2>
            <p style={{ fontSize: 14, color: '#94A3B8', marginBottom: 20, lineHeight: 1.6 }}>
              The application encountered a client error during load.
            </p>
            <button
              style={{
                background: '#C9913A',
                color: '#07091A',
                border: 'none',
                padding: '10px 24px',
                borderRadius: 8,
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 14
              }}
              onClick={() => {
                this.setState({ hasError: false });
                window.location.reload();
              }}
            >
              Reload Platform
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <PortfolioProvider>
              <BalanceVisibilityProvider>
                <NavDrawerProvider>
                  <App />
                </NavDrawerProvider>
              </BalanceVisibilityProvider>
            </PortfolioProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </RootErrorBoundary>
  </React.StrictMode>
);
