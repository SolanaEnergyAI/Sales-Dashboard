import React from 'react';

const CARDS = [
  { key: 'assigned', label: 'Assigned', hint: 'Leads assigned' },
  { key: 'booked', label: 'Booked', hint: 'Appointments booked' },
  { key: 'sat', label: 'Sat', hint: 'Appointments sat' },
  { key: 'sold', label: 'Sold', hint: 'Sales made' },
];

export default function KpiCards({ totals }) {
  return (
    <div className="kpi-grid">
      {CARDS.map((c) => (
        <div className={`kpi-card kpi-${c.key}`} key={c.key}>
          <div className="kpi-value">{(totals?.[c.key] ?? 0).toLocaleString()}</div>
          <div className="kpi-label">{c.label}</div>
          <div className="kpi-hint">{c.hint}</div>
        </div>
      ))}
    </div>
  );
}
