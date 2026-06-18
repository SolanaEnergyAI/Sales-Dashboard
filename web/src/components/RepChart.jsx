import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';

// Funnel bar chart: Assigned / Booked / Sat / Sold per person.
export default function RepChart({ people }) {
  const data = people
    .slice(0, 12)
    .map((p) => ({
      name: p.name.split(' ')[0],
      Assigned: p.assigned,
      Booked: p.booked,
      Sat: p.sat,
      Sold: p.sold,
    }));

  if (data.length === 0) {
    return (
      <div className="panel">
        <h2 className="panel-title">Pipeline by Person</h2>
        <div className="empty pad">No data for this timeframe.</div>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2 className="panel-title">Pipeline by Person</h2>
      <div style={{ width: '100%', height: 320 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#26304a" />
            <XAxis dataKey="name" stroke="#9fb0d0" fontSize={12} />
            <YAxis stroke="#9fb0d0" fontSize={12} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#141b2e', border: '1px solid #2a3650', borderRadius: 8 }}
              labelStyle={{ color: '#e8eefc' }}
            />
            <Legend />
            <Bar dataKey="Assigned" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Booked" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Sat" fill="#f59e0b" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Sold" fill="#10b981" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
