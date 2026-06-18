import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { chartColors } from '../chartTheme.js';

// Funnel bar chart: Assigned / Booked / Sat / Sold per person.
export default function RepChart({ people, dark }) {
  const c = chartColors(dark);
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
              <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
              <XAxis dataKey="name" stroke={c.axis} fontSize={12} tickLine={false} axisLine={{ stroke: c.grid }} />
              <YAxis stroke={c.axis} fontSize={12} allowDecimals={false} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: 'rgba(106,178,79,0.08)' }}
                contentStyle={{ background: c.tipBg, border: `1px solid ${c.tipBorder}`, borderRadius: 12, boxShadow: '0 6px 22px rgba(0,0,0,0.18)', fontSize: 12 }}
                labelStyle={{ color: c.tipText, fontWeight: 600 }}
                itemStyle={{ color: c.tipText }}
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
