import React, { useEffect, useRef } from 'react';
import AIMessage from './AIMessage.jsx';
import AILoading from './AILoading.jsx';
import AIError from './AIError.jsx';

export default function AIConversation({ messages, loading, error, onAction, onRetry, onCancel }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <div className="scroll-hide" style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)' }}>
      {messages.map((m) => (
        <AIMessage key={m.id} message={m} onAction={onAction} />
      ))}
      {loading && <AILoading onCancel={onCancel} />}
      {error && <AIError onRetry={onRetry} message={error} />}
      <div ref={endRef} />
    </div>
  );
}
