import React, { useState } from 'react';
import * as authService from '../services/authService.js';
import { isValidPin } from '../utils/validators.js';

/**
 * Reusable PIN entry modal used to confirm sensitive transactions, and to
 * create a PIN the first time. The PIN is only ever held in local component
 * state long enough to submit it — never written to localStorage or logged.
 */
export default function PinModal({ open, mode = 'verify', onClose, onSuccess }) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const reset = () => {
    setPin('');
    setConfirmPin('');
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    const pinError = isValidPin(pin);
    if (pinError) return setError(pinError);
    if (mode === 'create' && pin !== confirmPin) return setError('PINs do not match.');

    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'create') {
        await authService.createTransactionPin(pin);
      } else {
        const result = await authService.verifyTransactionPin(pin);
        if (!result.success) throw new Error('Incorrect PIN.');
      }
      reset();
      onSuccess();
    } catch (e) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 360 }}>
        <div style={{ padding: 'var(--space-5)' }}>
          <h2 style={{ fontSize: 17, marginBottom: 4 }}>
            {mode === 'create' ? 'Create a transaction PIN' : 'Enter your PIN'}
          </h2>
          <p className="text-secondary" style={{ fontSize: 13, marginBottom: 'var(--space-4)' }}>
            {mode === 'create'
              ? 'Your PIN confirms sensitive actions like buying, selling, and sending assets.'
              : 'Confirm this action with your transaction PIN.'}
          </p>

          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            className="input-field"
            placeholder="Enter PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            style={{ letterSpacing: 6, textAlign: 'center', fontSize: 20, marginBottom: 'var(--space-3)' }}
          />

          {mode === 'create' && (
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              className="input-field"
              placeholder="Confirm PIN"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              style={{ letterSpacing: 6, textAlign: 'center', fontSize: 20, marginBottom: 'var(--space-3)' }}
            />
          )}

          {error && <p className="text-negative" style={{ fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</p>}

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button className="btn btn-ghost" onClick={handleClose} disabled={submitting}>Cancel</button>
            <button className="btn btn-primary btn-block" onClick={handleSubmit} disabled={submitting}>
              {submitting
                ? (mode === 'create' ? 'Saving...' : 'Verifying...')
                : (mode === 'create' ? 'Create PIN' : 'Confirm')}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
