import React, { useState } from 'react';

export default function AIInput({ onSend, disabled }) {
  const [value, setValue] = useState('');

  const handleSend = () => {
    const text = value.trim();
    if (!text) return;
    onSend(text);
    setValue('');
  };

  return (
    <div style={{ display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
      <input
        className="input-field"
        placeholder="Ask Sona AI anything about the platform..."
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
      />
      <button className="btn btn-primary" onClick={handleSend} disabled={disabled || !value.trim()} aria-label="Send message">
        Send
      </button>
    </div>
  );
}
