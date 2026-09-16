import React from 'react';
import AIConversation from './AIConversation.jsx';
import AIInput from './AIInput.jsx';
import AISuggestedPrompts from './AISuggestedPrompts.jsx';

export default function AIChat({ messages, loading, error, userName, onSend, onAction, onRetry, onCancel }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '60vh', minHeight: 420 }}>
      {messages.length === 0 ? (
        <div style={{ padding: 'var(--space-5)', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 'var(--space-4)' }}>
          <div>
            <h3 style={{ fontSize: 20, marginBottom: 4 }}>
              Welcome{userName ? <> <span style={{ color: 'var(--color-accent)' }}>{userName.split(' ')[0]}</span></> : ''}
            </h3>
            <p className="text-secondary" style={{ fontSize: 13 }}>What do you want to do?</p>
          </div>
          <AISuggestedPrompts onSelect={onSend} />
        </div>
      ) : (
        <AIConversation messages={messages} loading={loading} error={error} onAction={onAction} onRetry={onRetry} onCancel={onCancel} />
      )}
      <AIInput onSend={onSend} disabled={loading} />
    </div>
  );
}
