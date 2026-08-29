import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import type { ChartData } from '../../types';
import Spinner from './Spinner';

interface ChartProps {
  chartData: ChartData | null;
  isLoading?: boolean;
}

type ChartType = 'bar' | 'line';
type DateRange = '7D' | '30D' | '90D' | 'ALL';

const ToggleButton: React.FC<{ label: string; isActive: boolean; onClick: () => void; }> = ({ label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all ${
      isActive
        ? 'bg-gradient-to-r from-soft-deep to-soft-azure text-white shadow-aqua'
        : 'text-ink-muted hover:text-ink hover:bg-white/90 hover:shadow-sm'
    }`}
  >
    {label}
  </button>
);

const Chart: React.FC<ChartProps> = ({ chartData, isLoading = false }) => {
  const [chartType, setChartType] = useState<ChartType>('line');
  const [dateRange, setDateRange] = useState<DateRange>('ALL');

  const filteredData = useMemo(() => {
    const data = chartData?.data || [];
    if (dateRange === 'ALL' || !data.length) {
      return data;
    }
    const sliceCount = { '7D': 7, '30D': 30, '90D': 90 }[dateRange];
    return data.slice(-sliceCount);
  }, [chartData, dateRange]);

  const tickColor = '#6A8F93';
  const gridColor = '#D4EDEF';

  const tickFormatter = (dateStr: string) => {
    if (isNaN(Date.parse(dateStr))) {
      return dateStr;
    }
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const interval = useMemo(() => {
    if (filteredData.length > 60) return Math.floor(filteredData.length / 10);
    if (filteredData.length > 30) return 5;
    if (filteredData.length > 14) return 1;
    return 0;
  }, [filteredData]);

  if (isLoading) {
    return (
      <div className="w-full h-80 flex flex-col items-center justify-center text-ink-muted">
        <Spinner />
        <p className="mt-2 text-sm font-medium">Loading chart…</p>
      </div>
    );
  }

  if (!chartData || !chartData.data || chartData.data.length === 0) {
    return <div className="w-full h-80 flex items-center justify-center text-ink-muted text-sm">No data available to display chart.</div>;
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gradient-to-r from-soft-deep to-soft-azure text-white px-3 py-2 rounded-full shadow-aqua text-xs font-semibold">
          <span className="opacity-70 mr-2">{tickFormatter(label)}</span>
          {payload[0].value.toLocaleString()}
        </div>
      );
    }
    return null;
  };

  const commonXAxisProps = {
    dataKey: 'name' as const,
    tick: { fill: tickColor, fontSize: 11 },
    angle: -35,
    textAnchor: 'end' as const,
    height: 60,
    interval: interval,
    tickFormatter: tickFormatter,
    axisLine: false,
    tickLine: false,
  };

  const commonYAxisProps = {
    tick: { fill: tickColor, fontSize: 11 },
    tickFormatter: (value: number) => value.toLocaleString(),
    axisLine: false,
    tickLine: false,
  };

  const renderChart = () => {
    if (chartType === 'bar') {
      return (
        <BarChart data={filteredData} margin={{ top: 5, right: 20, left: -10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="4 4" stroke={gridColor} vertical={false} />
          <XAxis {...commonXAxisProps} />
          <YAxis {...commonYAxisProps} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(13, 155, 166, 0.08)' }} />
          <Bar dataKey="value" fill="#0D9BA6" radius={[10, 10, 10, 10]} barSize={28} />
        </BarChart>
      );
    }
    return (
      <AreaChart data={filteredData} margin={{ top: 5, right: 20, left: -10, bottom: 20 }}>
        <defs>
          <linearGradient id="nexoraArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2BB8C0" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#2BB8C0" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" stroke={gridColor} vertical={false} />
        <XAxis {...commonXAxisProps} />
        <YAxis {...commonYAxisProps} />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#0D9BA6', strokeWidth: 1 }} />
        <Area type="monotone" dataKey="value" stroke="#0A6B73" strokeWidth={2.5} fill="url(#nexoraArea)" activeDot={{ r: 6, fill: '#0A6B73', stroke: '#fff', strokeWidth: 2 }} />
      </AreaChart>
    );
  };

  return (
    <div className="w-full h-full min-h-[320px] flex flex-col">
      <div className="flex justify-between items-center mb-4 gap-4 flex-wrap">
        <h3 className="text-lg font-bold text-ink">{chartData.title}</h3>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="inline-flex bg-soft-bg p-1 rounded-full">
            {(['7D', '30D', '90D', 'ALL'] as DateRange[]).map(range => (
              <ToggleButton key={range} label={range} isActive={dateRange === range} onClick={() => setDateRange(range)} />
            ))}
          </div>
          <div className="inline-flex bg-soft-bg p-1 rounded-full">
            <ToggleButton label="Line" isActive={chartType === 'line'} onClick={() => setChartType('line')} />
            <ToggleButton label="Bar" isActive={chartType === 'bar'} onClick={() => setChartType('bar')} />
          </div>
        </div>
      </div>
      <div className="flex-grow">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default Chart;
