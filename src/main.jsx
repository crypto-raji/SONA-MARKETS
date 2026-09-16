// Polyfill Buffer for browser — required by bip39, @solana/web3.js and HD wallet libs
import { Buffer } from 'buffer';
globalThis.Buffer = Buffer;

import React from 'react';
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
prefetchMarket();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
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
  </React.StrictMode>
);
