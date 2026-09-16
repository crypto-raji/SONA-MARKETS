import React from 'react';
import Header from '../components/Header.jsx';
import PortfolioSummary from '../components/PortfolioSummary.jsx';
import HoldingsList from '../components/HoldingsList.jsx';
import LoadingState from '../components/LoadingState.jsx';
import ErrorState from '../components/ErrorState.jsx';
import AIButton from '../components/ai/AIButton.jsx';
import { usePortfolio } from '../context/PortfolioContext.jsx';
import { useAsync } from '../hooks/useAsync.js';
import * as portfolioService from '../services/portfolioService.js';
import { formatPercent } from '../utils/format.js';

export default function Portfolio() {
  const { portfolio, loading, refreshPortfolio } = usePortfolio();
  const { data: performance } = useAsync(() => portfolioService.getPortfolioPerformance('1M'), []);
  const { data: allocation } = useAsync(() => portfolioService.getPortfolioAllocation(), [portfolio]);

  return (
    <div className="app-main">
      <Header title="Portfolio" />
      <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        {loading && !portfolio && <LoadingState />}
        {!loading && !portfolio && <ErrorState message="Failed to load your portfolio." onRetry={refreshPortfolio} />}

        {portfolio && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <AIButton context={{ portfolio: true }} label="Ask Sona AI about my portfolio" />
            </div>

            <PortfolioSummary portfolio={portfolio} performance={performance} />

            {allocation && allocation.length > 0 && (
              <section>
                <h2 style={{ fontSize: 16, marginBottom: 'var(--space-3)' }}>Asset allocation</h2>
                <div className="card" style={{ padding: 'var(--space-4)' }}>
                  {allocation.map((a) => (
                    <div key={a.symbol} style={{ marginBottom: 'var(--space-3)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                        <span>{a.symbol}</span>
                        <span className="text-secondary">{formatPercent(a.percent)}</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 4, background: 'var(--color-border)' }}>
                        <div style={{ height: '100%', width: `${a.percent}%`, borderRadius: 4, background: 'var(--color-accent)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 style={{ fontSize: 16, marginBottom: 'var(--space-3)' }}>Holdings</h2>
              <HoldingsList holdings={portfolio.holdings} />
            </section>
          </>
        )}
      </div>
    </div>
  );
}
