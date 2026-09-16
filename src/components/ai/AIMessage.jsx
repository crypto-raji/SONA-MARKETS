import React from 'react';
import AIActionConfirmation from './AIActionConfirmation.jsx';

function renderInline(str) {
  if (!str) return '';
  // Clean lingering #* or stray start hashes
  const s = str.replace(/#\*/g, '').replace(/^[#\s]+/, '');
  const parts = [];
  let remaining = s;
  let key = 0;

  const regex = /(\*\*([^*]+)\*\*|`([^`]+)`)/;
  while (remaining) {
    const match = remaining.match(regex);
    if (!match) {
      parts.push(remaining.replace(/#\*/g, ''));
      break;
    }
    const matchIndex = match.index;
    if (matchIndex > 0) {
      parts.push(remaining.slice(0, matchIndex).replace(/#\*/g, ''));
    }
    if (match[2]) {
      parts.push(<strong key={key++} style={{ fontWeight: 600 }}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(
        <code key={key++} style={{ background: 'rgba(255,255,255,0.12)', padding: '1px 5px', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: '0.9em' }}>
          {match[3]}
        </code>
      );
    }
    remaining = remaining.slice(matchIndex + match[0].length);
  }
  return parts;
}

function FormattedContent({ text }) {
  if (!text) return null;
  const cleaned = text.replace(/#\*/g, '').replace(/\*#/g, '').trim();
  const lines = cleaned.split('\n');

  const elements = [];
  let currentList = [];

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} style={{ margin: '6px 0', paddingLeft: 18 }}>
          {currentList.map((item, idx) => (
            <li key={idx} style={{ marginBottom: 3 }}>
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();

    if (!line || line.startsWith('|---') || line === '---') {
      flushList();
      return;
    }

    // Markdown headers
    if (/^#+\s+/.test(line)) {
      flushList();
      const headerText = line.replace(/^#+\s*/, '');
      elements.push(
        <div key={`h-${idx}`} style={{ fontWeight: 700, fontSize: 14, margin: '8px 0 3px', color: 'inherit' }}>
          {renderInline(headerText)}
        </div>
      );
      return;
    }

    // Bullet points
    if (/^[\*\-\•]\s+/.test(line)) {
      const itemText = line.replace(/^[\*\-\•]\s+/, '');
      currentList.push(itemText);
      return;
    }

    // Numbered items
    if (/^\d+\.\s+/.test(line)) {
      flushList();
      elements.push(
        <div key={`num-${idx}`} style={{ margin: '3px 0' }}>
          {renderInline(line)}
        </div>
      );
      return;
    }

    flushList();
    elements.push(
      <p key={`p-${idx}`} style={{ margin: '3px 0', lineHeight: 1.5 }}>
        {renderInline(line)}
      </p>
    );
  });

  flushList();
  return <>{elements}</>;
}

export default function AIMessage({ message, onAction }) {
  const isUser = message.role === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 'var(--space-3)' }}>
      <div style={{ maxWidth: '85%', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <div
          style={{
            background: isUser ? 'var(--color-accent)' : 'var(--color-surface-raised)',
            color: isUser ? '#fff' : 'var(--color-text-primary)',
            border: isUser ? 'none' : '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            borderBottomRightRadius: isUser ? 4 : 'var(--radius-lg)',
            borderBottomLeftRadius: isUser ? 'var(--radius-lg)' : 4,
            padding: '10px 14px',
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          {isUser ? message.text : <FormattedContent text={message.text} />}
        </div>
        {message.actionProposal && (
          <AIActionConfirmation proposal={message.actionProposal} onAction={onAction} />
        )}
      </div>
    </div>
  );
}
