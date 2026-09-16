import React from 'react';

export default function AILoading({ onCancel }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'var(--space-3) 0' }}>
      <button
        onClick={onCancel}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', borderRadius: 20,
          background: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          cursor: onCancel ? 'pointer' : 'default',
          fontSize: 13, fontWeight: 500,
          color: 'var(--color-text-secondary)',
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => onCancel && (e.currentTarget.style.borderColor = 'var(--color-accent)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
      >
        <span style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          {[0, 1, 2].map(i => (
            <span
              key={i}
              style={{
                width: 5, height: 5, borderRadius: '50%',
                background: 'var(--color-accent)',
                animation: 'sonaAIPulse 1.2s ease-in-out infinite',
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </span>
        Sona is thinking
        {onCancel && <span style={{ marginLeft: 2, opacity: 0.6, fontSize: 11 }}>· Stop</span>}
      </button>
      <style>{`
        @keyframes sonaAIPulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.85); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
