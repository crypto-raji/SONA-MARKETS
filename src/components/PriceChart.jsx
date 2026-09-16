import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

export default function PriceChart({ series = [], positive = true, height = 260, showAxes = true }) {
  const color = positive ? 'var(--color-positive)' : 'var(--color-negative)';
  const gradientId = `chartGradient-${positive ? 'up' : 'down'}`;

  if (!series.length) {
    return <div style={{ height }} className="skeleton" />;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {showAxes && (
          <XAxis dataKey="t" hide />
        )}
        {showAxes && <YAxis domain={['auto', 'auto']} hide />}
        <Tooltip
          contentStyle={{
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            fontSize: 12,
          }}
          labelFormatter={() => ''}
          formatter={(value) => [`$${value}`, 'Price']}
        />
        <Area type="monotone" dataKey="price" stroke={color} strokeWidth={2} fill={`url(#${gradientId})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
