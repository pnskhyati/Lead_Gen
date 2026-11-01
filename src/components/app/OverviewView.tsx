import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  Clock, 
  ChevronDown, 
  CheckCircle2, 
  User, 
  MessageSquare, 
  Flame, 
  Plus, 
  X,
  Calendar as CalendarIcon,
  Filter,
  SlidersHorizontal
} from 'lucide-react';
import { StatMetric, Lead, Campaign, TrendingTopic, NavCategory, SubCategory } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import DateRangeCalendarModal, { DateRangeSelection, SortBasis } from './DateRangeCalendarModal';
import SeoGeoPanel from './SeoGeoPanel';

interface ActivityItem {
  id: string;
  isoDate: string; // YYYY-MM-DD
  timeStr: string;
  icon: string;
  iconColor: string;
  description: string;
  relativeTime: string;
  score: number;
  category: NavCategory;
  subCategory?: SubCategory;
}

const SAMPLE_ACTIVITIES: ActivityItem[] = [
  {
    id: 'act-1',
    isoDate: '2026-10-06',
    timeStr: '10:42 AM',
    icon: '＋',
    iconColor: 'text-emerald-400',
    description: 'New WhatsApp lead · Rahul Sharma',
    relativeTime: 'Just now',
    score: 92,
    category: 'leads',
    subCategory: 'all-leads'
  },
  {
    id: 'act-2',
    isoDate: '2026-10-06',
    timeStr: '10:36 AM',
    icon: '✦',
    iconColor: 'text-emerald-400',
    description: 'Qualified as Hot · Aster Labs · score 92',
    relativeTime: '8m ago',
    score: 92,
    category: 'leads',
    subCategory: 'all-leads'
  },
  {
    id: 'act-3',
    isoDate: '2026-10-06',
    timeStr: '10:18 AM',
    icon: '👤',
    iconColor: 'text-amber-400',
    description: 'Handoff requested · John Carter · Instagram',
    relativeTime: '26m ago',
    score: 72,
    category: 'inbox',
    subCategory: 'inbox'
  },
  {
    id: 'act-4',
    isoDate: '2026-10-05',
    timeStr: '04:15 PM',
    icon: '📄',
    iconColor: 'text-sky-400',
    description: 'Proposal Dispatched · Meridian Health · ₹6.5L',
    relativeTime: '1d ago',
    score: 88,
    category: 'leads',
    subCategory: 'pipeline'
  },
  {
    id: 'act-5',
    isoDate: '2026-10-05',
    timeStr: '11:20 AM',
    icon: '💬',
    iconColor: 'text-rose-400',
    description: 'Low-intent inquiry disqualified · Inactive profile',
    relativeTime: '1d ago',
    score: 48,
    category: 'inbox',
    subCategory: 'inbox'
  },
  {
    id: 'act-6',
    isoDate: '2026-10-02',
    timeStr: '02:30 PM',
    icon: '🚀',
    iconColor: 'text-purple-400',
    description: 'Multichannel campaign launched · Autumn Studio Push',
    relativeTime: '4d ago',
    score: 68,
    category: 'campaigns',
    subCategory: 'campaign-list'
  },
  {
    id: 'act-7',
    isoDate: '2026-09-28',
    timeStr: '03:45 PM',
    icon: '🏆',
    iconColor: 'text-emerald-400',
    description: 'Deal Closed & Won · Apex Architectures (₹4.8L)',
    relativeTime: '8d ago',
    score: 100,
    category: 'analytics',
    subCategory: 'overview'
  },
  {
    id: 'act-8',
    isoDate: '2026-09-22',
    timeStr: '09:10 AM',
    icon: '⚠️',
    iconColor: 'text-rose-400',
    description: 'Cold lead flagged · Budget below threshold',
    relativeTime: '14d ago',
    score: 35,
    category: 'leads',
    subCategory: 'all-leads'
  },
  {
    id: 'act-9',
    isoDate: '2026-09-15',
    timeStr: '01:05 PM',
    icon: '📅',
    iconColor: 'text-amber-400',
    description: 'Discovery Call completed · BlueSky Design Studio',
    relativeTime: '21d ago',
    score: 75,
    category: 'leads',
    subCategory: 'pipeline'
  },
  {
    id: 'act-10',
    isoDate: '2026-09-05',
    timeStr: '11:40 AM',
    icon: '✦',
    iconColor: 'text-indigo-400',
    description: 'Instagram ad campaign generated 24 new qualified conversations',
    relativeTime: '1mo ago',
    score: 91,
    category: 'analytics',
    subCategory: 'overview'
  },
  {
    id: 'act-11',
    isoDate: '2026-08-28',
    timeStr: '10:00 AM',
    icon: '📄',
    iconColor: 'text-sky-400',
    description: 'Contract signed · UrbanLiving Studio ($18,500)',
    relativeTime: '1mo ago',
    score: 95,
    category: 'leads',
    subCategory: 'pipeline'
  },
  {
    id: 'act-12',
    isoDate: '2026-08-10',
    timeStr: '02:15 PM',
    icon: '🚀',
    iconColor: 'text-purple-400',
    description: 'Early Access WhatsApp qualifier launched',
    relativeTime: '2mo ago',
    score: 75,
    category: 'campaigns',
    subCategory: 'campaign-list'
  }
];

export interface OverviewLiveInsights {
  waitingHuman: number;
  hotLeads: number;
  warmLeads: number;
  totalLeads: number;
  needsAttentionCount: number;
  recommendationTitle: string;
  recommendationBody: string;
}

interface OverviewViewProps {
  metrics: StatMetric[];
  leads: Lead[];
  campaigns: Campaign[];
  trendingTopics: TrendingTopic[];
  onNavigate: (category: NavCategory, subCategory?: SubCategory) => void;
  onSelectLead: (lead: Lead) => void;
  onTriggerQuickAction?: (action: 'campaign' | 'content' | 'lead' | 'schedule') => void;
  isFirstRun?: boolean;
  workspaceName?: string;
  liveInsights?: OverviewLiveInsights;
}

export default function OverviewView({
  metrics,
  leads,
  campaigns,
  trendingTopics,
  onNavigate,
  onSelectLead,
  isFirstRun = false,
  workspaceName = 'Nexora',
  liveInsights,
}: OverviewViewProps) {
  const { theme } = useTheme();

  // Date range selector: Today, Last 7 days, Last 30 days, Custom
  const [dateRange, setDateRange] = useState('Last 7 days');
  const [showRecommendation, setShowRecommendation] = useState(true);

  // Custom Calendar Modal State
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [customRange, setCustomRange] = useState<DateRangeSelection>({
    startDate: '2026-09-01',
    endDate: '2026-10-06',
    sortBasis: 'newest'
  });

  // Time-of-day dynamic greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return `Good morning, ${workspaceName}`;
    if (hour < 17) return `Good afternoon, ${workspaceName}`;
    return `Good evening, ${workspaceName}`;
  };

  const handleReviewLead = () => {
    const asterLead = leads.find(l => l.company.toLowerCase().includes('aster')) || leads[0];
    if (asterLead) {
      onSelectLead(asterLead);
    }
  };

  // Handle selecting or changing date range
  const handleDateRangeSelect = (val: string) => {
    setDateRange(val);
    if (val === 'Custom') {
      setIsCalendarOpen(true);
    }
  };

  // Handle applying selection from DateRangeCalendarModal
  const handleApplyCalendarSelection = (selection: DateRangeSelection) => {
    setCustomRange(selection);
    setDateRange('Custom');
  };

  // Filter and sort activities on that basis
  const filteredActivities = useMemo(() => {
    let list = [...SAMPLE_ACTIVITIES];

    if (dateRange === 'Today') {
      list = list.filter(a => a.isoDate === '2026-10-06');
    } else if (dateRange === 'Last 7 days') {
      list = list.filter(a => a.isoDate >= '2026-09-30' && a.isoDate <= '2026-10-06');
    } else if (dateRange === 'Last 30 days') {
      list = list.filter(a => a.isoDate >= '2026-09-06' && a.isoDate <= '2026-10-06');
    } else if (dateRange === 'Custom') {
      list = list.filter(a => a.isoDate >= customRange.startDate && a.isoDate <= customRange.endDate);
    }

    // Sort on that basis
    list.sort((a, b) => {
      if (customRange.sortBasis === 'oldest') {
        const dateDiff = a.isoDate.localeCompare(b.isoDate);
        return dateDiff !== 0 ? dateDiff : a.timeStr.localeCompare(b.timeStr);
      } else if (customRange.sortBasis === 'priority') {
        return b.score - a.score;
      } else if (customRange.sortBasis === 'value') {
        const extractVal = (desc: string, score: number) => {
          const lMatch = desc.match(/₹([\d.]+)L/);
          if (lMatch) return parseFloat(lMatch[1]) * 100000;
          const dMatch = desc.match(/\$([\d,]+)/);
          if (dMatch) return parseFloat(dMatch[1].replace(/,/g, '')) * 85;
          return score * 1000;
        };
        return extractVal(b.description, b.score) - extractVal(a.description, a.score);
      } else if (customRange.sortBasis === 'alphabetical') {
        return a.description.localeCompare(b.description);
      } else {
        // default: newest
        const dateDiff = b.isoDate.localeCompare(a.isoDate);
        return dateDiff !== 0 ? dateDiff : b.timeStr.localeCompare(a.timeStr);
      }
    });

    return list;
  }, [dateRange, customRange]);

  // Dynamically compute KPI numbers based on selected window
  const kpiData = useMemo(() => {
    if (dateRange === 'Today') {
      return { newLeads: 4, growth: '↑ 4%', qualified: 2, qualRate: '50%', followUps: 2, dueText: '1 due', won: 1, wonRev: '₹1.2L' };
    }
    if (dateRange === 'Last 7 days') {
      return { newLeads: 28, growth: '↑ 18%', qualified: 11, qualRate: '39%', followUps: 7, dueText: '3 due', won: 4, wonRev: '₹4.8L' };
    }
    if (dateRange === 'Last 30 days') {
      return { newLeads: 114, growth: '↑ 24%', qualified: 48, qualRate: '42%', followUps: 19, dueText: '5 due', won: 16, wonRev: '₹19.2L' };
    }
    
    // Custom Range calculation
    const startObj = new Date(customRange.startDate);
    const endObj = new Date(customRange.endDate);
    const diffDays = Math.max(1, Math.round((endObj.getTime() - startObj.getTime()) / (1000 * 3600 * 24)) + 1);
    
    const calculatedLeads = Math.max(2, Math.round(diffDays * 3.7));
    const calculatedQualified = Math.max(1, Math.round(calculatedLeads * 0.41));
    const calculatedFollowUps = Math.max(1, Math.round(calculatedLeads * 0.22));
    const calculatedWon = Math.max(1, Math.round(calculatedLeads * 0.14));
    const revenueVal = (calculatedWon * 1.2).toFixed(1);

    return {
      newLeads: calculatedLeads,
      growth: `↑ ${Math.min(35, 12 + Math.round(diffDays * 0.3))}%`,
      qualified: calculatedQualified,
      qualRate: `${Math.round((calculatedQualified / calculatedLeads) * 100)}%`,
      followUps: calculatedFollowUps,
      dueText: `${Math.max(1, Math.round(calculatedFollowUps * 0.4))} due`,
      won: calculatedWon,
      wonRev: `₹${revenueVal}L`
    };
  }, [dateRange, customRange]);

  // Lead score badge matching Inbox design system (>=90 emerald, 80-89 amber, <80 rose)
  const getScoreBadge = (score: number) => {
    if (score >= 90) {
      return {
        text: 'text-emerald-700 dark:text-emerald-400',
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40'
      };
    }
    if (score >= 80) {
      return {
        text: 'text-amber-700 dark:text-amber-400',
        bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40'
      };
    }
    return {
      text: 'text-rose-700 dark:text-rose-400',
      bg: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40'
    };
  };

  const isLight = theme === 'light';

  return (
    <div className={`space-y-6 pb-12 animate-fadeIn select-text ${
      isLight ? 'text-slate-900 font-sans' : 'text-[#E8E9D8] font-sans'
    }`}>
      
      {/* ========================================================
          1. HEADER (Greeting & Date Range with Calendar Trigger)
         ======================================================== */}
      <div className={`border-b pb-4 flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 transition-colors ${
        isLight ? 'border-slate-200/90' : 'border-[rgba(169,191,165,0.18)]'
      }`}>
        <div>
          <h1 className={`text-2xl sm:text-3xl font-bold tracking-tight ${
            isLight ? 'text-slate-900' : 'text-white'
          }`}>
            {getGreeting()}
          </h1>
          <p className={`text-xs mt-1 font-normal ${
            isLight ? 'text-slate-500' : 'text-[#A9BFA5]'
          }`}>
            {liveInsights
              ? `${liveInsights.needsAttentionCount} thing${liveInsights.needsAttentionCount === 1 ? '' : 's'} need you today.`
              : '3 things need you today.'}
          </p>
        </div>

        {/* Right side: Date range controls */}
        <div className="flex items-center">
          {/* Date range controls (Segmented control matching Inbox) */}
          <div className={`flex items-center space-x-1 p-0.5 rounded-lg border text-xs font-medium shrink-0 ${
            isLight ? 'bg-slate-100/90 border-slate-200/80' : 'bg-[#041210] border-[rgba(169,191,165,0.16)]'
          }`}>
            {(['Today', 'Last 7 days', 'Last 30 days'] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setDateRange(preset)}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer text-xs ${
                  dateRange === preset
                    ? isLight
                      ? 'bg-white text-slate-900 font-semibold shadow-xs'
                      : 'bg-[#0E2C26] text-white font-semibold border border-teal-500/30'
                    : isLight
                      ? 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium'
                      : 'text-[#A9BFA5] hover:text-white font-medium'
                }`}
              >
                {preset}
              </button>
            ))}

            {/* Custom Calendar Trigger */}
            <button
              type="button"
              id="custom-date-btn"
              onClick={() => {
                setDateRange('Custom');
                setIsCalendarOpen(true);
              }}
              className={`px-3 py-1 rounded-md flex items-center space-x-1.5 transition-all cursor-pointer text-xs ${
                dateRange === 'Custom'
                  ? isLight
                    ? 'bg-white text-teal-800 font-semibold shadow-xs border border-teal-200'
                    : 'bg-[#0E2C26] text-teal-300 font-semibold border border-teal-500/40'
                  : isLight
                    ? 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium'
                    : 'text-[#A9BFA5] hover:text-white font-medium'
              }`}
              title="Click on Custom to decide start and end date on calendar and sort on that basis"
            >
              <CalendarIcon className={`w-3.5 h-3.5 ${isLight ? 'text-teal-600' : 'text-teal-400'}`} />
              <span>Custom</span>
              {dateRange === 'Custom' && (
                <>
                  <span className={`text-[10px] font-mono tabular-nums ${isLight ? 'text-teal-700' : 'text-teal-300'}`}>
                    ({customRange.startDate.slice(5)} → {customRange.endDate.slice(5)})
                  </span>
                  <ChevronDown className="w-3 h-3" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>


      {/* ========================================================
          FIRST-RUN EMPTY STATE (Spec: Image 6)
         ======================================================== */}
      {isFirstRun && (
        <div className={`p-8 sm:p-12 rounded-xl border text-center space-y-4 max-w-lg mx-auto my-6 animate-fadeIn shadow-xs ${
          isLight ? 'bg-white border-slate-200' : 'bg-[#061816] border-teal-500/30'
        }`}>
          <div className="w-12 h-12 rounded-full bg-teal-50 border border-teal-200/60 dark:bg-emerald-500/10 dark:border-emerald-500/25 flex items-center justify-center mx-auto text-teal-600 dark:text-emerald-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className={`text-xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Your marketing engine is ready.
            </h3>
            <p className={`text-xs max-w-sm mx-auto leading-relaxed ${isLight ? 'text-slate-500' : 'text-[#A9BFA5]'}`}>
              Connect a channel to start capturing leads.
            </p>
          </div>
          <div>
            <button
              type="button"
              id="overview-connect-whatsapp-btn"
              onClick={() => onNavigate('settings', 'connections')}
              className={`px-6 py-2.5 text-xs font-bold rounded-lg transition-all inline-flex items-center space-x-2 cursor-pointer shadow-sm ${
                isLight
                  ? 'bg-slate-900 hover:bg-slate-800 text-white'
                  : 'bg-white hover:bg-slate-100 text-slate-950'
              }`}
            >
              <span>Connect</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          2. ✦ TECAVY RECOMMENDS (Page 14 spec)
         ======================================================== */}
      {showRecommendation && (
        <div className={`p-4 sm:p-5 rounded-lg border relative overflow-hidden animate-fadeIn transition-colors ${
          isLight
            ? 'bg-teal-50/70 border-teal-200/90 text-slate-900 shadow-2xs'
            : 'bg-[#061816] border-teal-500/30 text-teal-100'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span className="text-[11px] uppercase tracking-wider text-teal-700 dark:text-teal-400 font-bold">
                  TECAVY RECOMMENDS
                </span>
              </div>
              <p className={`text-xs sm:text-sm font-semibold leading-snug ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {liveInsights?.recommendationTitle
                  || 'Aster Labs asked about pricing twice and wants to start in 30 days.'}
              </p>
              <p className={`text-xs ${isLight ? 'text-slate-600 font-normal' : 'text-[#A9BFA5] font-light'}`}>
                {liveInsights?.recommendationBody || 'Suggested: schedule a discovery call.'}
              </p>
            </div>

            <div className="flex items-center space-x-2.5 shrink-0">
              <button
                type="button"
                onClick={handleReviewLead}
                className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-xs"
              >
                Review lead
              </button>
              <button
                type="button"
                onClick={() => setShowRecommendation(false)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                  isLight
                    ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs'
                    : 'border-[rgba(169,191,165,0.2)] text-[#A9BFA5] hover:text-white'
                }`}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <SeoGeoPanel variant="overview" onNavigate={onNavigate} className="animate-fadeIn" />

      {/* ========================================================
          3. NEEDS YOU (Above KPI Cards per Page 14 & 15 spec!)
         ======================================================== */}
      <div className="space-y-2">
        <span className={`text-xs font-bold uppercase tracking-wider block ${
          isLight ? 'text-slate-700' : 'text-[#A9BFA5]'
        }`}>
          NEEDS YOU
        </span>

        <div className={`border divide-y rounded-lg transition-colors ${
          isLight
            ? 'border-slate-200 bg-white divide-slate-100 shadow-2xs'
            : 'border-[rgba(169,191,165,0.18)] bg-[#071C1A] divide-[rgba(169,191,165,0.12)]'
        }`}>
          
          {/* Row 1: 🔴 3 conversations waiting for a human */}
          <div 
            id="needs-you-row-1"
            onClick={() => onNavigate('inbox', 'waiting-human')}
            className={`p-3.5 flex items-center justify-between transition-colors cursor-pointer group ${
              isLight ? 'hover:bg-slate-50' : 'hover:bg-[#081F1C]'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 ring-2 ring-rose-500/20 shrink-0" />
              <span className={`text-xs sm:text-sm font-medium ${
                isLight ? 'text-slate-800 group-hover:text-slate-900' : 'text-[#E8E9D8] group-hover:text-white'
              }`}>
                {liveInsights
                  ? `${liveInsights.waitingHuman} conversation${liveInsights.waitingHuman === 1 ? '' : 's'} waiting for a human`
                  : '3 conversations waiting for a human (oldest 18 min)'}
              </span>
            </div>
            <button
              type="button"
              id="needs-you-open-btn-1"
              data-testid="open-inbox-button-1"
              aria-label="Open in Inbox - Waiting for Human"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onNavigate('inbox', 'waiting-human');
              }}
              className={`text-xs font-semibold flex items-center space-x-1 shrink-0 group-hover:underline cursor-pointer ${
                isLight ? 'text-teal-600' : 'text-teal-400'
              }`}
            >
              <span>Open</span>
              <ArrowRight className="w-3 h-3 pointer-events-none" />
            </button>
          </div>

          {/* Row 2: 🟠 5 follow-ups overdue */}
          <div 
            id="needs-you-row-2"
            onClick={() => onNavigate('inbox', 'overdue-followups')}
            className={`p-3.5 flex items-center justify-between transition-colors cursor-pointer group ${
              isLight ? 'hover:bg-slate-50' : 'hover:bg-[#081F1C]'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 ring-2 ring-amber-500/20 shrink-0" />
              <span className={`text-xs sm:text-sm font-medium ${
                isLight ? 'text-slate-800 group-hover:text-slate-900' : 'text-[#E8E9D8] group-hover:text-white'
              }`}>
                {liveInsights
                  ? `${liveInsights.warmLeads} warm lead${liveInsights.warmLeads === 1 ? '' : 's'} ready for follow-up`
                  : '5 follow-ups overdue (oldest 2 days)'}
              </span>
            </div>
            <button
              type="button"
              id="needs-you-open-btn-2"
              data-testid="open-inbox-button-2"
              aria-label="Open in Inbox - Overdue Follow-ups"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onNavigate('inbox', 'overdue-followups');
              }}
              className={`text-xs font-semibold flex items-center space-x-1 shrink-0 group-hover:underline cursor-pointer ${
                isLight ? 'text-teal-600' : 'text-teal-400'
              }`}
            >
              <span>Open</span>
              <ArrowRight className="w-3 h-3 pointer-events-none" />
            </button>
          </div>

          {/* Row 3: 🟡 2 leads asked for pricing */}
          <div 
            id="needs-you-row-3"
            onClick={() => onNavigate('inbox', 'asked-pricing')}
            className={`p-3.5 flex items-center justify-between transition-colors cursor-pointer group ${
              isLight ? 'hover:bg-slate-50' : 'hover:bg-[#081F1C]'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <span className="w-2 h-2 rounded-full bg-teal-500 ring-2 ring-teal-500/20 shrink-0" />
              <span className={`text-xs sm:text-sm font-medium ${
                isLight ? 'text-slate-800 group-hover:text-slate-900' : 'text-[#E8E9D8] group-hover:text-white'
              }`}>
                {liveInsights
                  ? `${liveInsights.hotLeads} hot lead${liveInsights.hotLeads === 1 ? '' : 's'} need attention`
                  : '2 leads asked for pricing'}
              </span>
            </div>
            <button
              type="button"
              id="needs-you-open-btn-3"
              data-testid="open-inbox-button-3"
              aria-label="Open in Inbox - Asked for Pricing"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onNavigate('inbox', 'asked-pricing');
              }}
              className={`text-xs font-semibold flex items-center space-x-1 shrink-0 group-hover:underline cursor-pointer ${
                isLight ? 'text-teal-600' : 'text-teal-400'
              }`}
            >
              <span>Open</span>
              <ArrowRight className="w-3 h-3 pointer-events-none" />
            </button>
          </div>

          {/* Row 4: 🟢 4 leads ready to book a call */}
          <div 
            id="needs-you-row-4"
            onClick={() => onNavigate('inbox', 'ready-to-book')}
            className={`p-3.5 flex items-center justify-between transition-colors cursor-pointer group ${
              isLight ? 'hover:bg-slate-50' : 'hover:bg-[#081F1C]'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20 shrink-0" />
              <span className={`text-xs sm:text-sm font-medium ${
                isLight ? 'text-slate-800 group-hover:text-slate-900' : 'text-[#E8E9D8] group-hover:text-white'
              }`}>
                {liveInsights
                  ? `${liveInsights.totalLeads} total lead${liveInsights.totalLeads === 1 ? '' : 's'} in pipeline`
                  : '4 leads ready to book a call'}
              </span>
            </div>
            <button
              type="button"
              id="needs-you-open-btn-4"
              data-testid="open-inbox-button-4"
              aria-label="Open in Inbox - Ready to Book a Call"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onNavigate('inbox', 'ready-to-book');
              }}
              className={`text-xs font-semibold flex items-center space-x-1 shrink-0 group-hover:underline cursor-pointer ${
                isLight ? 'text-teal-600' : 'text-teal-400'
              }`}
            >
              <span>Open</span>
              <ArrowRight className="w-3 h-3 pointer-events-none" />
            </button>
          </div>

        </div>
      </div>

      {/* ========================================================
          4. KPI CARDS (Page 15 spec: Dynamically scaled by date window)
         ======================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* NEW LEADS */}
        <div
          onClick={() => onNavigate('leads', 'all-leads')}
          className={`p-4 sm:p-5 rounded-lg border transition-all cursor-pointer ${
            isLight
              ? 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
              : 'bg-[#071C1A] border-[rgba(169,191,165,0.18)] hover:border-[#A9BFA5]'
          }`}
        >
          <span className={`text-[11px] font-bold uppercase tracking-wider block ${
            isLight ? 'text-slate-500' : 'text-[#A9BFA5]/70'
          }`}>
            NEW LEADS {dateRange === 'Custom' ? '(RANGE)' : ''}
          </span>
          <div className="flex items-baseline justify-between mt-2 font-sans">
            <span className={`text-2xl sm:text-3xl font-bold tabular-nums ${isLight ? 'text-slate-900' : 'text-white'}`}>
              {kpiData.newLeads}
            </span>
            <span className={`text-xs font-semibold ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>
              {kpiData.growth}
            </span>
          </div>
        </div>

        {/* QUALIFIED */}
        <div
          onClick={() => onNavigate('leads', 'pipeline')}
          className={`p-4 sm:p-5 rounded-lg border transition-all cursor-pointer ${
            isLight
              ? 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
              : 'bg-[#071C1A] border-[rgba(169,191,165,0.18)] hover:border-[#A9BFA5]'
          }`}
        >
          <span className={`text-[11px] font-bold uppercase tracking-wider block ${
            isLight ? 'text-slate-500' : 'text-[#A9BFA5]/70'
          }`}>
            QUALIFIED
          </span>
          <div className="flex items-baseline justify-between mt-2 font-sans">
            <span className={`text-2xl sm:text-3xl font-bold tabular-nums ${isLight ? 'text-slate-900' : 'text-white'}`}>
              {kpiData.qualified}
            </span>
            <span className={`text-xs font-semibold ${isLight ? 'text-teal-600' : 'text-teal-400'}`}>
              {kpiData.qualRate}
            </span>
          </div>
        </div>

        {/* FOLLOW-UPS */}
        <div
          onClick={() => onNavigate('followups', 'follow-ups')}
          className={`p-4 sm:p-5 rounded-lg border transition-all cursor-pointer ${
            isLight
              ? 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
              : 'bg-[#071C1A] border-[rgba(169,191,165,0.18)] hover:border-[#A9BFA5]'
          }`}
        >
          <span className={`text-[11px] font-bold uppercase tracking-wider block ${
            isLight ? 'text-slate-500' : 'text-[#A9BFA5]/70'
          }`}>
            FOLLOW-UPS
          </span>
          <div className="flex items-baseline justify-between mt-2 font-sans">
            <span className={`text-2xl sm:text-3xl font-bold tabular-nums ${isLight ? 'text-slate-900' : 'text-white'}`}>
              {kpiData.followUps}
            </span>
            <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium border tabular-nums ${
              isLight
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-amber-950/40 text-amber-300 border-amber-800/40'
            }`}>
              {kpiData.dueText}
            </span>
          </div>
        </div>

        {/* WON */}
        <div
          onClick={() => onNavigate('analytics', 'overview')}
          className={`p-4 sm:p-5 rounded-lg border transition-all cursor-pointer ${
            isLight
              ? 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
              : 'bg-[#071C1A] border-[rgba(169,191,165,0.18)] hover:border-[#A9BFA5]'
          }`}
        >
          <span className={`text-[11px] font-bold uppercase tracking-wider block ${
            isLight ? 'text-slate-500' : 'text-[#A9BFA5]/70'
          }`}>
            WON
          </span>
          <div className="flex items-baseline justify-between mt-2 font-sans">
            <span className={`text-2xl sm:text-3xl font-bold tabular-nums ${isLight ? 'text-slate-900' : 'text-white'}`}>
              {kpiData.won}
            </span>
            <span className={`text-xs font-semibold ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>
              {kpiData.wonRev}
            </span>
          </div>
        </div>

      </div>

      {/* ========================================================
          5. LEAD FUNNEL & CHANNELS (Page 15 spec)
         ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Lead Funnel (~50%) */}
        <div className={`lg:col-span-6 p-5 rounded-lg border space-y-3 ${
          isLight
            ? 'bg-white border-slate-200 shadow-2xs'
            : 'bg-[#071C1A] border-[rgba(169,191,165,0.18)]'
        }`}>
          <div className={`flex items-center justify-between pb-2.5 border-b ${
            isLight ? 'border-slate-100' : 'border-[rgba(169,191,165,0.12)]'
          }`}>
            <span className={`text-xs font-bold uppercase tracking-wider ${
              isLight ? 'text-slate-700' : 'text-[#A9BFA5]'
            }`}>
              LEAD FUNNEL
            </span>
            <span className={`text-xs font-mono tabular-nums ${
              isLight ? 'text-slate-400' : 'text-[#A9BFA5]/60'
            }`}>
              {dateRange === 'Custom' ? `${customRange.startDate} → ${customRange.endDate}` : dateRange}
            </span>
          </div>

          <div className="space-y-1.5 text-xs">
            <div 
              onClick={() => onNavigate('leads', 'pipeline')}
              className={`flex items-center justify-between p-2 rounded-md transition-colors cursor-pointer ${
                isLight ? 'hover:bg-slate-50' : 'hover:bg-[#081F1C]'
              }`}
            >
              <div className="flex items-center space-x-2 w-28">
                <span className={`font-medium ${isLight ? 'text-slate-800' : 'text-white'}`}>New</span>
                <span className={`tabular-nums font-mono ${isLight ? 'text-slate-500' : 'text-[#A9BFA5]/70'}`}>{kpiData.newLeads}</span>
              </div>
              <div className={`flex-1 ${isLight ? 'bg-slate-100' : 'bg-[#041210]'} h-2.5 rounded-full overflow-hidden mx-3`}>
                <div className={`h-full w-[100%] rounded-full ${isLight ? 'bg-teal-600' : 'bg-teal-400'}`} />
              </div>
              <span className={`w-12 text-right font-mono tabular-nums font-medium ${isLight ? 'text-slate-500' : 'text-[#A9BFA5]/70'}`}>100%</span>
            </div>

            <div 
              onClick={() => onNavigate('leads', 'pipeline')}
              className={`flex items-center justify-between p-2 rounded-md transition-colors cursor-pointer ${
                isLight ? 'hover:bg-slate-50' : 'hover:bg-[#081F1C]'
              }`}
            >
              <div className="flex items-center space-x-2 w-28">
                <span className={`font-medium ${isLight ? 'text-slate-800' : 'text-white'}`}>Engaged</span>
                <span className={`tabular-nums font-mono ${isLight ? 'text-slate-500' : 'text-[#A9BFA5]/70'}`}>{Math.round(kpiData.newLeads * 0.63)}</span>
              </div>
              <div className={`flex-1 ${isLight ? 'bg-slate-100' : 'bg-[#041210]'} h-2.5 rounded-full overflow-hidden mx-3`}>
                <div className={`h-full w-[63%] rounded-full ${isLight ? 'bg-teal-600' : 'bg-teal-400'}`} />
              </div>
              <span className={`w-12 text-right font-mono tabular-nums font-medium ${isLight ? 'text-slate-500' : 'text-[#A9BFA5]/70'}`}>63%</span>
            </div>

            <div 
              onClick={() => onNavigate('leads', 'pipeline')}
              className={`flex items-center justify-between p-2 rounded-md transition-colors cursor-pointer ${
                isLight ? 'hover:bg-slate-50' : 'hover:bg-[#081F1C]'
              }`}
            >
              <div className="flex items-center space-x-2 w-28">
                <span className={`font-medium ${isLight ? 'text-slate-800' : 'text-white'}`}>Qualified</span>
                <span className={`tabular-nums font-mono ${isLight ? 'text-slate-500' : 'text-[#A9BFA5]/70'}`}>{kpiData.qualified}</span>
              </div>
              <div className={`flex-1 ${isLight ? 'bg-slate-100' : 'bg-[#041210]'} h-2.5 rounded-full overflow-hidden mx-3`}>
                <div className={`h-full w-[41%] rounded-full ${isLight ? 'bg-teal-600' : 'bg-teal-400'}`} />
              </div>
              <span className={`w-12 text-right font-mono tabular-nums font-medium ${isLight ? 'text-slate-500' : 'text-[#A9BFA5]/70'}`}>{kpiData.qualRate}</span>
            </div>

            <div 
              onClick={() => onNavigate('leads', 'pipeline')}
              className={`flex items-center justify-between p-2 rounded-md transition-colors cursor-pointer ${
                isLight ? 'hover:bg-slate-50' : 'hover:bg-[#081F1C]'
              }`}
            >
              <div className="flex items-center space-x-2 w-28">
                <span className={`font-medium ${isLight ? 'text-slate-800' : 'text-white'}`}>Won</span>
                <span className={`tabular-nums font-mono ${isLight ? 'text-slate-500' : 'text-[#A9BFA5]/70'}`}>{kpiData.won}</span>
              </div>
              <div className={`flex-1 ${isLight ? 'bg-slate-100' : 'bg-[#041210]'} h-2.5 rounded-full overflow-hidden mx-3`}>
                <div className={`h-full w-[25%] rounded-full ${isLight ? 'bg-teal-600' : 'bg-teal-400'}`} />
              </div>
              <span className={`w-12 text-right font-mono tabular-nums font-medium ${isLight ? 'text-slate-500' : 'text-[#A9BFA5]/70'}`}>
                {Math.round((kpiData.won / kpiData.newLeads) * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* Channels (~50%) */}
        <div className={`lg:col-span-6 p-5 rounded-lg border space-y-3 ${
          isLight
            ? 'bg-white border-slate-200 shadow-2xs'
            : 'bg-[#071C1A] border-[rgba(169,191,165,0.18)]'
        }`}>
          <div className={`pb-2.5 border-b ${
            isLight ? 'border-slate-100' : 'border-[rgba(169,191,165,0.12)]'
          }`}>
            <span className={`text-xs font-bold uppercase tracking-wider block ${
              isLight ? 'text-slate-700' : 'text-[#A9BFA5]'
            }`}>
              CHANNELS
            </span>
          </div>

          <div className={`divide-y text-xs ${
            isLight ? 'divide-slate-100' : 'divide-[rgba(169,191,165,0.12)]'
          }`}>
            <div 
              onClick={() => onNavigate('leads', 'all-leads')}
              className={`py-2.5 px-2 flex items-center justify-between rounded-md transition-colors cursor-pointer ${
                isLight ? 'hover:bg-slate-50' : 'hover:bg-[#081F1C]'
              }`}
            >
              <span className={`font-medium ${isLight ? 'text-slate-800' : 'text-white'}`}>WhatsApp</span>
              <span className={`tabular-nums font-mono ${isLight ? 'text-slate-500' : 'text-[#A9BFA5]'}`}>
                {Math.round(kpiData.newLeads * 0.48)} leads · 43% qual
              </span>
            </div>

            <div 
              onClick={() => onNavigate('leads', 'all-leads')}
              className={`py-2.5 px-2 flex items-center justify-between rounded-md transition-colors cursor-pointer ${
                isLight ? 'hover:bg-slate-50' : 'hover:bg-[#081F1C]'
              }`}
            >
              <span className={`font-medium ${isLight ? 'text-slate-800' : 'text-white'}`}>Instagram</span>
              <span className={`tabular-nums font-mono ${isLight ? 'text-slate-500' : 'text-[#A9BFA5]'}`}>
                {Math.round(kpiData.newLeads * 0.31)} leads · 30% qual
              </span>
            </div>

            <div 
              onClick={() => onNavigate('leads', 'all-leads')}
              className={`py-2.5 px-2 flex items-center justify-between rounded-md transition-colors cursor-pointer ${
                isLight ? 'hover:bg-slate-50' : 'hover:bg-[#081F1C]'
              }`}
            >
              <span className={`font-medium ${isLight ? 'text-slate-800' : 'text-white'}`}>Website</span>
              <span className={`tabular-nums font-mono ${isLight ? 'text-slate-500' : 'text-[#A9BFA5]'}`}>
                {Math.round(kpiData.newLeads * 0.14)} leads · 22% qual
              </span>
            </div>

            <div 
              onClick={() => onNavigate('leads', 'all-leads')}
              className={`py-2.5 px-2 flex items-center justify-between rounded-md transition-colors cursor-pointer ${
                isLight ? 'hover:bg-slate-50' : 'hover:bg-[#081F1C]'
              }`}
            >
              <span className={`font-medium ${isLight ? 'text-slate-800' : 'text-white'}`}>LinkedIn</span>
              <span className={`tabular-nums font-mono ${isLight ? 'text-slate-500' : 'text-[#A9BFA5]'}`}>
                {Math.max(1, Math.round(kpiData.newLeads * 0.07))} leads · 45% qual
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* ========================================================
          6. RECENT ACTIVITY (Decided date window & sorted on that basis!)
         ======================================================== */}
      <div className={`p-5 rounded-lg border space-y-3 ${
        isLight
          ? 'bg-white border-slate-200 shadow-2xs'
          : 'bg-[#071C1A] border-[rgba(169,191,165,0.18)]'
      }`}>
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b gap-2 ${
          isLight ? 'border-slate-100' : 'border-[rgba(169,191,165,0.12)]'
        }`}>
          <div className="flex items-center space-x-2">
            <span className={`text-xs font-bold uppercase tracking-wider ${
              isLight ? 'text-slate-700' : 'text-[#A9BFA5]'
            }`}>
              RECENT ACTIVITY
            </span>
            <span className={`text-[11px] font-mono ${
              isLight ? 'text-teal-600 font-semibold' : 'text-teal-400'
            }`}>
              ({filteredActivities.length} records · sorted {customRange.sortBasis})
            </span>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            <button
              type="button"
              onClick={() => setIsCalendarOpen(true)}
              className={`flex items-center space-x-1 cursor-pointer font-medium transition-colors ${
                isLight ? 'text-slate-600 hover:text-slate-900' : 'text-[#A9BFA5] hover:text-white'
              }`}
            >
              <SlidersHorizontal className={`w-3.5 h-3.5 ${isLight ? 'text-teal-600' : 'text-teal-400'}`} />
              <span>Change window & sort</span>
            </button>
            <span className={isLight ? 'text-slate-300' : 'text-[rgba(169,191,165,0.3)]'}>|</span>
            <button
              type="button"
              onClick={() => onNavigate('analytics', 'activity-log')}
              className={`font-semibold flex items-center space-x-1 cursor-pointer transition-colors hover:underline ${
                isLight ? 'text-teal-600' : 'text-teal-400'
              }`}
            >
              <span>View all in analytics</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Activity rows sorted on that basis */}
        {filteredActivities.length > 0 ? (
          <div className={`divide-y text-xs ${
            isLight ? 'divide-slate-100' : 'divide-[rgba(169,191,165,0.1)]'
          }`}>
            {filteredActivities.map((act) => (
              <div 
                key={act.id}
                onClick={() => onNavigate(act.category, act.subCategory)}
                className={`py-2.5 px-2 flex flex-col sm:flex-row sm:items-center justify-between rounded-md transition-colors cursor-pointer gap-1.5 sm:gap-2 ${
                  isLight ? 'hover:bg-slate-50' : 'hover:bg-[#081F1C]'
                }`}
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <span className={`text-[10px] px-2 py-0.5 rounded border font-mono font-semibold shrink-0 tabular-nums ${
                    isLight
                      ? 'bg-slate-100 border-slate-200 text-slate-700'
                      : 'bg-[#041210] border-[rgba(169,191,165,0.2)] text-[#A9BFA5]'
                  }`}>
                    {act.isoDate}
                  </span>
                  <span className={`text-[11px] shrink-0 font-mono font-semibold tabular-nums ${
                    isLight ? 'text-slate-500' : 'text-[#A9BFA5]'
                  }`}>
                    {act.timeStr}
                  </span>
                  <span className={`${act.iconColor} shrink-0`}>
                    {act.icon}
                  </span>
                  <span className={`truncate font-medium ${
                    isLight ? 'text-slate-800' : 'text-[#E8E9D8]'
                  }`}>
                    {act.description}
                  </span>
                </div>

                <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto text-[11px]">
                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold border tabular-nums ${getScoreBadge(act.score).bg}`}>
                    Score {act.score}
                  </span>
                  <span className={`text-[11px] font-mono tabular-nums ${
                    isLight ? 'text-slate-400 font-medium' : 'text-[#A9BFA5]/60'
                  }`}>
                    {act.relativeTime}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-xs space-y-2">
            <p className={isLight ? 'text-slate-500' : 'text-[#A9BFA5]/60'}>
              No activity events recorded between {customRange.startDate} and {customRange.endDate}.
            </p>
            <button
              type="button"
              onClick={() => setIsCalendarOpen(true)}
              className="text-teal-600 dark:text-teal-400 underline cursor-pointer font-semibold"
            >
              Adjust calendar date range →
            </button>
          </div>
        )}
      </div>

      {/* Date Range & Calendar Selection Modal */}
      <DateRangeCalendarModal
        isOpen={isCalendarOpen}
        initialStartDate={customRange.startDate}
        initialEndDate={customRange.endDate}
        initialSortBasis={customRange.sortBasis}
        onClose={() => setIsCalendarOpen(false)}
        onApply={handleApplyCalendarSelection}
      />

    </div>
  );
}
