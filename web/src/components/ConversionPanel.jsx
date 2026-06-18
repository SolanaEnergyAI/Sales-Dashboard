import React from 'react';

function fmtPct(v) {
  return v === null || v === undefined ? '—' : `${v}%`;
}

// Order conversions logically per role.
const ORDER = {
  leadGen: ['assignedToBooked', 'assignedToSat', 'assignedToSold', 'bookedToSat', 'bookedToSold', 'satToSold'],
  salesRep: ['assignedToSat', 'assignedToSold', 'bookedToSat', 'bookedToSold', 'satToSold'],
};

export default function ConversionPanel({ role, totals, labels }) {
  const conv = totals?.conv || {};
  const keys = ORDER[role].filter((k) => k in conv);
  return (
    <div className="panel">
      <h2 className="panel-title">Conversion Rates (Creation-log cohort)</h2>
      <div className="conv-grid">
        {keys.map((k) => {
          const v = conv[k];
          const width = v === null || v === undefined ? 0 : Math.min(100, v);
          return (
            <div className="conv-card" key={k}>
              <div className="conv-head">
                <span className="conv-label">{labels[k] || k}</span>
                <span className="conv-value">{fmtPct(v)}</span>
              </div>
              <div className="conv-bar-track">
                <div className="conv-bar-fill" style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
