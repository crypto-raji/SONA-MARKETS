import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * "Ask Sona AI" quick-access entry point. Pass `context` (e.g. an asset
 * symbol or portfolio flag) so the assistant opens pre-loaded with it.
 */
export default function AIButton({ context, label = 'Ask Sona AI', variant = 'secondary' }) {
  const navigate = useNavigate();
  return (
    <button
      className={`btn btn-${variant}`}
      onClick={() => navigate('/ai-assistant', { state: { context } })}
    >
      <span aria-hidden="true">✦</span> {label}
    </button>
  );
}
