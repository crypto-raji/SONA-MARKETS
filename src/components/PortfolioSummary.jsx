import React from 'react';
import PriceChart from './PriceChart.jsx';
import { formatCurrency, formatPercent } from '../utils/format.js';
import { useBalanceVisibility, Masked } from '../context/BalanceVisibilityContext.jsx';

export default function PortfolioSummary({ portfolio, performance }) {
  const { hidden } = useBalanceVisibility();
  if (!portfolio) return null;
  const positive = portfolio.profitLoss >= 0;

  return (
    <div className="card" style={{ padding: 'var(--space-5)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <div className="text-secondary" style={{ fontSize: 13, marginBottom: 4 }}>Total portfolio value</div>
          <div style={{ fontSize: 32, fontWeight: 700, fontFamily: 'var(--font-display)' }}>
            <Masked hidden={hidden}>{formatCurrency(portfolio.totalValue)}</Masked>
          </div>
          <span className={`pill ${positive ? 'pill-positive' : 'pill-negative'}`} style={{ marginTop: 6 }}>
            <Masked hidden={hidden}>{formatCurrency(portfolio.profitLoss)} ({formatPercent(portfolio.profitLossPercent)})</Masked>
          </span>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-6)' }}>
          <Stat
            label={portfolio.balanceIsLive ? 'Wallet (Live)' : 'Available balance'}
            value={`${portfolio.availableBalance} SOL`}
            hidden={hidden}
            live={portfolio.balanceIsLive}
          />
          <Stat label="Invested" value={formatCurrency(portfolio.investedValue)} hidden={hidden} />
        </div>
      </div>

      {performance && (
        <div style={{ marginTop: 'var(--space-5)' }}>
          <PriceChart series={performance.series.map((p) => ({ t: p.t, price: p.value }))} positive={positive} height={200} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, hidden, live }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span className="text-tertiary" style={{ fontSize: 12 }}>{label}</span>
        {live && (
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#16a34a', display: 'inline-block', flexShrink: 0,
          }} />
        )}
      </div>
      <div style={{ fontSize: 16, fontWeight: 600 }}><Masked hidden={hidden}>{value}</Masked></div>
    </div>
  );
}
