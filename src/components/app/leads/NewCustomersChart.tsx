import React, { useState } from 'react';
import { Activity } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';

interface DayData {
  day: string;
  website: number;
  ads: number;
  referral: number;
  total: number;
  x: number;
}

const DAYS_DATA: DayData[] = [
  { day: 'Mon', website: 4, ads: 5, referral: 3, total: 12, x: 50 },
  { day: 'Tue', website: 4, ads: 6, referral: 4, total: 14, x: 116 },
  { day: 'Wed', website: 3, ads: 5, referral: 3, total: 11, x: 183 },
  { day: 'Thu', website: 6, ads: 13, referral: 4, total: 23, x: 250 },
  { day: 'Fri', website: 4, ads: 8, referral: 3, total: 15, x: 316 },
  { day: 'Sat', website: 5, ads: 9, referral: 4, total: 18, x: 383 },
  { day: 'Sun', website: 4, ads: 11, referral: 5, total: 20, x: 450 },
];

interface NewCustomersChartProps {
  isActivityVisible?: boolean;
  onToggleActivity?: () => void;
}

export default function NewCustomersChart({
  isActivityVisible = false,
  onToggleActivity
}: NewCustomersChartProps = {}) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  // Default to Mon (index 0) matching user's reference screenshot
  const [activeDayIndex, setActiveDayIndex] = useState<number>(0);
  const [activeChannel, setActiveChannel] = useState<'all' | 'website' | 'ads' | 'referral'>('all');

  const adsStroke = isLight ? '#15803D' : '#4ADE80';
  const websiteStroke = isLight ? '#0284C7' : '#38BDF8';
  const referralStroke = isLight ? '#2563EB' : '#818CF8';
  const gridStroke = isLight ? '#E2E8F0' : 'rgba(148, 163, 184, 0.22)';
  const labelFill = isLight ? '#475569' : '#CBD5E1';
  const guidelineStroke = isLight ? '#94A3B8' : 'rgba(148, 163, 184, 0.45)';
  const dotStroke = isLight ? '#FFFFFF' : '#070B14';

  const activeData = DAYS_DATA[activeDayIndex] || DAYS_DATA[0];

  // SVG coordinate configuration (viewBox: 0 0 500 220)
  // Baseline (0 customers) at Y = 175, Top (15 customers) at Y = 35
  const baseY = 175;
  const topY = 35;
  const maxVal = 15;
  const getY = (val: number) => baseY - (Math.min(val, maxVal) / maxVal) * (baseY - topY);

  // Generate smooth line path using natural cubic beziers
  const makeLinePath = (points: { x: number; y: number }[]) => {
    if (points.length === 0) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cx1 = p0.x + (p1.x - p0.x) / 2;
      const cy1 = p0.y;
      const cx2 = p0.x + (p1.x - p0.x) / 2;
      const cy2 = p1.y;
      d += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p1.x} ${p1.y}`;
    }
    return d;
  };

  const makeAreaPath = (points: { x: number; y: number }[]) => {
    const line = makeLinePath(points);
    if (!line) return '';
    return `${line} L ${points[points.length - 1].x} ${baseY} L ${points[0].x} ${baseY} Z`;
  };

  const websitePoints = DAYS_DATA.map(d => ({ x: d.x, y: getY(d.website) }));
  const adsPoints = DAYS_DATA.map(d => ({ x: d.x, y: getY(d.ads) }));
  const referralPoints = DAYS_DATA.map(d => ({ x: d.x, y: getY(d.referral) }));

  const websitePath = makeLinePath(websitePoints);
  const adsPath = makeLinePath(adsPoints);
  const referralPath = makeLinePath(referralPoints);

  const websiteArea = makeAreaPath(websitePoints);
  const adsArea = makeAreaPath(adsPoints);
  const referralArea = makeAreaPath(referralPoints);

  const showWebsite = activeChannel === 'all' || activeChannel === 'website';
  const showAds = activeChannel === 'all' || activeChannel === 'ads';
  const showReferral = activeChannel === 'all' || activeChannel === 'referral';

  return (
    <div className="border border-[rgba(169,191,165,0.2)] bg-[#071C1A] p-5 flex flex-col justify-between h-full relative overflow-hidden group">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        <div className="flex items-center space-x-3">
          <h3 className="serif text-xl sm:text-2xl font-light text-[#E8E9D8] tracking-tight">
            New customers
          </h3>
          {onToggleActivity && (
            <button
              type="button"
              onClick={onToggleActivity}
              className={`text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-[2px] border transition-colors cursor-pointer flex items-center space-x-1.5 ${
                isActivityVisible
                  ? 'border-[#A9BFA5] text-[#E8E9D8] bg-[#072421]'
                  : 'border-[rgba(169,191,165,0.2)] text-[#A9BFA5]/70 hover:text-[#E8E9D8] hover:border-[rgba(169,191,165,0.4)]'
              }`}
            >
              <Activity className="w-3 h-3 text-[#A9BFA5]" />
              <span>{isActivityVisible ? 'Hide Activity Graph' : 'Show Activity Graph'}</span>
            </button>
          )}
        </div>

        {/* Legend with interactive channel filters */}
        <div className="flex items-center space-x-3 text-[10px] font-mono text-[#A9BFA5]/80 select-none">
          <button
            type="button"
            onClick={() => setActiveChannel(activeChannel === 'website' ? 'all' : 'website')}
            className={`flex items-center space-x-1.5 cursor-pointer transition-opacity ${
              showWebsite ? 'opacity-100 font-medium text-[#E8E9D8]' : 'opacity-35'
            }`}
            title="Filter by Website"
          >
            <span className="w-2 h-2 rounded-full bg-[#38BDF8]" />
            <span>Website</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveChannel(activeChannel === 'ads' ? 'all' : 'ads')}
            className={`flex items-center space-x-1.5 cursor-pointer transition-opacity ${
              showAds ? 'opacity-100 font-medium text-[#E8E9D8]' : 'opacity-35'
            }`}
            title="Filter by Ads"
          >
            <span className={`w-2 h-2 rounded-full ${isLight ? 'bg-[#1B6350]' : 'bg-[#A9BFA5]'}`} />
            <span>Ads</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveChannel(activeChannel === 'referral' ? 'all' : 'referral')}
            className={`flex items-center space-x-1.5 cursor-pointer transition-opacity ${
              showReferral ? 'opacity-100 font-medium text-[#E8E9D8]' : 'opacity-35'
            }`}
            title="Filter by Referral"
          >
            <span className="w-2 h-2 rounded-full bg-[#3B82F6]" />
            <span>Referral</span>
          </button>
        </div>
      </div>

      {/* Clean Line Graph Canvas */}
      <div className="relative w-full h-[210px]">
        <svg
          viewBox="0 0 500 220"
          className="w-full h-full overflow-visible select-none"
        >
          <defs>
            {/* Subtle under-line gradient fills */}
            <linearGradient id="websiteLineGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity={isLight ? "0.25" : "0.18"} />
              <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="adsLineGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={adsStroke} stopOpacity={isLight ? "0.25" : "0.18"} />
              <stop offset="100%" stopColor={adsStroke} stopOpacity="0" />
            </linearGradient>
            <linearGradient id="referralLineGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity={isLight ? "0.25" : "0.18"} />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Y Axis Grid lines & Ticks (0, 5, 10, 15) */}
          {[15, 10, 5, 0].map(val => {
            const y = getY(val);
            return (
              <g key={val}>
                <line
                  x1="35"
                  y1={y}
                  x2="480"
                  y2={y}
                  stroke={gridStroke}
                  strokeDasharray={val === 0 ? undefined : '3 3'}
                />
                <text
                  x="26"
                  y={y + 4}
                  fill={labelFill}
                  fontSize="10"
                  fontFamily="monospace"
                  textAnchor="end"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Subtle under-line gradient washes */}
          {showReferral && <path d={referralArea} fill="url(#referralLineGrad)" />}
          {showAds && <path d={adsArea} fill="url(#adsLineGrad)" />}
          {showWebsite && <path d={websiteArea} fill="url(#websiteLineGrad)" />}

          {/* Clean Primary Line Graphs */}
          {showReferral && (
            <path
              d={referralPath}
              fill="none"
              stroke="#3B82F6"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {showAds && (
            <path
              d={adsPath}
              fill="none"
              stroke={adsStroke}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {showWebsite && (
            <path
              d={websitePath}
              fill="none"
              stroke="#0284C7"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Vertical Guideline at Active Day */}
          <line
            x1={activeData.x}
            y1={topY}
            x2={activeData.x}
            y2={baseY}
            stroke={guidelineStroke}
            strokeDasharray="3 3"
            strokeWidth="1.5"
          />

          {/* Active Data Points on each Line */}
          {showWebsite && (
            <circle
              cx={activeData.x}
              cy={getY(activeData.website)}
              r="4.5"
              fill="#0284C7"
              stroke={dotStroke}
              strokeWidth="2"
            />
          )}
          {showAds && (
            <circle
              cx={activeData.x}
              cy={getY(activeData.ads)}
              r="4.5"
              fill={adsStroke}
              stroke={dotStroke}
              strokeWidth="2"
            />
          )}
          {showReferral && (
            <circle
              cx={activeData.x}
              cy={getY(activeData.referral)}
              r="4.5"
              fill="#3B82F6"
              stroke={dotStroke}
              strokeWidth="2"
            />
          )}

          {/* X Axis Day Columns & Labels */}
          {DAYS_DATA.map((d, idx) => {
            const isSelected = activeDayIndex === idx;
            return (
              <g
                key={d.day}
                className="cursor-pointer"
                onMouseEnter={() => setActiveDayIndex(idx)}
                onClick={() => setActiveDayIndex(idx)}
              >
                {/* Touch/hover target box */}
                <rect
                  x={d.x - 28}
                  y={topY}
                  width={56}
                  height={baseY - topY + 30}
                  fill="transparent"
                />
                <text
                  x={d.x}
                  y={baseY + 22}
                  fill={isSelected ? (isLight ? '#0F172A' : '#F8FAFC') : labelFill}
                  fontSize="11"
                  fontWeight={isSelected ? '600' : '500'}
                  fontFamily="sans-serif"
                  textAnchor="middle"
                >
                  {d.day}
                </text>
                {isSelected && (
                  <circle
                    cx={d.x}
                    cy={baseY + 30}
                    r="1.5"
                    fill={isLight ? '#0F172A' : '#F8FAFC'}
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip Card */}
        <div
          className="absolute z-20 pointer-events-none transition-all duration-150"
          style={{
            left: activeDayIndex <= 1
              ? `${(activeData.x / 500) * 100 + 4}%`
              : activeDayIndex >= 5
              ? `${(activeData.x / 500) * 100 - 28}%`
              : `${(activeData.x / 500) * 100}%`,
            top: '20px',
            transform: activeDayIndex > 1 && activeDayIndex < 5 ? 'translateX(-50%)' : 'none'
          }}
        >
          <div className="bg-[var(--surface-elevated)] border border-[var(--border-strong)] shadow-2xl px-3 py-2 rounded-[2px] text-[11px] font-mono space-y-1 min-w-[110px]">
            <div className="flex items-center space-x-2 text-[var(--text-primary)]">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: websiteStroke }} />
              <span className="text-[var(--text-secondary)]">Website -</span>
              <span className="font-semibold text-[var(--text-primary)]">{activeData.website}</span>
            </div>
            <div className="flex items-center space-x-2 text-[var(--text-primary)]">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: adsStroke }} />
              <span className="text-[var(--text-secondary)]">Ads -</span>
              <span className="font-semibold text-[var(--text-primary)]">{activeData.ads}</span>
            </div>
            <div className="flex items-center space-x-2 text-[var(--text-primary)]">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: referralStroke }} />
              <span className="text-[var(--text-secondary)]">Referral -</span>
              <span className="font-semibold text-[var(--text-primary)]">{activeData.referral}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
