import React, { useState } from 'react';

const BASE_COLS = [
  { key: 'assigned', label: 'Assigned' },
  { key: 'booked', label: 'Booked' },
  { key: 'sat', label: 'Sat' },
  { key: 'sold', label: 'Sold' },
];

const CONV_COLS = {
  leadGen: [
    { key: 'assignedToBooked', label: 'A→B' },
    { key: 'assignedToSat', label: 'A→Sat' },
    { key: 'assignedToSold', label: 'A→Sold' },
    { key: 'bookedToSat', label: 'B→Sat' },
    { key: 'bookedToSold', label: 'B→Sold' },
    { key: 'satToSold', label: 'Sat→Sold' },
  ],
  salesRep: [
    { key: 'assignedToSat', label: 'A→Sat' },
    { key: 'assignedToSold', label: 'A→Sold' },
    { key: 'bookedToSat', label: 'B→Sat' },
    { key: 'bookedToSold', label: 'B→Sold' },
    { key: 'satToSold', label: 'Sat→Sold' },
  ],
};

function pct(v) {
  return v === null || v === undefined ? '—' : `${v}%`;
}

export default function Leaderboard({ role, people }) {
  const [sortKey, setSortKey] = useState('sold');
  const [dir, setDir] = useState('desc');
  const convCols = CONV_COLS[role];

  const sorted = [...people].sort((a, b) => {
    const av = sortKey in (a.conv || {}) ? a.conv[sortKey] ?? -1 : a[sortKey];
    const bv = sortKey in (b.conv || {}) ? b.conv[sortKey] ?? -1 : b[sortKey];
    return dir === 'desc' ? bv - av : av - bv;
  });

  function setSort(key) {
    if (key === sortKey) setDir(dir === 'desc' ? 'asc' : 'desc');
    else {
      setSortKey(key);
      setDir('desc');
    }
  }

  const arrow = (key) => (key === sortKey ? (dir === 'desc' ? ' ▼' : ' ▲') : '');

  return (
    <div className="panel">
      <h2 className="panel-title">{role === 'leadGen' ? 'Lead Gen' : 'Sales Rep'} Leaderboard</h2>
      <div className="table-wrap">
        <table className="board-table">
          <thead>
            <tr>
              <th className="sticky-col">Name</th>
              {BASE_COLS.map((c) => (
                <th key={c.key} className="num clickable" onClick={() => setSort(c.key)}>
                  {c.label}
                  {arrow(c.key)}
                </th>
              ))}
              <th className="divider" />
              {convCols.map((c) => (
                <th key={c.key} className="num conv clickable" onClick={() => setSort(c.key)}>
                  {c.label}
                  {arrow(c.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={BASE_COLS.length + convCols.length + 2} className="empty">
                  No activity in this timeframe.
                </td>
              </tr>
            )}
            {sorted.map((p) => (
              <tr key={p.id}>
                <td className="sticky-col name">{p.name}</td>
                {BASE_COLS.map((c) => (
                  <td key={c.key} className="num">
                    {p[c.key]}
                  </td>
                ))}
                <td className="divider" />
                {convCols.map((c) => (
                  <td key={c.key} className="num conv">
                    {pct(p.conv?.[c.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
