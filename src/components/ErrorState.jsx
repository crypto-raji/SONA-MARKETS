import React from 'react';

export default function ErrorState({ title = 'Something went wrong.', message, onRetry }) {
  return (
    <div
      className="card"
      style={{
        padding: 'var(--space-6)',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-3)',
      }}
    >
      <div style={{ fontSize: 28 }}>⚠</div>
      <h3 style={{ fontSize: 16 }}>{title}</h3>
      {message && <p className="text-secondary" style={{ fontSize: 13, maxWidth: 320 }}>{message}</p>}
      {onRetry && (
        <button className="btn btn-secondary btn-sm" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
