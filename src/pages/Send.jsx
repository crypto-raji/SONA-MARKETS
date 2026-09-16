import React from 'react';
import Header from '../components/Header.jsx';
import SendModal from '../components/SendModal.jsx';
import { useSearchParams } from 'react-router-dom';

export default function Send() {
  const [params] = useSearchParams();
  return (
    <div className="app-main">
      <Header title="Send" />
      <div className="page-container" style={{ maxWidth: 520 }}>
        <div className="card" style={{ padding: 'var(--space-5)' }}>
          <SendModal asModal={false} open defaultSymbol={params.get('symbol')} onClose={() => {}} />
        </div>
      </div>
    </div>
  );
}
