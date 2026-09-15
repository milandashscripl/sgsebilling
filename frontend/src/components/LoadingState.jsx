import React from 'react';

export default function LoadingState({ label = 'Loading workspace data', rows = 3, compact = false }) {
  return <div className={`section-loading ${compact ? 'compact' : ''}`} role="status" aria-live="polite">
    <div className="section-loading-head"><span className="section-loading-spinner" aria-hidden="true" /><strong>{label}</strong><small>Syncing securely</small></div>
    <div className="section-loading-lines" aria-hidden="true">{Array.from({ length: rows }, (_, index) => <i key={index} style={{ width: `${82 - index * 13}%` }} />)}</div>
  </div>;
}
