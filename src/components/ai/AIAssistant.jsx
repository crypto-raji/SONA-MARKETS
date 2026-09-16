import React, { useCallback, useEffect, useRef, useState } from 'react';
import AIChat from './AIChat.jsx';
import * as sonaAIService from '../../services/sonaAIService.js';
import { useAuth } from '../../context/AuthContext.jsx';

/**
 * Self-contained Sona AI widget: owns conversation state and talks to
 * sonaAIService directly. Used by the dedicated AI Assistant page, and can
 * be dropped into any other page (asset details, portfolio) with a
 * different `context` to pre-load relevant information for the assistant.
 */
export default function AIAssistant({ conversationId = 'default', context, onActionProposal }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    sonaAIService.getConversationHistory(conversationId).then(setMessages);
  }, [conversationId]);

  const handleSend = useCallback(
    async (text) => {
      setError(null);
      setLoading(true);
      cancelledRef.current = false;
      setMessages((prev) => [...prev, { id: `local-${Date.now()}`, role: 'user', text }]);
      try {
        const { message } = await sonaAIService.sendMessage({ conversationId, text, context });
        if (cancelledRef.current) return;
        setMessages((prev) => [...prev.filter((m) => !m.id.startsWith('local-')), message]);
        const full = await sonaAIService.getConversationHistory(conversationId);
        if (!cancelledRef.current) setMessages(full);
      } catch (e) {
        if (!cancelledRef.current) setError(e.message || 'Failed to reach Sona AI.');
      } finally {
        setLoading(false);
      }
    },
    [conversationId, context]
  );

  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
    setLoading(false);
    setMessages((prev) => prev.filter((m) => !m.id.startsWith('local-')));
  }, []);

  const handleAction = useCallback(
    (proposal) => {
      if (proposal) onActionProposal?.(proposal);
    },
    [onActionProposal]
  );

  const handleClear = async () => {
    await sonaAIService.clearConversation(conversationId);
    setMessages([]);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-2)' }}>
        {messages.length > 0 && (
          <button className="btn-ghost btn-sm" onClick={handleClear}>Clear conversation</button>
        )}
      </div>
      <AIChat
        messages={messages}
        loading={loading}
        error={error}
        userName={user?.name}
        onSend={handleSend}
        onAction={handleAction}
        onRetry={() => setError(null)}
        onCancel={handleCancel}
      />
    </div>
  );
}
