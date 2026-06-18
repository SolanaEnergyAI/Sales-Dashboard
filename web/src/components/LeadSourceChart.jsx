import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { chartColors } from '../chartTheme.js';

const COLORS = ['#6ab24f', '#f9b834', '#f98f33', '#2bb7a3', '#5b6b8c', '#b07cd6', '#e5736b', '#9bbf3f'];
const money = (n) => '$' + Math.round(n || 0).toLocaleString('en-AU');

export default function LeadSourceChart({ sources, dark }) {
  const c = chartColors(dark);
  const data = (sources || []).filter((s) => s.revenue > 0).map((s) => ({ name: s.source, value: s.revenue }));

  return (
    <div className="panel flush">
      <h2 className="panel-title">Revenue by Lead Source</h2>
      {data.length === 0 ? (
        <div className="empty">No revenue in this timeframe.</div>
      ) : (
        <div style={{ width: '100%', height: 296 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={92}
                paddingAngle={2}
                stroke="none"
              >
                {data.map((entry, i) => (
                  <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v) => money(v)}
                contentStyle={{ background: c.tipBg, border: `1px solid ${c.tipBorder}`, borderRadius: 12, boxShadow: '0 6px 22px rgba(0,0,0,0.18)', fontSize: 12 }}
                itemStyle={{ color: c.tipText }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
