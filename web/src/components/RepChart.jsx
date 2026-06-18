import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';

// Funnel bar chart: Assigned / Booked / Sat / Sold per person.
export default function RepChart({ people }) {
  const data = people
    .slice(0, 10)
    .map((p) => ({
      name: p.name.split(' ')[0],
      Assigned: p.assigned,
      Booked: p.booked,
      Sat: p.sat,
      Sold: p.sold,
    }));

  return (
    <div className="panel flush">
      <h2 className="panel-title">Pipeline by Person</h2>
      {data.length === 0 ? (
        <div className="empty">No data for this timeframe.</div>
      ) : (
        <div style={{ width: '100%', height: 296 }}>
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 6, right: 8, left: -12, bottom: 0 }} barGap={2} barCategoryGap="22%">
              <CartesianGrid strokeDasharray="3 3" stroke="#eeefe9" vertical={false} />
              <XAxis dataKey="name" stroke="#9b9c95" fontSize={12} tickLine={false} axisLine={{ stroke: '#e7e6df' }} />
              <YAxis stroke="#9b9c95" fontSize={12} allowDecimals={false} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: 'rgba(106,178,79,0.06)' }}
                contentStyle={{ background: '#fff', border: '1px solid #e7e6df', borderRadius: 12, boxShadow: '0 6px 22px rgba(30,30,43,0.1)', fontSize: 12 }}
                labelStyle={{ color: '#1e1e2b', fontWeight: 600 }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
              <Bar dataKey="Assigned" fill="#5b6b8c" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Booked" fill="#6ab24f" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Sat" fill="#f9b834" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Sold" fill="#f98f33" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
