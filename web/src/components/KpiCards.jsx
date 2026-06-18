import React from 'react';

const COUNT_CARDS = [
  { key: 'assigned', label: 'Assigned', icon: '👥', hint: 'Leads assigned' },
  { key: 'booked', label: 'Booked', icon: '📅', hint: 'Appointments booked' },
  { key: 'sat', label: 'Sat', icon: '🤝', hint: 'Appointments sat' },
  { key: 'sold', label: 'Sold', icon: '✅', hint: 'Sales made' },
];

const MONEY_CARDS = [
  { key: 'revenue', label: 'Revenue', icon: '💰', hint: 'Sold deal value' },
  { key: 'grossProfit', label: 'Gross Profit', icon: '📈', hint: 'GP (post-install)' },
];

const money = (n) => '$' + Math.round(n || 0).toLocaleString('en-AU');

export default function KpiCards({ totals }) {
  return (
    <div className="kpi-grid">
      {COUNT_CARDS.map((c) => (
        <Card key={c.key} c={c}>
          {(totals?.[c.key] ?? 0).toLocaleString()}
        </Card>
      ))}
      {MONEY_CARDS.map((c) => (
        <Card key={c.key} c={c} money>
          {money(totals?.[c.key])}
        </Card>
      ))}
    </div>
  );
}

function Card({ c, money, children }) {
  return (
    <div className={`kpi-card kpi-${c.key}`}>
      <div className="kpi-top">
        <span className="kpi-label">{c.label}</span>
        <span className="kpi-icon">{c.icon}</span>
      </div>
      <div className={money ? 'kpi-value money' : 'kpi-value'}>{children}</div>
      <div className="kpi-hint">{c.hint}</div>
    </div>
  );
}
