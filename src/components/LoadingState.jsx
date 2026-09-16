import React from 'react';

const SPIN_CSS = `
  @keyframes sonaSpinOuter { to { transform: rotate(360deg); } }
  @keyframes sonaSpinInner { to { transform: rotate(-360deg); } }
  @keyframes sonaFadeIn { from { opacity: 0; } to { opacity: 1; } }
`;

/** Full-page large spinner — no text. Used everywhere a fetch is in-flight. */
export default function LoadingState() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: '100%', minHeight: '60vh',
      animation: 'sonaFadeIn 0.2s ease',
    }}>
      <style>{SPIN_CSS}</style>
      <div style={{ position: 'relative', width: 80, height: 80 }}>
        {/* Outer ring */}
        <svg
          viewBox="0 0 80 80" width="80" height="80"
          style={{ position: 'absolute', inset: 0, animation: 'sonaSpinOuter 1.1s linear infinite' }}
        >
          <circle cx="40" cy="40" r="34" fill="none"
            stroke="var(--color-accent)" strokeWidth="4"
            strokeLinecap="round" strokeDasharray="60 154"
          />
        </svg>
        {/* Inner ring (counter-spin) */}
        <svg
          viewBox="0 0 80 80" width="80" height="80"
          style={{ position: 'absolute', inset: 0, animation: 'sonaSpinInner 0.8s linear infinite' }}
        >
          <circle cx="40" cy="40" r="22" fill="none"
            stroke="var(--color-accent)" strokeWidth="3"
            strokeOpacity="0.35" strokeLinecap="round" strokeDasharray="30 108"
          />
        </svg>
        {/* Centre dot */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: 'var(--color-accent)', opacity: 0.8,
          }} />
        </div>
      </div>
    </div>
  );
}

/** Skeleton rows — kept for list placeholders (e.g. Markets page). */
export function LoadingRows({ count = 4, height = 64 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', animation: 'sonaFadeIn 0.2s ease' }}>
      <style>{SPIN_CSS}</style>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height, borderRadius: 12 }} />
      ))}
    </div>
  );
}
