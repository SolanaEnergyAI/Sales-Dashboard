import React from 'react';

function fmtPct(v) {
  return v === null || v === undefined ? '—' : `${v}%`;
}

const ORDER = {
  leadGen: ['assignedToBooked', 'assignedToSat', 'assignedToSold', 'bookedToSat', 'bookedToSold', 'satToSold'],
  salesRep: ['assignedToSat', 'assignedToSold', 'bookedToSat', 'bookedToSold', 'satToSold'],
};

export default function ConversionPanel({ role, totals, labels }) {
  const conv = totals?.conv || {};
  const keys = ORDER[role].filter((k) => k in conv);
  return (
    <div className="panel flush">
      <h2 className="panel-title">Conversion Funnel</h2>
      <div className="conv-list">
        {keys.map((k) => {
          const v = conv[k];
          const na = v === null || v === undefined;
          const width = na ? 0 : Math.min(100, v);
          return (
            <div className="conv-row" key={k}>
              <span className="conv-name">{labels[k] || k}</span>
              <span className="conv-track">
                <span className="conv-fill" style={{ width: `${width}%` }} />
              </span>
              <span className={na ? 'conv-num na' : 'conv-num'}>{fmtPct(v)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
