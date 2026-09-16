import React from 'react';

export default function EmptyState({ title = 'Nothing here yet.', message, action }) {
  return (
    <div
      className="card"
      style={{
        padding: 'var(--space-7) var(--space-5)',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-2)',
      }}
    >
      <h3 style={{ fontSize: 15 }}>{title}</h3>
      {message && <p className="text-secondary" style={{ fontSize: 13, maxWidth: 320 }}>{message}</p>}
      {action}
    </div>
  );
}
