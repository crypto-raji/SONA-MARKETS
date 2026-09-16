import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import AIAssistant from '../components/ai/AIAssistant.jsx';

export default function AIAssistantPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const context = location.state?.context;

  const conversationId = useMemo(() => {
    if (context?.symbol) return `asset-${context.symbol}`;
    if (context?.portfolio) return 'portfolio';
    if (context?.transaction) return `tx-${context.transaction.id}`;
    return 'default';
  }, [context]);

  const handleActionProposal = (proposal) => {
    // Sona AI only proposes — the platform's normal review-and-confirm flow
    // (with PIN / wallet approval) takes over from here.
    if (proposal.type === 'BUY_ASSET') {
      navigate(`/buy?symbol=${proposal.asset}`);
    } else if (proposal.type === 'SELL_ASSET') {
      navigate(`/sell?symbol=${proposal.asset}`);
    } else if (proposal.type === 'SEND_ASSET') {
      navigate(`/send?symbol=${proposal.asset}`);
    }
  };

  return (
    <div className="app-main">
      <Header title="Sona AI" />
      <div className="page-container" style={{ maxWidth: 720 }}>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <h1 style={{ fontSize: 20, marginBottom: 4 }}>Sona AI Assistant</h1>
          <p className="text-secondary" style={{ fontSize: 13 }}>
            Ask about assets, prices, your portfolio, or how the platform works.
            Sona AI can prepare transaction proposals, but every transaction
            still requires your explicit review, confirmation, and PIN or
            wallet approval.
          </p>
        </div>
        <AIAssistant conversationId={conversationId} context={context} onActionProposal={handleActionProposal} />
      </div>
    </div>
  );
}
