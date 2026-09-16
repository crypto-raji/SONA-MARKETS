import React from 'react';

export default function AIError({ onRetry, message }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'var(--space-2) 0' }}>
      <button
        onClick={onRetry}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', borderRadius: 20,
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.3)',
          cursor: onRetry ? 'pointer' : 'default',
          fontSize: 13, fontWeight: 500,
          color: 'var(--color-negative)',
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => onRetry && (e.currentTarget.style.background = 'rgba(239,68,68,0.15)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
      >
        <span style={{ fontSize: 14 }}>⚠</span>
        {message || 'Request failed'}
        {onRetry && <span style={{ marginLeft: 4, opacity: 0.7, fontSize: 11 }}>· Retry</span>}
      </button>
    </div>
  );
}
