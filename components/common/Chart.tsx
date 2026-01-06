import React, { useState, useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { ChartData } from '../../types';
import Spinner from './Spinner';
import { useTheme } from '../../contexts/ThemeContext';

interface ChartProps {
  chartData: ChartData | null;
  isLoading?: boolean;
}

type ChartType = 'bar' | 'line';
type DateRange = '7D' | '30D' | '90D' | 'ALL';

// Helper component for toggle buttons
const ToggleButton: React.FC<{ label: string; isActive: boolean; onClick: () => void; }> = ({ label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
      isActive
        ? 'bg-brand-blue text-white shadow'
        : 'bg-slate-200 dark:bg-slate-700/50 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
    }`}
  >
    {label}
  </button>
);

const Chart: React.FC<ChartProps> = ({ chartData, isLoading = false }) => {
  const { theme } = useTheme();
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

  const tickColor = theme === 'light' ? '#475569' : '#9ca3af';
  const gridColor = theme === 'light' ? '#e2e8f0' : '#374151';

  const tickFormatter = (dateStr: string) => {
    // Check if it's a valid date string to avoid errors with categorical data
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
        <div className="w-full h-80 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
            <Spinner />
            <p className="mt-2 text-sm">Loading Chart...</p>
        </div>
    );
  }

  if (!chartData || !chartData.data || chartData.data.length === 0) {
    return <div className="w-full h-80 flex items-center justify-center text-slate-500 dark:text-slate-500 text-sm">No data available to display chart.</div>;
  }
  
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm p-2 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg">
          <p className="label text-slate-900 dark:text-white font-bold">{tickFormatter(label)}</p>
          <p className="intro text-brand-blue">{`Value : ${payload[0].value.toLocaleString()}`}</p>
        </div>
      );
    }
    return null;
  };

  const commonXAxisProps = {
    dataKey: "name" as const,
    tick: { fill: tickColor, fontSize: 12 },
    angle: -35,
    textAnchor: "end" as const,
    height: 60,
    interval: interval,
    tickFormatter: tickFormatter,
  };

  const commonYAxisProps = {
      tick: { fill: tickColor, fontSize: 12 },
      tickFormatter: (value: number) => value.toLocaleString(),
  };

  const renderChart = () => {
    if (chartType === 'bar') {
        return (
            <BarChart
                data={filteredData}
                margin={{ top: 5, right: 20, left: -10, bottom: 20 }}
            >
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis {...commonXAxisProps} />
                <YAxis {...commonYAxisProps} />
                <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(0, 191, 255, 0.1)'}} />
                <Bar dataKey="value" fill="#00BFFF" barSize={30} />
            </BarChart>
        );
    }
    return (
        <LineChart
            data={filteredData}
            margin={{ top: 5, right: 20, left: -10, bottom: 20 }}
        >
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis {...commonXAxisProps} />
            <YAxis {...commonYAxisProps} />
            <Tooltip content={<CustomTooltip />} cursor={{stroke: 'rgba(0, 191, 255, 0.5)', strokeWidth: 1}} />
            <Line type="monotone" dataKey="value" stroke="#00BFFF" strokeWidth={2} dot={false} activeDot={{ r: 6, stroke: theme === 'light' ? '#ffffff' : '#111111', strokeWidth: 2 }} />
        </LineChart>
    );
  };

  return (
    <div className="w-full h-full min-h-[320px] flex flex-col">
        <div className="flex justify-between items-center mb-4 gap-4 flex-wrap">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{chartData.title}</h3>
          <div className="flex items-center gap-4">
            <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                {(['7D', '30D', '90D', 'ALL'] as DateRange[]).map(range => (
                <ToggleButton key={range} label={range} isActive={dateRange === range} onClick={() => setDateRange(range)} />
                ))}
            </div>
            <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
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