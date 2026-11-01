import React, { useState, useMemo, useEffect } from 'react';
import { 
  ArrowUpRight, 
  TrendingUp, 
  ChevronRight,
  Filter,
  BarChart2,
  Calendar,
  X,
  Check,
  RotateCcw,
  SlidersHorizontal
} from 'lucide-react';
import Pagination from './Pagination';
import DateRangeCalendarModal, { DateRangeSelection, SortBasis } from './DateRangeCalendarModal';

type TimeRange = '7D' | '30D' | '90D' | '1Y';
type LeadGrowthRange = TimeRange | 'CUSTOM';
type CampaignMetric = 'Conversions' | 'Leads' | 'Engagement';
type SocialMetric = 'Engagement' | 'Reach' | 'Clicks';
type SocialPlatform = 'All' | 'Instagram' | 'LinkedIn' | 'X' | 'Facebook';

export default function StatsView() {
  // Global Time Range Filter
  const [timeRange, setTimeRange] = useState<TimeRange>('30D');

  // Lead Growth Specific Time Range & Custom Date Filters
  const [leadRangeMode, setLeadRangeMode] = useState<LeadGrowthRange>('30D');
  const [isCustomPickerOpen, setIsCustomPickerOpen] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [growthSortBasis, setGrowthSortBasis] = useState<SortBasis>('newest');
  const [customStartDate, setCustomStartDate] = useState('2026-08-10');
  const [customEndDate, setCustomEndDate] = useState('2026-09-08');
  const [pendingStartDate, setPendingStartDate] = useState('2026-08-10');
  const [pendingEndDate, setPendingEndDate] = useState('2026-09-08');

  // Campaign Performance Switcher & Filters
  const [campaignMetric, setCampaignMetric] = useState<CampaignMetric>('Conversions');
  const [campaignTimelineFilter, setCampaignTimelineFilter] = useState<'All' | 'Active' | 'Upcoming' | 'Concluded'>('All');
  const [campaignProgressFilter, setCampaignProgressFilter] = useState<'All' | 'High' | 'InFlight' | 'Early'>('All');
  const [campaignPage, setCampaignPage] = useState<number>(1);
  const campaignPageSize = 4;

  useEffect(() => {
    setCampaignPage(1);
  }, [campaignTimelineFilter, campaignProgressFilter, campaignMetric]);

  // Social Engagement Switchers
  const [socialMetric, setSocialMetric] = useState<SocialMetric>('Engagement');
  const [socialPlatform, setSocialPlatform] = useState<SocialPlatform>('All');

  // Hover states for interactive tooltips
  const [leadHoverIndex, setLeadHoverIndex] = useState<number | null>(null);
  const [socialHoverIndex, setSocialHoverIndex] = useState<number | null>(null);
  const [hoveredSource, setHoveredSource] = useState<string | null>(null);
  const [hoveredCampaign, setHoveredCampaign] = useState<string | null>(null);

  // Sync lead range if global timeRange changes and user hasn't explicitly activated custom dates
  const handleGlobalTimeRangeChange = (period: TimeRange) => {
    setTimeRange(period);
    if (leadRangeMode !== 'CUSTOM') {
      setLeadRangeMode(period);
    }
  };

  /* --------------------------------------------------------------------------
     01. LEAD GROWTH DATA (Dynamic based on leadRangeMode and custom dates)
     -------------------------------------------------------------------------- */
  const leadGrowthData = useMemo(() => {
    if (leadRangeMode === 'CUSTOM') {
      const start = new Date(pendingStartDate || customStartDate);
      const end = new Date(pendingEndDate || customEndDate);
      
      let validStart = isNaN(start.getTime()) ? new Date('2026-08-10') : start;
      let validEnd = isNaN(end.getTime()) ? new Date('2026-09-08') : end;
      if (validStart > validEnd) {
        const temp = validStart;
        validStart = validEnd;
        validEnd = temp;
      }

      const diffTime = Math.abs(validEnd.getTime() - validStart.getTime());
      const diffDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)));

      // Adaptive step size based on span length
      let stepDays = 1;
      if (diffDays <= 8) stepDays = 1;
      else if (diffDays <= 16) stepDays = 2;
      else if (diffDays <= 35) stepDays = 3;
      else if (diffDays <= 70) stepDays = 5;
      else if (diffDays <= 150) stepDays = 10;
      else if (diffDays <= 365) stepDays = 21;
      else stepDays = 30;

      const points: { label: string; date: string; count: number }[] = [];
      const current = new Date(validStart);
      let stepIdx = 0;

      while (current <= validEnd) {
        const monthName = current.toLocaleString('en-US', { month: 'short' });
        const day = current.getDate();
        const year = current.getFullYear();
        const label = `${monthName} ${day < 10 ? '0' + day : day}`;
        const fullDate = `${label}, ${year}`;

        const progress = diffDays > 1 ? (current.getTime() - validStart.getTime()) / diffTime : 0.5;
        const baseCount = 14 + Math.round(progress * 42);
        const seed = (current.getDate() * 7 + current.getMonth() * 11 + stepIdx * 5) % 17;
        const variation = seed - 8;
        const count = Math.max(8, baseCount + variation);

        points.push({ label, date: fullDate, count });
        current.setDate(current.getDate() + stepDays);
        stepIdx++;
      }

      // Ensure last date is clearly pinned if gap exists
      const lastPoint = points[points.length - 1];
      const endMonth = validEnd.toLocaleString('en-US', { month: 'short' });
      const endDay = validEnd.getDate();
      const endLabel = `${endMonth} ${endDay < 10 ? '0' + endDay : endDay}`;
      if (!lastPoint || lastPoint.label !== endLabel) {
        const fullDate = `${endLabel}, ${validEnd.getFullYear()}`;
        const count = Math.max(16, Math.round(54 + ((validEnd.getDate() * 3) % 12)));
        points.push({ label: endLabel, date: fullDate, count });
      }

      const totalCount = points.reduce((acc, p) => acc + p.count, 0);
      const avgCount = Math.round(totalCount / points.length);
      const peak = points.reduce((max, p) => p.count > max.count ? p : max, points[0]);

      // Growth rate calculation
      const firstSlice = points.slice(0, Math.max(1, Math.min(3, Math.floor(points.length / 2))));
      const lastSlice = points.slice(-Math.max(1, Math.min(3, Math.floor(points.length / 2))));
      const firstAvg = firstSlice.reduce((a, b) => a + b.count, 0) / firstSlice.length;
      const lastAvg = lastSlice.reduce((a, b) => a + b.count, 0) / lastSlice.length;
      const growthRate = Math.round(((lastAvg - firstAvg) / Math.max(1, firstAvg)) * 100);
      const sign = growthRate >= 0 ? '+' : '';

      return {
        stat: `${sign}${growthRate}%`,
        comparison: `vs preceding ${diffDays} days`,
        points,
        totalCount,
        avgCount,
        peak,
        diffDays,
        formattedRange: `${validStart.toLocaleString('en-US', { month: 'short', day: 'numeric' })} – ${validEnd.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        isCustom: true
      };
    }

    switch (leadRangeMode) {
      case '7D': {
        const points = [
          { label: 'Mon', date: 'Oct 09', count: 12 },
          { label: 'Tue', date: 'Oct 10', count: 19 },
          { label: 'Wed', date: 'Oct 11', count: 16 },
          { label: 'Thu', date: 'Oct 12', count: 28 },
          { label: 'Fri', date: 'Oct 13', count: 34 },
          { label: 'Sat', date: 'Oct 14', count: 22 },
          { label: 'Sun', date: 'Oct 15', count: 39 }
        ];
        return {
          stat: '+18%',
          comparison: 'vs previous 7 days',
          points,
          totalCount: 170,
          avgCount: 24,
          peak: { label: 'Sun', date: 'Oct 15', count: 39 },
          diffDays: 7,
          formattedRange: 'Oct 09 – Oct 15, 2026',
          isCustom: false
        };
      }
      case '90D': {
        const points = [
          { label: 'Aug W1', date: 'Aug 01-07', count: 45 },
          { label: 'Aug W3', date: 'Aug 15-21', count: 68 },
          { label: 'Sep W1', date: 'Sep 01-07', count: 82 },
          { label: 'Sep W3', date: 'Sep 15-21', count: 110 },
          { label: 'Oct W1', date: 'Oct 01-07', count: 142 },
          { label: 'Oct W3', date: 'Oct 15-21', count: 186 }
        ];
        return {
          stat: '+41%',
          comparison: 'vs previous quarter',
          points,
          totalCount: 633,
          avgCount: 105,
          peak: { label: 'Oct W3', date: 'Oct 15-21', count: 186 },
          diffDays: 90,
          formattedRange: 'Aug 01 – Oct 31, 2026',
          isCustom: false
        };
      }
      case '1Y': {
        const points = [
          { label: 'Q1', date: 'Jan - Mar', count: 180 },
          { label: 'Q2', date: 'Apr - Jun', count: 320 },
          { label: 'Q3', date: 'Jul - Sep', count: 540 },
          { label: 'Q4', date: 'Oct - Dec', count: 890 }
        ];
        return {
          stat: '+128%',
          comparison: 'vs previous year',
          points,
          totalCount: 1930,
          avgCount: 482,
          peak: { label: 'Q4', date: 'Oct - Dec', count: 890 },
          diffDays: 365,
          formattedRange: 'Jan 01 – Dec 31, 2026',
          isCustom: false
        };
      }
      case '30D':
      default: {
        const points = [
          { label: 'Sep 16', date: 'Sep 16', count: 14 },
          { label: 'Sep 20', date: 'Sep 20', count: 22 },
          { label: 'Sep 24', date: 'Sep 24', count: 18 },
          { label: 'Sep 28', date: 'Sep 28', count: 31 },
          { label: 'Oct 02', date: 'Oct 02', count: 27 },
          { label: 'Oct 06', date: 'Oct 06', count: 42 },
          { label: 'Oct 10', date: 'Oct 10', count: 38 },
          { label: 'Oct 14', date: 'Oct 14', count: 54 },
          { label: 'Oct 18', date: 'Oct 18', count: 48 },
          { label: 'Oct 22', date: 'Oct 22', count: 62 },
          { label: 'Oct 26', date: 'Oct 26', count: 59 },
          { label: 'Oct 30', date: 'Oct 30', count: 71 }
        ];
        return {
          stat: '+24%',
          comparison: 'vs previous period',
          points,
          totalCount: 486,
          avgCount: 40,
          peak: { label: 'Oct 30', date: 'Oct 30', count: 71 },
          diffDays: 30,
          formattedRange: 'Sep 16 – Oct 30, 2026',
          isCustom: false
        };
      }
    }
  }, [leadRangeMode, customStartDate, customEndDate, pendingStartDate, pendingEndDate]);

  /* --------------------------------------------------------------------------
     02. LEAD SOURCES DATA
     Categories: Instagram, LinkedIn, Website, Email, Referral, Campaigns
     -------------------------------------------------------------------------- */
  const leadSourcesData = useMemo(() => {
    // Multipliers based on time range
    const mult = timeRange === '7D' ? 0.3 : timeRange === '30D' ? 1 : timeRange === '90D' ? 2.8 : 8.5;
    
    return [
      { name: 'LinkedIn', count: Math.round(184 * mult), share: '36%', change: '+14%' },
      { name: 'Website', count: Math.round(128 * mult), share: '25%', change: '+9%' },
      { name: 'Instagram', count: Math.round(82 * mult), share: '16%', change: '+22%' },
      { name: 'Referral', count: Math.round(54 * mult), share: '11%', change: '+31%' },
      { name: 'Campaigns', count: Math.round(38 * mult), share: '7%', change: '+5%' },
      { name: 'Email', count: Math.round(26 * mult), share: '5%', change: '+12%' }
    ];
  }, [timeRange]);

  const maxSourceCount = Math.max(...leadSourcesData.map(s => s.count));

  /* --------------------------------------------------------------------------
     03. CAMPAIGN PERFORMANCE DATA
     Enriched with timeline & progress attributes for dual filtering.
     Metrics: Conversions | Leads | Engagement
     -------------------------------------------------------------------------- */
  const campaignData = useMemo(() => {
    const rawList = [
      {
        name: 'Summer Launch',
        dates: 'May 18 – Jul 15',
        timeline: 'Active' as const,
        progress: 72,
        metrics: {
          Conversions: { value: 68.4, display: '68.4%', raw: 68.4, benchmark: 'Avg 42%' },
          Leads: { value: 86, display: '86 leads', raw: 86, benchmark: 'High intent' },
          Engagement: { value: 14.8, display: '14.8K interactions', raw: 14.8, benchmark: 'Editorial reach' }
        }
      },
      {
        name: 'Lead Generation',
        dates: 'May 24 – Jul 30',
        timeline: 'Active' as const,
        progress: 54,
        metrics: {
          Conversions: { value: 64.2, display: '64.2%', raw: 64.2, benchmark: 'Avg 42%' },
          Leads: { value: 114, display: '114 leads', raw: 114, benchmark: 'Top performer' },
          Engagement: { value: 6.5, display: '6.5K interactions', raw: 6.5, benchmark: 'High conversion clicks' }
        }
      },
      {
        name: 'New Collection',
        dates: 'Jun 01 – Aug 15',
        timeline: 'Active' as const,
        progress: 30,
        metrics: {
          Conversions: { value: 52.0, display: '52.0%', raw: 52.0, benchmark: 'Avg 42%' },
          Leads: { value: 48, display: '48 leads', raw: 48, benchmark: 'Studio waitlist' },
          Engagement: { value: 9.6, display: '9.6K interactions', raw: 9.6, benchmark: 'Curator bookmarks' }
        }
      },
      {
        name: 'Product Drop',
        dates: 'Sep 15 – Oct 15',
        timeline: 'Upcoming' as const,
        progress: 10,
        metrics: {
          Conversions: { value: 48.8, display: '48.8%', raw: 48.8, benchmark: 'Avg 42%' },
          Leads: { value: 64, display: '64 leads', raw: 64, benchmark: 'Direct buyers' },
          Engagement: { value: 12.2, display: '12.2K interactions', raw: 12.2, benchmark: 'Direct shares' }
        }
      },
      {
        name: 'Brand Awareness',
        dates: 'Mar 01 – Apr 30',
        timeline: 'Concluded' as const,
        progress: 100,
        metrics: {
          Conversions: { value: 34.5, display: '34.5%', raw: 34.5, benchmark: 'Avg 42%' },
          Leads: { value: 35, display: '35 leads', raw: 35, benchmark: 'Top of funnel' },
          Engagement: { value: 18.4, display: '18.4K interactions', raw: 18.4, benchmark: '+34% viral coefficient' }
        }
      }
    ];

    let filtered = rawList;

    // Timeline Filter
    if (campaignTimelineFilter !== 'All') {
      filtered = filtered.filter(c => c.timeline === campaignTimelineFilter);
    }

    // Progress Filter
    if (campaignProgressFilter === 'High') {
      filtered = filtered.filter(c => c.progress >= 75);
    } else if (campaignProgressFilter === 'InFlight') {
      filtered = filtered.filter(c => c.progress >= 25 && c.progress < 75);
    } else if (campaignProgressFilter === 'Early') {
      filtered = filtered.filter(c => c.progress < 25);
    }

    return filtered.map(c => ({
      name: c.name,
      dates: c.dates,
      timeline: c.timeline,
      progress: c.progress,
      ...c.metrics[campaignMetric]
    }));
  }, [campaignMetric, campaignTimelineFilter, campaignProgressFilter]);

  const paginatedCampaignData = useMemo(() => {
    const start = (campaignPage - 1) * campaignPageSize;
    return campaignData.slice(start, start + campaignPageSize);
  }, [campaignData, campaignPage, campaignPageSize]);

  const maxCampaignVal = campaignData.length > 0 ? Math.max(...campaignData.map(c => c.value)) : 100;

  /* --------------------------------------------------------------------------
     04. SOCIAL ENGAGEMENT DATA
     Metrics: Engagement | Reach | Clicks
     Platforms: All | Instagram | LinkedIn | X | Facebook
     -------------------------------------------------------------------------- */
  const socialData = useMemo(() => {
    // Multipliers for platform & metric
    const platformFactor = 
      socialPlatform === 'All' ? 1 : 
      socialPlatform === 'LinkedIn' ? 0.45 : 
      socialPlatform === 'Instagram' ? 0.3 : 
      socialPlatform === 'X' ? 0.18 : 0.07;

    const metricFactor = 
      socialMetric === 'Engagement' ? 120 : 
      socialMetric === 'Reach' ? 850 : 45;

    const unit = socialMetric === 'Reach' ? '' : socialMetric === 'Clicks' ? ' clicks' : ' interactions';

    const points = [
      { label: 'Week 1', date: 'Oct 01 - 07', value: Math.round(18 * metricFactor * platformFactor) },
      { label: 'Week 2', date: 'Oct 08 - 14', value: Math.round(24 * metricFactor * platformFactor) },
      { label: 'Week 3', date: 'Oct 15 - 21', value: Math.round(21 * metricFactor * platformFactor) },
      { label: 'Week 4', date: 'Oct 22 - 28', value: Math.round(35 * metricFactor * platformFactor) },
      { label: 'Week 5', date: 'Oct 29 - Nov 04', value: Math.round(42 * metricFactor * platformFactor) },
      { label: 'Week 6', date: 'Nov 05 - 11', value: Math.round(38 * metricFactor * platformFactor) },
      { label: 'Week 7', date: 'Nov 12 - 18', value: Math.round(56 * metricFactor * platformFactor) }
    ];

    const currentTotal = points.reduce((acc, p) => acc + p.value, 0);
    const formattedTotal = socialMetric === 'Reach' 
      ? `${(currentTotal / 1000).toFixed(1)}K` 
      : currentTotal.toLocaleString();

    return {
      total: formattedTotal,
      unit,
      growth: '+32.4%',
      points
    };
  }, [socialMetric, socialPlatform]);

  return (
    <div className="space-y-20 py-4 max-w-5xl mx-auto animate-fadeIn text-[#E8E9D8]">
      {/* =====================================================================
          HEADER & TIME FILTER
          ===================================================================== */}
      <header className="border-b border-[rgba(169,191,165,0.2)] pb-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div>
            <h1 className="serif text-4xl sm:text-5xl lg:text-6xl font-light text-[#E8E9D8] tracking-tight">
              Stats
            </h1>
            <p className="mt-3 text-xs sm:text-sm text-[#A9BFA5]/80 font-light leading-relaxed">
              A clear view of how your workspace is performing.
            </p>
          </div>

          {/* Time filter: 7D 30D 90D 1Y */}
          <div className="flex items-center space-x-6 text-xs uppercase tracking-widest font-mono">
            {(['7D', '30D', '90D', '1Y'] as TimeRange[]).map((period) => {
              const isSelected = timeRange === period && leadRangeMode !== 'CUSTOM';
              return (
                <button
                  key={period}
                  type="button"
                  onClick={() => handleGlobalTimeRangeChange(period)}
                  className={`pb-1 transition-colors cursor-pointer border-b ${
                    isSelected
                      ? 'text-[#E8E9D8] border-[#A9BFA5] font-semibold'
                      : 'text-[#A9BFA5]/50 border-transparent hover:text-[#A9BFA5]'
                  }`}
                >
                  {period}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* =====================================================================
          01 — LEAD GROWTH (LARGE LINE GRAPH)
          ===================================================================== */}
      <section className="space-y-6">
        {/* Section Heading & Stat */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="text-[10px] sm:text-xs uppercase tracking-widest-plus text-[#A9BFA5] font-mono block mb-1">
              01 // LEAD GROWTH
            </span>
            <h2 className="serif text-2xl sm:text-3xl font-light text-[#E8E9D8]">
              Lead Growth
            </h2>
            <p className="mt-1 text-xs text-[#A9BFA5]/80 font-light">
              Track how your incoming leads are changing over time.
            </p>
          </div>

          {/* Metric Callout */}
          <div className="text-left md:text-right">
            <span className="serif text-3xl sm:text-4xl font-light text-[#E8E9D8] block">
              {leadGrowthData.stat}
            </span>
            <span className="text-[11px] font-mono text-[#A9BFA5]/70 block mt-0.5">
              {leadGrowthData.comparison}
            </span>
          </div>
        </div>

        {/* Lead Growth Filter Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 pb-1 text-xs font-mono border-t border-[rgba(169,191,165,0.12)]">
          {/* Preset Buttons & Custom Button */}
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-[#A9BFA5]/60 uppercase tracking-wider text-[10px] mr-1 hidden sm:inline">
              Range:
            </span>
            {(['7D', '30D', '90D', '1Y'] as TimeRange[]).map((period) => {
              const isSelected = leadRangeMode === period;
              return (
                <button
                  key={period}
                  type="button"
                  onClick={() => {
                    setLeadRangeMode(period);
                    setIsCustomPickerOpen(false);
                  }}
                  className={`px-2.5 py-1 text-xs transition-colors cursor-pointer border ${
                    isSelected
                      ? 'bg-[#A9BFA5]/15 text-[#E8E9D8] border-[#A9BFA5]'
                      : 'text-[#A9BFA5]/60 border-transparent hover:text-[#A9BFA5] hover:border-[rgba(169,191,165,0.2)]'
                  }`}
                >
                  {period}
                </button>
              );
            })}

            {/* Custom Date Filter Toggle */}
            <button
              type="button"
              id="stats-custom-dates-btn"
              onClick={() => setIsCalendarModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs transition-colors cursor-pointer border ${
                leadRangeMode === 'CUSTOM'
                  ? 'bg-[#A9BFA5]/20 text-[#E8E9D8] border-[#A9BFA5] font-medium'
                  : 'text-[#A9BFA5]/70 border-[rgba(169,191,165,0.25)] hover:text-[#E8E9D8] hover:border-[#A9BFA5]'
              }`}
              title="Click to decide start and end date on calendar and sort on that basis"
            >
              <Calendar className="w-3.5 h-3.5 text-[#A9BFA5]" />
              <span>Custom Dates 📅</span>
              {leadRangeMode === 'CUSTOM' && (
                <span className="ml-1 text-[10px] bg-[#071C1A] text-[#A9BFA5] px-1.5 py-0.2 border border-[rgba(169,191,165,0.3)]">
                  {customStartDate.slice(5)} → {customEndDate.slice(5)}
                </span>
              )}
            </button>
          </div>

          {/* Quick Metrics & Current Span Badge */}
          <div className="flex items-center gap-3 text-[11px] text-[#A9BFA5]/80">
            <span className="hidden lg:inline text-[#A9BFA5]/50">
              {leadGrowthData.formattedRange}
            </span>
            <span className="border-l border-[rgba(169,191,165,0.2)] pl-3 hidden sm:inline">
              Total: <strong className="text-[#E8E9D8] font-normal">{leadGrowthData.totalCount} leads</strong>
            </span>
            <span className="border-l border-[rgba(169,191,165,0.2)] pl-3 hidden md:inline">
              Peak: <strong className="text-[#E8E9D8] font-normal">{leadGrowthData.peak?.count}</strong> ({leadGrowthData.peak?.label})
            </span>
            {leadRangeMode === 'CUSTOM' && (
              <button
                type="button"
                onClick={() => {
                  setLeadRangeMode('30D');
                  setIsCustomPickerOpen(false);
                }}
                className="text-[10px] text-[#A9BFA5]/60 hover:text-[#E8E9D8] underline cursor-pointer ml-1"
                title="Reset to standard 30-day view"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Expandable Custom Date Picker Panel */}
        {isCustomPickerOpen && (
          <div className="p-4 sm:p-5 bg-[#061816] border border-[rgba(169,191,165,0.3)] rounded-[2px] space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-[rgba(169,191,165,0.15)]">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#A9BFA5]" />
                <span className="text-xs font-mono uppercase tracking-wider text-[#E8E9D8]">
                  Filter Lead Growth By Date Range
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomPickerOpen(false)}
                className="text-[#A9BFA5]/60 hover:text-[#E8E9D8] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Date Inputs and Quick Shortcuts */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Native Date Pickers */}
              <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-[#A9BFA5]/70 mb-1.5">
                    Start Date (From)
                  </label>
                  <input
                    type="date"
                    value={pendingStartDate}
                    onChange={(e) => setPendingStartDate(e.target.value)}
                    max={pendingEndDate}
                    className="w-full bg-[#071C1A] text-[#E8E9D8] border border-[rgba(169,191,165,0.3)] px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[#A9BFA5]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-[#A9BFA5]/70 mb-1.5">
                    End Date (To)
                  </label>
                  <input
                    type="date"
                    value={pendingEndDate}
                    onChange={(e) => setPendingEndDate(e.target.value)}
                    min={pendingStartDate}
                    className="w-full bg-[#071C1A] text-[#E8E9D8] border border-[rgba(169,191,165,0.3)] px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[#A9BFA5]"
                  />
                </div>
              </div>

              {/* Quick Preset Chips */}
              <div className="md:col-span-5">
                <label className="block text-[10px] font-mono uppercase tracking-wider text-[#A9BFA5]/70 mb-1.5">
                  Quick Ranges
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Past 7D', start: '2026-09-01', end: '2026-09-08' },
                    { label: 'Past 14D', start: '2026-08-25', end: '2026-09-08' },
                    { label: 'Past 30D', start: '2026-08-10', end: '2026-09-08' },
                    { label: 'This Month', start: '2026-09-01', end: '2026-09-08' },
                    { label: 'Last Month', start: '2026-08-01', end: '2026-08-31' },
                    { label: 'Q3 (Jul-Sep)', start: '2026-07-01', end: '2026-09-08' }
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setPendingStartDate(preset.start);
                        setPendingEndDate(preset.end);
                      }}
                      className={`text-[10px] font-mono px-2 py-1 border transition-colors cursor-pointer ${
                        pendingStartDate === preset.start && pendingEndDate === preset.end
                          ? 'bg-[#A9BFA5]/20 text-[#E8E9D8] border-[#A9BFA5]'
                          : 'bg-[#071C1A] text-[#A9BFA5]/70 border-[rgba(169,191,165,0.2)] hover:text-[#E8E9D8]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[rgba(169,191,165,0.12)]">
              <div className="text-[11px] font-mono text-[#A9BFA5]/70">
                Range preview: <span className="text-[#E8E9D8]">{pendingStartDate}</span> &rarr; <span className="text-[#E8E9D8]">{pendingEndDate}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPendingStartDate('2026-08-10');
                    setPendingEndDate('2026-09-08');
                    setCustomStartDate('2026-08-10');
                    setCustomEndDate('2026-09-08');
                    setLeadRangeMode('30D');
                    setIsCustomPickerOpen(false);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-mono text-[#A9BFA5]/60 hover:text-[#E8E9D8] transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Default</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomStartDate(pendingStartDate);
                    setCustomEndDate(pendingEndDate);
                    setLeadRangeMode('CUSTOM');
                    setIsCustomPickerOpen(false);
                  }}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-[#E8E9D8] text-[#071C1A] text-xs font-mono font-medium hover:bg-white transition-colors cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Apply Date Filter</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Large Line Graph Container (Integrated, no card, subtle grid lines) */}
        <div className="pt-4 pb-2 border-t border-b border-[rgba(169,191,165,0.15)] relative select-none">
          {/* Active Hover Indicator Display */}
          <div className="h-6 flex items-center justify-between text-xs font-mono text-[#A9BFA5] mb-2 px-2">
            <span>Y: Number of leads</span>
            {leadHoverIndex !== null && leadGrowthData.points[leadHoverIndex] ? (
              <span className="text-[#E8E9D8] font-medium bg-[#0D2D2A]/60 px-2.5 py-0.5 border border-[rgba(169,191,165,0.3)]">
                {leadGrowthData.points[leadHoverIndex].date} &rarr;{' '}
                <strong className="text-emerald-400">
                  {leadGrowthData.points[leadHoverIndex].count} leads
                </strong>
              </span>
            ) : (
              <span className="text-[#A9BFA5]/50 text-[11px]">
                Hover over data points to inspect cadence
              </span>
            )}
          </div>

          {/* SVG Line Chart */}
          <div className="w-full h-72 sm:h-80 relative">
            <LeadLineChart
              points={leadGrowthData.points}
              hoverIndex={leadHoverIndex}
              onHover={setLeadHoverIndex}
            />
          </div>
        </div>
      </section>

      {/* Thin Horizontal Separator */}
      <div className="w-full border-b border-[rgba(169,191,165,0.2)]" />

      {/* =====================================================================
          02 — LEAD SOURCES (HORIZONTAL BAR GRAPH)
          ===================================================================== */}
      <section className="space-y-8">
        <div>
          <span className="text-[10px] sm:text-xs uppercase tracking-widest-plus text-[#A9BFA5] font-mono block mb-1">
            02 // LEAD SOURCES
          </span>
          <h2 className="serif text-2xl sm:text-3xl font-light text-[#E8E9D8]">
            Lead Sources
          </h2>
          <p className="mt-1 text-xs text-[#A9BFA5]/80 font-light">
            See which channels are bringing in the most leads.
          </p>
        </div>

        {/* Horizontal Bar Chart (Open layout, thin separators, no rounded cards) */}
        <div className="border-t border-[rgba(169,191,165,0.15)] divide-y divide-[rgba(169,191,165,0.12)]">
          {leadSourcesData.map((item) => {
            const widthPercent = (item.count / maxSourceCount) * 100;
            const isHovered = hoveredSource === item.name;

            return (
              <div
                key={item.name}
                onMouseEnter={() => setHoveredSource(item.name)}
                onMouseLeave={() => setHoveredSource(null)}
                className={`py-4 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors cursor-default ${
                  isHovered ? 'bg-[#0D2D2A]/30' : ''
                }`}
              >
                {/* Channel Label */}
                <div className="w-36 shrink-0">
                  <span className="text-xs font-medium text-[#E8E9D8] tracking-wide block">
                    {item.name}
                  </span>
                  <span className="text-[10px] font-mono text-[#A9BFA5]/60 block mt-0.5">
                    {item.share} of total
                  </span>
                </div>

                {/* Horizontal Bar Track */}
                <div className="flex-1 flex items-center space-x-4">
                  <div className="flex-1 h-3 bg-[#061816] border border-[rgba(169,191,165,0.2)] relative overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        isHovered ? 'bg-[#E8E9D8]' : 'bg-[#A9BFA5]'
                      }`}
                      style={{ width: `${Math.max(widthPercent, 2)}%` }}
                    />
                  </div>

                  {/* Exact Count on hover / inline */}
                  <div className="w-28 text-right font-mono text-xs">
                    <span className="text-[#E8E9D8] font-medium block">
                      {item.count.toLocaleString()} leads
                    </span>
                    <span className="text-[10px] text-emerald-400">
                      {item.change}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Thin Horizontal Separator */}
      <div className="w-full border-b border-[rgba(169,191,165,0.2)]" />

      {/* =====================================================================
          03 — CAMPAIGN PERFORMANCE (HORIZONTAL BAR GRAPH WITH SWITCHER & FILTERS)
          ===================================================================== */}
      <section className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <span className="text-[10px] sm:text-xs uppercase tracking-widest-plus text-[#A9BFA5] font-mono block mb-1">
              03 // CAMPAIGN PERFORMANCE
            </span>
            <h2 className="serif text-2xl sm:text-3xl font-light text-[#E8E9D8]">
              Campaign Performance
            </h2>
            <p className="mt-1 text-xs text-[#A9BFA5]/80 font-light">
              Compare the performance of your campaigns across timeline windows and progress stages.
            </p>
          </div>

          {/* Metric Switcher: Leads | Engagement | Conversions */}
          <div className="flex items-center space-x-5 text-xs uppercase tracking-widest font-mono">
            {(['Conversions', 'Leads', 'Engagement'] as CampaignMetric[]).map((m) => {
              const isSelected = campaignMetric === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setCampaignMetric(m)}
                  className={`pb-1 transition-colors cursor-pointer border-b ${
                    isSelected
                      ? 'text-[#E8E9D8] border-[#A9BFA5] font-semibold'
                      : 'text-[#A9BFA5]/50 border-transparent hover:text-[#A9BFA5]'
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>

        {/* Dual Filter Toolbar: Timeline & Progress */}
        <div className="p-3 bg-[#061816] border border-[rgba(169,191,165,0.18)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center flex-wrap gap-4">
            {/* Timeline Filter */}
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#A9BFA5]">Timeline:</span>
              {(['All', 'Active', 'Upcoming', 'Concluded'] as const).map((t) => {
                const isSelected = campaignTimelineFilter === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setCampaignTimelineFilter(t)}
                    className={`px-2 py-0.5 text-[10px] font-mono rounded-[2px] border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#0D2D2A] text-[#E8E9D8] border-[#A9BFA5] font-semibold'
                        : 'bg-[#071C1A] text-[#A9BFA5]/60 border-[rgba(169,191,165,0.15)] hover:text-[#E8E9D8]'
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>

            {/* Progress Filter */}
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#A9BFA5]">Progress:</span>
              {(
                [
                  { id: 'All', label: 'All' },
                  { id: 'Early', label: '<25%' },
                  { id: 'InFlight', label: '25–74%' },
                  { id: 'High', label: '≥75%' },
                ] as const
              ).map((p) => {
                const isSelected = campaignProgressFilter === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setCampaignProgressFilter(p.id)}
                    className={`px-2 py-0.5 text-[10px] font-mono rounded-[2px] border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#0D2D2A] text-[#E8E9D8] border-[#A9BFA5] font-semibold'
                        : 'bg-[#071C1A] text-[#A9BFA5]/60 border-[rgba(169,191,165,0.15)] hover:text-[#E8E9D8]'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reset Filters if active */}
          {(campaignTimelineFilter !== 'All' || campaignProgressFilter !== 'All') && (
            <button
              type="button"
              onClick={() => {
                setCampaignTimelineFilter('All');
                setCampaignProgressFilter('All');
              }}
              className="text-[10px] font-mono text-[#A9BFA5] hover:text-white underline cursor-pointer shrink-0"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Campaign Horizontal Bars */}
        <div className="border-t border-[rgba(169,191,165,0.15)] divide-y divide-[rgba(169,191,165,0.12)]">
          {campaignData.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#A9BFA5]/60 font-mono">
              No campaigns match the selected timeline and progress filters.
            </div>
          ) : (
            paginatedCampaignData.map((campaign) => {
              const widthPercent = (campaign.value / maxCampaignVal) * 100;
              const isHovered = hoveredCampaign === campaign.name;

              return (
                <div
                  key={campaign.name}
                  onMouseEnter={() => setHoveredCampaign(campaign.name)}
                  onMouseLeave={() => setHoveredCampaign(null)}
                  className={`py-4 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors cursor-default ${
                    isHovered ? 'bg-[#0D2D2A]/30' : ''
                  }`}
                >
                  {/* Campaign Name & Metadata */}
                  <div className="w-56 shrink-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-medium text-[#E8E9D8] tracking-wide block">
                        {campaign.name}
                      </span>
                      <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                        campaign.timeline === 'Active'
                          ? 'border-emerald-500/30 text-emerald-400 bg-emerald-950/30'
                          : campaign.timeline === 'Upcoming'
                          ? 'border-sky-500/30 text-sky-400 bg-sky-950/30'
                          : 'border-[#A9BFA5]/30 text-[#A9BFA5] bg-[#0D2D2A]/40'
                      }`}>
                        {campaign.timeline}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 text-[10px] font-mono text-[#A9BFA5]/60 mt-0.5">
                      <span>{campaign.dates}</span>
                      <span>•</span>
                      <span>{campaign.progress}% prog</span>
                    </div>
                  </div>

                  {/* Horizontal Bar */}
                  <div className="flex-1 flex items-center space-x-4">
                    <div className="flex-1 h-3 bg-[#061816] border border-[rgba(169,191,165,0.2)] relative overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          isHovered ? 'bg-[#E8E9D8]' : 'bg-[#A9BFA5]'
                        }`}
                        style={{ width: `${Math.max(widthPercent, 2)}%` }}
                      />
                    </div>

                    {/* Metric Value Display */}
                    <div className="w-36 text-right font-mono text-xs">
                      <span className="text-[#E8E9D8] font-medium block">
                        {campaign.display}
                      </span>
                      <span className="text-[10px] text-[#A9BFA5]/60 uppercase tracking-wider">
                        {campaignMetric}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Pagination for Campaigns */}
          {campaignData.length > 0 && (
            <Pagination
              currentPage={campaignPage}
              totalItems={campaignData.length}
              pageSize={campaignPageSize}
              onPageChange={setCampaignPage}
              showPageSize={false}
              itemName="campaigns"
            />
          )}
        </div>
      </section>

      {/* Thin Horizontal Separator */}
      <div className="w-full border-b border-[rgba(169,191,165,0.2)]" />

      {/* =====================================================================
          04 — SOCIAL ENGAGEMENT (LARGE LINE GRAPH WITH METRIC & PLATFORM FILTER)
          ===================================================================== */}
      <section className="space-y-8">
        {/* Section Heading & Dual Controls */}
        <div className="space-y-4">
          <div>
            <span className="text-[10px] sm:text-xs uppercase tracking-widest-plus text-[#A9BFA5] font-mono block mb-1">
              04 // SOCIAL ENGAGEMENT
            </span>
            <h2 className="serif text-2xl sm:text-3xl font-light text-[#E8E9D8]">
              Social Engagement
            </h2>
            <p className="mt-1 text-xs text-[#A9BFA5]/80 font-light">
              Track how your audience is responding to your content.
            </p>
          </div>

          {/* Simple Text Controls (No pill-shaped buttons) */}
          <div className="pt-2 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[rgba(169,191,165,0.15)] pb-3">
            {/* Metric Switcher: Engagement | Reach | Clicks */}
            <div className="flex items-center space-x-6 text-xs uppercase tracking-widest font-mono">
              <span className="text-[10px] text-[#A9BFA5]/60 uppercase tracking-widest mr-2">
                Metric:
              </span>
              {(['Engagement', 'Reach', 'Clicks'] as SocialMetric[]).map((m) => {
                const isSelected = socialMetric === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSocialMetric(m)}
                    className={`pb-0.5 transition-colors cursor-pointer border-b ${
                      isSelected
                        ? 'text-[#E8E9D8] border-[#A9BFA5] font-semibold'
                        : 'text-[#A9BFA5]/50 border-transparent hover:text-[#A9BFA5]'
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>

            {/* Platform Filters: All | Instagram | LinkedIn | X | Facebook */}
            <div className="flex items-center space-x-5 text-xs uppercase tracking-widest font-mono">
              <span className="text-[10px] text-[#A9BFA5]/60 uppercase tracking-widest mr-1">
                Platform:
              </span>
              {(['All', 'Instagram', 'LinkedIn', 'X', 'Facebook'] as SocialPlatform[]).map((plat) => {
                const isSelected = socialPlatform === plat;
                return (
                  <button
                    key={plat}
                    type="button"
                    onClick={() => setSocialPlatform(plat)}
                    className={`pb-0.5 transition-colors cursor-pointer border-b ${
                      isSelected
                        ? 'text-[#E8E9D8] border-[#A9BFA5] font-semibold'
                        : 'text-[#A9BFA5]/50 border-transparent hover:text-[#A9BFA5]'
                    }`}
                  >
                    {plat}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Aggregate Stat & Indicator */}
        <div className="flex items-baseline justify-between pt-1">
          <div className="flex items-baseline space-x-3">
            <span className="serif text-3xl sm:text-4xl font-light text-[#E8E9D8]">
              {socialData.total}
            </span>
            <span className="text-xs font-mono text-[#A9BFA5]/80">
              total {socialMetric.toLowerCase()} {socialData.unit}
            </span>
          </div>

          <div className="text-xs font-mono text-emerald-400">
            {socialData.growth} vs previous window
          </div>
        </div>

        {/* Large Line Graph Container (Open layout, subtle grid lines) */}
        <div className="pt-4 pb-2 border-t border-b border-[rgba(169,191,165,0.15)] relative select-none">
          {/* Active Hover readout */}
          <div className="h-6 flex items-center justify-between text-xs font-mono text-[#A9BFA5] mb-2 px-2">
            <span>Platform: {socialPlatform}</span>
            {socialHoverIndex !== null ? (
              <span className="text-[#E8E9D8] font-medium bg-[#0D2D2A]/60 px-2.5 py-0.5 border border-[rgba(169,191,165,0.3)]">
                {socialData.points[socialHoverIndex].date} &rarr;{' '}
                <strong className="text-emerald-400">
                  {socialData.points[socialHoverIndex].value.toLocaleString()} {socialMetric.toLowerCase()}
                </strong>
              </span>
            ) : (
              <span className="text-[#A9BFA5]/50 text-[11px]">
                Hover over data points to inspect
              </span>
            )}
          </div>

          {/* SVG Line Chart */}
          <div className="w-full h-72 sm:h-80 relative">
            <SocialLineChart
              points={socialData.points}
              hoverIndex={socialHoverIndex}
              onHover={setSocialHoverIndex}
            />
          </div>
        </div>
      </section>

      {/* Date Range & Sort Calendar Modal */}
      <DateRangeCalendarModal
        isOpen={isCalendarModalOpen}
        title="Decide Lead Growth Timeline & Sorting"
        subtitle="Click on the calendar to pick start and end dates. Growth analytics will be filtered and sorted on that basis."
        initialStartDate={customStartDate}
        initialEndDate={customEndDate}
        initialSortBasis={growthSortBasis}
        onClose={() => setIsCalendarModalOpen(false)}
        onApply={(selection) => {
          setCustomStartDate(selection.startDate);
          setCustomEndDate(selection.endDate);
          setPendingStartDate(selection.startDate);
          setPendingEndDate(selection.endDate);
          setGrowthSortBasis(selection.sortBasis);
          setLeadRangeMode('CUSTOM');
          setIsCalendarModalOpen(false);
          setIsCustomPickerOpen(false);
        }}
      />
    </div>
  );
}

/* =============================================================================
   CUSTOM SVG LINE CHART COMPONENTS
   Engineered with pure mathematical vector coordinates, subtle grid lines, 
   sage-green hairlines, and interactive hover hitboxes.
   ============================================================================= */

interface ChartPoint {
  label: string;
  date: string;
  count?: number;
  value?: number;
}

function LeadLineChart({
  points,
  hoverIndex,
  onHover
}: {
  points: { label: string; date: string; count: number }[];
  hoverIndex: number | null;
  onHover: (idx: number | null) => void;
}) {
  const maxVal = Math.max(...points.map(p => p.count), 10);
  const minVal = 0;
  
  // Chart dimensions in viewBox units
  const width = 800;
  const height = 280;
  const paddingLeft = 40;
  const paddingRight = 40;
  const paddingTop = 20;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Compute (x, y) coordinates for each point
  const divisor = Math.max(1, points.length - 1);
  const coords = points.map((p, idx) => {
    const x = points.length === 1 ? paddingLeft + chartWidth / 2 : paddingLeft + (idx / divisor) * chartWidth;
    const y = paddingTop + chartHeight - ((p.count - minVal) / (maxVal - minVal)) * chartHeight;
    return { x, y, ...p };
  });

  // Construct SVG path string (smooth line)
  const pathD = coords.reduce((acc, curr, idx) => {
    if (idx === 0) return `M ${curr.x} ${curr.y}`;
    const prev = coords[idx - 1];
    const cp1x = prev.x + (curr.x - prev.x) / 2;
    const cp1y = prev.y;
    const cp2x = prev.x + (curr.x - prev.x) / 2;
    const cp2y = curr.y;
    return `${acc} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
  }, '');

  // Gradient area path string
  const areaD = coords.length > 0
    ? `${pathD} L ${coords[coords.length - 1].x} ${paddingTop + chartHeight} L ${coords[0].x} ${paddingTop + chartHeight} Z`
    : '';

  const sliceWidth = points.length > 0 ? chartWidth / points.length : chartWidth;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-full overflow-visible"
      preserveAspectRatio="none"
      onMouseLeave={() => onHover(null)}
    >
      <defs>
        <linearGradient id="leadAreaGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A9BFA5" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#A9BFA5" stopOpacity="0.0" />
        </linearGradient>
      </defs>

      {/* Subtle Horizontal Gridlines */}
      {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
        const y = paddingTop + chartHeight * ratio;
        const value = Math.round(maxVal - ratio * maxVal);
        return (
          <g key={i}>
            <line
              x1={paddingLeft}
              y1={y}
              x2={width - paddingRight}
              y2={y}
              stroke="rgba(169, 191, 165, 0.1)"
              strokeDasharray="3 3"
              strokeWidth="1"
            />
            <text
              x={paddingLeft - 10}
              y={y + 4}
              textAnchor="end"
              fill="rgba(169, 191, 165, 0.5)"
              fontSize="10"
              fontFamily="monospace"
            >
              {value}
            </text>
          </g>
        );
      })}

      {/* Area Fill */}
      <path d={areaD} fill="url(#leadAreaGradient)" />

      {/* Line Path */}
      <path
        d={pathD}
        fill="none"
        stroke="#A9BFA5"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Active Hover Crosshair Line */}
      {hoverIndex !== null && coords[hoverIndex] && (
        <line
          x1={coords[hoverIndex].x}
          y1={paddingTop}
          x2={coords[hoverIndex].x}
          y2={paddingTop + chartHeight}
          stroke="#E8E9D8"
          strokeWidth="1"
          strokeDasharray="2 2"
          opacity="0.6"
        />
      )}

      {/* Points & Transparent Interactive Hitboxes */}
      {coords.map((c, idx) => {
        const isHovered = hoverIndex === idx;
        return (
          <g key={idx}>
            {/* Visible Point Dot */}
            <circle
              cx={c.x}
              cy={c.y}
              r={isHovered ? 5 : 3}
              fill={isHovered ? '#FFFFFF' : '#071C1A'}
              stroke={isHovered ? '#E8E9D8' : '#A9BFA5'}
              strokeWidth={isHovered ? 2 : 1.5}
              className="transition-all duration-150 pointer-events-none"
            />

            {/* X-axis label */}
            {(() => {
              const shouldShowLabel = points.length <= 12 || idx === 0 || idx === points.length - 1 || idx % Math.ceil(points.length / 8) === 0;
              if (!shouldShowLabel && !isHovered) return null;
              return (
                <text
                  x={c.x}
                  y={height - 12}
                  textAnchor="middle"
                  fill={isHovered ? '#E8E9D8' : 'rgba(169, 191, 165, 0.6)'}
                  fontSize="10"
                  fontFamily="monospace"
                  className="transition-colors pointer-events-none"
                >
                  {c.label}
                </text>
              );
            })()}

            {/* Large Transparent Hitbox for effortless hover targeting */}
            <rect
              x={c.x - sliceWidth / 2}
              y={paddingTop}
              width={sliceWidth}
              height={chartHeight + 30}
              fill="transparent"
              className="cursor-crosshair"
              onMouseEnter={() => onHover(idx)}
            />
          </g>
        );
      })}
    </svg>
  );
}

function SocialLineChart({
  points,
  hoverIndex,
  onHover
}: {
  points: { label: string; date: string; value: number }[];
  hoverIndex: number | null;
  onHover: (idx: number | null) => void;
}) {
  const maxVal = Math.max(...points.map(p => p.value), 10);
  const minVal = 0;
  
  const width = 800;
  const height = 280;
  const paddingLeft = 50;
  const paddingRight = 40;
  const paddingTop = 20;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const coords = points.map((p, idx) => {
    const x = paddingLeft + (idx / (points.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - ((p.value - minVal) / (maxVal - minVal)) * chartHeight;
    return { x, y, ...p };
  });

  const pathD = coords.reduce((acc, curr, idx) => {
    if (idx === 0) return `M ${curr.x} ${curr.y}`;
    const prev = coords[idx - 1];
    const cp1x = prev.x + (curr.x - prev.x) / 2;
    const cp1y = prev.y;
    const cp2x = prev.x + (curr.x - prev.x) / 2;
    const cp2y = curr.y;
    return `${acc} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
  }, '');

  const areaD = `${pathD} L ${coords[coords.length - 1].x} ${paddingTop + chartHeight} L ${coords[0].x} ${paddingTop + chartHeight} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-full overflow-visible"
      preserveAspectRatio="none"
      onMouseLeave={() => onHover(null)}
    >
      <defs>
        <linearGradient id="socialAreaGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A9BFA5" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#A9BFA5" stopOpacity="0.0" />
        </linearGradient>
      </defs>

      {/* Gridlines */}
      {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
        const y = paddingTop + chartHeight * ratio;
        const value = Math.round(maxVal - ratio * maxVal);
        const formattedVal = value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value;
        return (
          <g key={i}>
            <line
              x1={paddingLeft}
              y1={y}
              x2={width - paddingRight}
              y2={y}
              stroke="rgba(169, 191, 165, 0.1)"
              strokeDasharray="3 3"
              strokeWidth="1"
            />
            <text
              x={paddingLeft - 10}
              y={y + 4}
              textAnchor="end"
              fill="rgba(169, 191, 165, 0.5)"
              fontSize="10"
              fontFamily="monospace"
            >
              {formattedVal}
            </text>
          </g>
        );
      })}

      {/* Area */}
      <path d={areaD} fill="url(#socialAreaGradient)" />

      {/* Line */}
      <path
        d={pathD}
        fill="none"
        stroke="#A9BFA5"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Crosshair */}
      {hoverIndex !== null && coords[hoverIndex] && (
        <line
          x1={coords[hoverIndex].x}
          y1={paddingTop}
          x2={coords[hoverIndex].x}
          y2={paddingTop + chartHeight}
          stroke="#E8E9D8"
          strokeWidth="1"
          strokeDasharray="2 2"
          opacity="0.6"
        />
      )}

      {/* Points & Hitboxes */}
      {coords.map((c, idx) => {
        const isHovered = hoverIndex === idx;
        return (
          <g key={idx}>
            <circle
              cx={c.x}
              cy={c.y}
              r={isHovered ? 5 : 3}
              fill={isHovered ? '#FFFFFF' : '#071C1A'}
              stroke={isHovered ? '#E8E9D8' : '#A9BFA5'}
              strokeWidth={isHovered ? 2 : 1.5}
              className="transition-all duration-150 pointer-events-none"
            />

            <text
              x={c.x}
              y={height - 12}
              textAnchor="middle"
              fill={isHovered ? '#E8E9D8' : 'rgba(169, 191, 165, 0.6)'}
              fontSize="10"
              fontFamily="monospace"
              className="transition-colors pointer-events-none"
            >
              {c.label}
            </text>

            <rect
              x={c.x - chartWidth / (points.length * 2)}
              y={paddingTop}
              width={chartWidth / points.length}
              height={chartHeight + 30}
              fill="transparent"
              className="cursor-crosshair"
              onMouseEnter={() => onHover(idx)}
            />
          </g>
        );
      })}
    </svg>
  );
}
