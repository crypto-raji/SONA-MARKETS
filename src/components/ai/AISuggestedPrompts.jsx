import React from 'react';

const DEFAULT_PROMPTS = [
  {
    icon: '📊',
    color: '#3457D5',
    title: 'Analyze My Portfolio & Risk',
    description: 'Review my live holdings, cash reserves, and get rebalancing recommendations.',
    query: 'Analyze my current portfolio holdings and cash balance. Give me a risk breakdown and actionable rebalancing suggestions.',
  },
  {
    icon: '🚀',
    color: '#00C48C',
    title: 'Top Trading Opportunities',
    description: 'Discover high-momentum tech stocks (NVDA, TSLA, AAPL) and Solana market plays.',
    query: 'What are the top trading opportunities across Sona tokenized stocks (NVDA, TSLA, AAPL, META) and crypto (SOL, BTC) right now?',
  },
  {
    icon: '⇄',
    color: '#7C4DFF',
    title: 'DCA & Swap Allocation Strategy',
    description: 'Plan a structured Dollar-Cost-Averaging plan for my USDC/SOL into tokenized equities.',
    query: 'How should I allocate and swap my available USDC and SOL into tokenized stocks using a Dollar-Cost-Averaging (DCA) strategy?',
  },
  {
    icon: '🛡️',
    color: '#C9913A',
    title: 'How Sona Tokenized Stocks Work',
    description: 'Understand synthetic equity backing, 24/7 liquidity, and Solana on-chain settlement.',
    query: 'Explain how Sona Markets settles tokenized US stocks with Solana smart contracts and USDC funding.',
  },
];

export default function AISuggestedPrompts({ prompts = DEFAULT_PROMPTS, onSelect }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {prompts.map((p) => (
        <button
          key={p.title}
          className="card"
          onClick={() => onSelect(p.query || p.title)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            padding: 'var(--space-3) var(--space-4)',
            textAlign: 'left',
            width: '100%',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: `${p.color}1A`, color: p.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
            }}
          >
            {p.icon}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>{p.title}</div>
            <div className="text-secondary" style={{ fontSize: 12, marginTop: 1 }}>{p.description}</div>
          </span>
          <span className="text-tertiary" aria-hidden="true">›</span>
        </button>
      ))}
    </div>
  );
}
