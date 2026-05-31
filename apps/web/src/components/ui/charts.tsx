'use client'
import React from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LineChart, Line,
} from 'recharts'

const formatINR = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)

const tooltipStyle = {
  background: '#fff',
  border: '1px solid #E2E8F0',
  borderRadius: '8px',
  fontSize: '12px',
  fontFamily: 'Inter, sans-serif',
  boxShadow: 'none',
}

const axisTickStyle = { fontSize: 12, fill: '#64748B', fontFamily: 'Inter, sans-serif' }

interface AgingChartProps {
  data: Array<{ bucket: string; amount: number; count: number }>
}

export function AgingChart({ data }: AgingChartProps) {
  const bucketColors = ['#10B981', '#F59E0B', '#EF4444', '#94A3B8']
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="#E2E8F0" strokeDasharray="3 3" />
        <XAxis dataKey="bucket" tick={axisTickStyle} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => formatINR(value)} />
        <Bar dataKey="amount" maxBarSize={40} radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={bucketColors[i] ?? '#4F46E5'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

interface TrendChartProps {
  data: Array<{ period: string; collected: number; billed: number }>
  height?: number
}

export function CollectionsTrendChart({ data, height = 180 }: TrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="#E2E8F0" strokeDasharray="3 3" />
        <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'Inter, sans-serif' }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatINR(v)} />
        <Line type="monotone" dataKey="collected" stroke="#10B981" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="billed" stroke="#4F46E5" strokeWidth={2} dot={false} strokeDasharray="4 4" />
      </LineChart>
    </ResponsiveContainer>
  )
}
