import React, { useCallback, useEffect, useRef, useState } from 'react';
import AIChat from './AIChat.jsx';
import * as sonaAIService from '../../services/sonaAIService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePortfolio } from '../../context/PortfolioContext.jsx';
import { getActiveNetwork } from '../../constants/network.js';

/**
 * Self-contained Sona AI widget: owns conversation state and talks to
 * sonaAIService directly. Injects live user portfolio context, balances,
 * holdings, and network data so Sona AI delivers elite, personalized advice.
 */
export default function AIAssistant({ conversationId = 'default', context, onActionProposal }) {
  const { user } = useAuth();
  const { portfolio } = usePortfolio();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const cancelledRef = useRef(false);

  // Build live dynamic context about user portfolio, holdings, and active cluster
  const dynamicContext = {
    userName: user?.name || 'Trader',
    userEmail: user?.email || null,
    activeNetwork: getActiveNetwork(),
    solanaAddress: user?.wallets?.solana || null,
    totalPortfolioValueUsd: portfolio?.totalValue ?? 0,
    availableSolBalance: portfolio?.availableBalance ?? 0,
    onChainTokens: portfolio?.onChainTokens || [],
    stockAndCryptoHoldings: portfolio?.holdings?.map(h => ({
      symbol: h.symbol,
      quantity: h.quantity,
      costBasis: h.costBasis,
      currentValue: h.currentValue,
      profitLoss: h.profitLoss,
      profitLossPercent: h.profitLossPercent,
    })) || [],
    pageSpecificContext: context || null,
  };

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
        const { message } = await sonaAIService.sendMessage({
          conversationId,
          text,
          context: dynamicContext,
        });
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
    [conversationId, dynamicContext]
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
