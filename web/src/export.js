// Build and download CSV exports of the current dashboard view.

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows) {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

function download(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const CONV_KEYS = {
  leadGen: ['assignedToBooked', 'assignedToSat', 'assignedToSold', 'bookedToSat', 'bookedToSold', 'satToSold'],
  salesRep: ['assignedToSat', 'assignedToSold', 'bookedToSat', 'bookedToSold', 'satToSold'],
};

export function exportCsv({ data, role }) {
  if (!data) return;
  const roleData = data[role];
  const roleName = role === 'leadGen' ? 'Lead Gen' : 'Sales Rep';
  const convKeys = CONV_KEYS[role];

  const rows = [];
  rows.push([`Solana Energy — ${roleName} metrics`, data.timeframeLabel || data.timeframe]);
  rows.push([]);

  // Leaderboard
  rows.push([roleName, 'Assigned', 'Booked', 'Sat', 'Sold', 'Revenue', 'Gross Profit', ...convKeys.map((k) => k)]);
  for (const p of roleData.people) {
    rows.push([
      p.name, p.assigned, p.booked, p.sat, p.sold, p.revenue, p.grossProfit,
      ...convKeys.map((k) => (p.conv?.[k] === null || p.conv?.[k] === undefined ? '' : p.conv[k])),
    ]);
  }
  const t = roleData.totals;
  rows.push(['TOTAL', t.assigned, t.booked, t.sat, t.sold, t.revenue, t.grossProfit]);

  // Lead sources
  rows.push([]);
  rows.push(['Lead Source', 'Leads', 'Sold', 'Conv %', 'Revenue', 'Avg CPL', 'Spend']);
  for (const s of data.leadSources || []) {
    rows.push([s.source, s.leads, s.sold, s.convRate ?? '', s.revenue, s.avgCpl ?? '', s.spend]);
  }

  const stamp = (data.timeframe || 'export') + '_' + new Date().toISOString().slice(0, 10);
  download(`solana_${role}_${stamp}.csv`, toCsv(rows));
}
