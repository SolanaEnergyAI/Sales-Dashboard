import React from 'react';

const money = (n) => '$' + Math.round(n || 0).toLocaleString('en-AU');
const pct = (v) => (v === null || v === undefined ? '—' : `${v}%`);
const cpl = (v) => (v === null || v === undefined ? '—' : money(v));

export default function LeadSourcePanel({ sources }) {
  const rows = sources || [];
  return (
    <div className="panel flush">
      <h2 className="panel-title">Lead Source Performance</h2>
      <div className="table-wrap">
        <table className="board-table">
          <thead>
            <tr>
              <th className="sticky-col">Source</th>
              <th className="num">Leads</th>
              <th className="num">Sold</th>
              <th className="num">Conv %</th>
              <th className="num">Revenue</th>
              <th className="num">Avg CPL</th>
              <th className="num">Spend</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">No lead-source activity in this timeframe.</td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.source}>
                <td className="sticky-col name">{r.source}</td>
                <td className="num">{r.leads}</td>
                <td className="num">{r.sold}</td>
                <td className="num conv">{pct(r.convRate)}</td>
                <td className="num">{money(r.revenue)}</td>
                <td className="num conv">{cpl(r.avgCpl)}</td>
                <td className="num conv">{money(r.spend)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">
        Leads &amp; spend are counted by <b>Assigned to LG</b> date; Sold &amp; Revenue by <b>Sold Date</b>, within the selected timeframe.
      </p>
    </div>
  );
}
