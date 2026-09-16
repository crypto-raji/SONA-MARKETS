import React from 'react';

const DEFAULT_PROMPTS = [
  {
    icon: '⇄',
    color: '#3457D5',
    title: 'Trade',
    description: 'I want to make a swap from one token to another.',
    query: 'I want to swap one token for another.',
  },
  {
    icon: '◷',
    color: '#7C4DFF',
    title: 'Check transaction history',
    description: 'Get me my transaction history from so-and-so day to this day.',
    query: 'Show me my recent transaction history.',
  },
  {
    icon: '⬈',
    color: '#14804A',
    title: 'Check Tesla price',
    description: 'Get me the current price of Tesla and the chart with info about the token.',
    query: 'What is the current price of Tesla, and what does the chart look like?',
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
