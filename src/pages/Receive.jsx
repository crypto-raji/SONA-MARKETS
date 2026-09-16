import React from 'react';
import Header from '../components/Header.jsx';
import ReceiveModal from '../components/ReceiveModal.jsx';
import { useSearchParams } from 'react-router-dom';

export default function Receive() {
  const [params] = useSearchParams();
  return (
    <div className="app-main">
      <Header title="Receive" />
      <div className="page-container" style={{ maxWidth: 520 }}>
        <div className="card" style={{ padding: 'var(--space-5)' }}>
          <ReceiveModal asModal={false} open defaultSymbol={params.get('symbol')} onClose={() => {}} />
        </div>
      </div>
    </div>
  );
}
