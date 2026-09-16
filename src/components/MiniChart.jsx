import React from 'react';
import { ResponsiveContainer, LineChart, Line } from 'recharts';

export default function MiniChart({ series = [], positive = true, height = 40, width = 90 }) {
  const color = positive ? 'var(--color-positive)' : 'var(--color-negative)';
  if (!series.length) return <div style={{ width, height }} />;
  return (
    <ResponsiveContainer width={width} height={height}>
      <LineChart data={series}>
        <Line type="monotone" dataKey="price" stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
