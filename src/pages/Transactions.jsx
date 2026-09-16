import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import TransactionList from '../components/TransactionList.jsx';
import LoadingState from '../components/LoadingState.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import * as transactionService from '../services/transactionService.js';
import { getRpcUrl } from '../constants/network.js';

const TYPE_FILTERS = ['All', 'BUY', 'SELL', 'SEND', 'RECEIVE', 'SWAP', 'WITHDRAW'];

async function fetchOnChainTxs(address) {
  if (!address) return [];
  try {
    const rpc = getRpcUrl();
    // Get recent transaction signatures
    const sigRes = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'getSignaturesForAddress',
        params: [address, { limit: 20, commitment: 'confirmed' }],
      }),
    });
    const { result: sigs } = await sigRes.json();
    if (!sigs?.length) return [];

    // Get parsed transaction details
    const txRes = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 2, method: 'getTransactions',
        params: [sigs.map((s) => s.signature), { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 }],
      }),
    });
    const { result: txs } = await txRes.json();

    return (txs || [])
      .map((tx, i) => {
        if (!tx) return null;
        const sig = sigs[i]?.signature;
        const ts = tx.blockTime ? tx.blockTime * 1000 : Date.now();
        const fee = (tx.meta?.fee || 0) / 1e9;
        const preBalances  = tx.meta?.preBalances  || [];
        const postBalances = tx.meta?.postBalances || [];
        const accountKeys  = tx.transaction?.message?.accountKeys || [];

        // Find which index is our address
        const myIdx = accountKeys.findIndex((k) => {
          const pk = typeof k === 'string' ? k : k?.pubkey;
          return pk === address;
        });

        const delta = myIdx >= 0
          ? ((postBalances[myIdx] || 0) - (preBalances[myIdx] || 0)) / 1e9
          : 0;

        const type   = delta > 0 ? 'RECEIVE' : delta < 0 ? 'SEND' : 'SEND';
        const amount = Math.abs(delta) - (delta < 0 ? fee : 0);

        return {
          id: sig,
          type,
          symbol: 'SOL',
          amount: Math.max(0, amount),
          price: 0,
          total: Math.max(0, Math.abs(delta)),
          status: tx.meta?.err ? 'failed' : 'completed',
          timestamp: new Date(ts).toISOString(),
          txHash: sig,
          onChain: true,
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

export default function Transactions() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [filter, setFilter] = useState('All');
  const [firestoreTxs, setFirestoreTxs] = useState([]);
  const [onChainTxs, setOnChainTxs]   = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const address = user?.wallets?.solana;
    const [fs, oc] = await Promise.all([
      transactionService.getTransactionHistory().catch(() => []),
      fetchOnChainTxs(address),
    ]);
    setFirestoreTxs(fs);
    setOnChainTxs(oc);
    setLoading(false);
  }, [user?.wallets?.solana]);

  useEffect(() => { load(); }, [load]);

  // Merge: deduplicate by txHash, on-chain wins
  const merged = [...onChainTxs];
  for (const tx of firestoreTxs) {
    if (!tx.txHash || !merged.find((t) => t.txHash === tx.txHash)) {
      merged.push(tx);
    }
  }
  merged.sort((a, b) => {
    const timeA = new Date(a.timestamp || a.createdAt?.toDate?.() || 0).getTime();
    const timeB = new Date(b.timestamp || b.createdAt?.toDate?.() || 0).getTime();
    return timeB - timeA;
  });

  const filtered = merged.filter((t) => filter === 'All' || t.type === filter);

  return (
    <div className="app-main">
      <Header title="Transactions" />
      <div className="page-container">
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
          {TYPE_FILTERS.map((t) => (
            <button
              key={t}
              className={`btn btn-sm ${filter === t ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {loading && <LoadingState />}
        {!loading && <TransactionList transactions={filtered} onExplain={(tx) => navigate('/ai-assistant', { state: { context: { transaction: tx } } })} />}
      </div>
    </div>
  );
}
