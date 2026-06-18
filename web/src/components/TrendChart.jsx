import React from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { chartColors } from '../chartTheme.js';

const money = (n) => '$' + Math.round(n || 0).toLocaleString('en-AU');

// Sold count (bars) + revenue (line) over the last 6 months.
export default function TrendChart({ trend, dark }) {
  const data = trend || [];
  const c = chartColors(dark);
  return (
    <div className="panel">
      <h2 className="panel-title">6-Month Trend — Sold &amp; Revenue</h2>
      {data.length === 0 ? (
        <div className="empty">No trend data.</div>
      ) : (
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
              <XAxis dataKey="label" stroke={c.axis} fontSize={12} tickLine={false} axisLine={{ stroke: c.grid }} />
              <YAxis yAxisId="left" stroke={c.axis} fontSize={12} allowDecimals={false} tickLine={false} axisLine={false} />
              <YAxis
                yAxisId="right" orientation="right" stroke={c.axis} fontSize={11}
                tickLine={false} axisLine={false}
                tickFormatter={(v) => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`)}
              />
              <Tooltip
                cursor={{ fill: 'rgba(106,178,79,0.08)' }}
                formatter={(v, n) => (n === 'Revenue' ? money(v) : v)}
                contentStyle={{ background: c.tipBg, border: `1px solid ${c.tipBorder}`, borderRadius: 12, boxShadow: '0 6px 22px rgba(0,0,0,0.18)', fontSize: 12 }}
                labelStyle={{ color: c.tipText, fontWeight: 600 }}
                itemStyle={{ color: c.tipText }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
              <Bar yAxisId="left" dataKey="sold" name="Sold" fill="#f98f33" radius={[4, 4, 0, 0]} barSize={34} />
              <Line yAxisId="right" type="monotone" dataKey="revenue" name="Revenue" stroke="#2bb7a3" strokeWidth={3} dot={{ r: 4, fill: '#2bb7a3' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
