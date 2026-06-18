import React from 'react';

const COUNT_CARDS = [
  { key: 'assigned', label: 'Assigned', hint: 'Leads assigned' },
  { key: 'booked', label: 'Booked', hint: 'Appointments booked' },
  { key: 'sat', label: 'Sat', hint: 'Appointments sat' },
  { key: 'sold', label: 'Sold', hint: 'Sales made' },
];

const MONEY_CARDS = [
  { key: 'revenue', label: 'Revenue', hint: 'Total revenue (sold)' },
  { key: 'grossProfit', label: 'Gross Profit', hint: 'GP on sold deals' },
];

const money = (n) =>
  '$' + Math.round(n || 0).toLocaleString('en-AU');

export default function KpiCards({ totals }) {
  return (
    <div className="kpi-grid">
      {COUNT_CARDS.map((c) => (
        <div className={`kpi-card kpi-${c.key}`} key={c.key}>
          <div className="kpi-value">{(totals?.[c.key] ?? 0).toLocaleString()}</div>
          <div className="kpi-label">{c.label}</div>
          <div className="kpi-hint">{c.hint}</div>
        </div>
      ))}
      {MONEY_CARDS.map((c) => (
        <div className={`kpi-card kpi-${c.key}`} key={c.key}>
          <div className="kpi-value money">{money(totals?.[c.key])}</div>
          <div className="kpi-label">{c.label}</div>
          <div className="kpi-hint">{c.hint}</div>
        </div>
      ))}
    </div>
  );
}
