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

export default function KpiCards({ totals, compare }) {
  return (
    <div className="kpi-grid">
      {COUNT_CARDS.map((c) => (
        <Card key={c.key} c={c} delta={compare?.[c.key]}>
          {(totals?.[c.key] ?? 0).toLocaleString()}
        </Card>
      ))}
      {MONEY_CARDS.map((c) => (
        <Card key={c.key} c={c} money delta={compare?.[c.key]}>
          {money(totals?.[c.key])}
        </Card>
      ))}
    </div>
  );
}

function Delta({ delta }) {
  if (!delta) return null;
  const { delta: d, previous } = delta;
  // No prior baseline but activity now -> "new"; flat -> em dash.
  if (d === null) return previous === 0 ? <span className="delta new">NEW</span> : null;
  if (d === 0) return <span className="delta flat">—</span>;
  const up = d > 0;
  return (
    <span className={up ? 'delta up' : 'delta down'} title="vs previous period">
      {up ? '▲' : '▼'} {Math.abs(d)}%
    </span>
  );
}

function Card({ c, money, delta, children }) {
  return (
    <div className={`kpi-card kpi-${c.key}`}>
      <div className="kpi-top">
        <span className="kpi-label">{c.label}</span>
        <span className="kpi-icon">{c.icon}</span>
      </div>
      <div className={money ? 'kpi-value money' : 'kpi-value'}>{children}</div>
      <div className="kpi-foot">
        <span className="kpi-hint">{c.hint}</span>
        <Delta delta={delta} />
      </div>
    </div>
  );
}
