import React, { useState } from 'react';
import { 
  BarChart3, 
  Activity, 
  PieChart, 
  TrendingUp, 
  Calendar, 
  ChevronDown, 
  Download, 
  Clock, 
  ExternalLink,
  Search,
  Filter
} from 'lucide-react';
import { SubCategory, StatMetric } from '../../types';

interface AnalyticsViewProps {
  activeSubCategory: SubCategory;
  onNavigateSub: (sub: SubCategory) => void;
  metrics: StatMetric[];
}

export type AnalyticsTab = 'overview' | 'leads' | 'channels' | 'activity';

export default function AnalyticsView({
  activeSubCategory,
  onNavigateSub,
  metrics
}: AnalyticsViewProps) {
  // Active Tab
  const initialTab: AnalyticsTab = 
    activeSubCategory === 'leads' || activeSubCategory === 'lead-analytics' ? 'leads' :
    activeSubCategory === 'channels' || activeSubCategory === 'channel-performance' ? 'channels' :
    activeSubCategory === 'activity-log' || activeSubCategory === 'stats' ? 'activity' : 'overview';

  const [currentTab, setCurrentTab] = useState<AnalyticsTab>(initialTab);
  const [dateRange, setDateRange] = useState('Last 30 days');

  return (
    <div className="space-y-6 pb-12 animate-fadeIn text-[#E8E9D8] select-text font-mono">
      
      {/* ========================================================
          HEADER & 4 TABS (Page 32 spec)
          Analytics [Overview] [Leads] [Channels] [Activity] [Last 30 days ▼] [Export ▼]
         ======================================================== */}
      <div className="border-b border-[rgba(169,191,165,0.2)] pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Left: Title & 4 Tabs */}
        <div className="flex items-center space-x-2 sm:space-x-3 overflow-x-auto pb-1 sm:pb-0">
          <span className="serif text-2xl font-light text-white mr-1 tracking-tight">
            Analytics
          </span>

          <button
            type="button"
            onClick={() => {
              setCurrentTab('overview');
              onNavigateSub('overview');
            }}
            className={`px-3 py-1.5 rounded-[2px] text-xs uppercase tracking-wider transition-colors cursor-pointer ${
              currentTab === 'overview'
                ? 'bg-[#E8E9D8] text-[#071C1A] font-semibold'
                : 'bg-[#061816] text-[#A9BFA5] border border-[rgba(169,191,165,0.2)] hover:border-[#A9BFA5]'
            }`}
          >
            Overview
          </button>

          <button
            type="button"
            onClick={() => {
              setCurrentTab('leads');
              onNavigateSub('leads');
            }}
            className={`px-3 py-1.5 rounded-[2px] text-xs uppercase tracking-wider transition-colors cursor-pointer ${
              currentTab === 'leads'
                ? 'bg-[#E8E9D8] text-[#071C1A] font-semibold'
                : 'bg-[#061816] text-[#A9BFA5] border border-[rgba(169,191,165,0.2)] hover:border-[#A9BFA5]'
            }`}
          >
            Leads
          </button>

          <button
            type="button"
            onClick={() => {
              setCurrentTab('channels');
              onNavigateSub('channels');
            }}
            className={`px-3 py-1.5 rounded-[2px] text-xs uppercase tracking-wider transition-colors cursor-pointer ${
              currentTab === 'channels'
                ? 'bg-[#E8E9D8] text-[#071C1A] font-semibold'
                : 'bg-[#061816] text-[#A9BFA5] border border-[rgba(169,191,165,0.2)] hover:border-[#A9BFA5]'
            }`}
          >
            Channels
          </button>

          <button
            type="button"
            onClick={() => {
              setCurrentTab('activity');
              onNavigateSub('activity-log');
            }}
            className={`px-3 py-1.5 rounded-[2px] text-xs uppercase tracking-wider transition-colors cursor-pointer ${
              currentTab === 'activity'
                ? 'bg-[#E8E9D8] text-[#071C1A] font-semibold'
                : 'bg-[#061816] text-[#A9BFA5] border border-[rgba(169,191,165,0.2)] hover:border-[#A9BFA5]'
            }`}
          >
            Activity
          </button>
        </div>

        {/* Right: Date Range & Export */}
        <div className="flex items-center space-x-2.5 shrink-0 text-xs">
          <div className="relative">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-[#061816] border border-[rgba(169,191,165,0.25)] text-[#E8E9D8] px-3 py-1.5 rounded-[2px] focus:outline-none cursor-pointer pr-7 appearance-none font-mono"
            >
              <option value="Today">Today</option>
              <option value="7 days">7 days</option>
              <option value="Last 30 days">Last 30 days</option>
              <option value="90 days">90 days</option>
              <option value="This quarter">This quarter</option>
              <option value="Custom">Custom</option>
            </select>
            <ChevronDown className="w-3 h-3 text-[#A9BFA5]/60 absolute right-2 top-2.5 pointer-events-none" />
          </div>

          <button
            type="button"
            onClick={() => alert('Exporting CSV analytics data...')}
            className="px-3 py-1.5 bg-[#061816] hover:bg-[#0D2D2A] border border-[rgba(169,191,165,0.25)] text-[#E8E9D8] rounded-[2px] cursor-pointer flex items-center space-x-1"
          >
            <Download className="w-3 h-3" />
            <span>Export ▼</span>
          </button>
        </div>

      </div>

      {/* ========================================================
          TAB 1: OVERVIEW (Page 32 spec)
         ======================================================== */}
      {currentTab === 'overview' && (
        <div className="space-y-6">
          
          {/* 5 KPI Cards Row (Page 32 spec) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="p-4 bg-[#061816] border border-[rgba(169,191,165,0.2)] rounded-[2px]">
              <span className="text-[10px] text-[#A9BFA5]/70 uppercase font-semibold block">LEADS</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl text-white font-light">86</span>
                <span className="text-xs text-emerald-400 font-semibold">↑ 18%</span>
              </div>
            </div>

            <div className="p-4 bg-[#061816] border border-[rgba(169,191,165,0.2)] rounded-[2px]">
              <span className="text-[10px] text-[#A9BFA5]/70 uppercase font-semibold block">QUALIFIED</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl text-white font-light">31</span>
                <span className="text-xs text-[#A9BFA5]/80">36%</span>
              </div>
            </div>

            <div className="p-4 bg-[#061816] border border-[rgba(169,191,165,0.2)] rounded-[2px]">
              <span className="text-[10px] text-[#A9BFA5]/70 uppercase font-semibold block">WON</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl text-white font-light">9</span>
                <span className="text-xs text-emerald-400 font-semibold">10.5%</span>
              </div>
            </div>

            <div className="p-4 bg-[#061816] border border-[rgba(169,191,165,0.2)] rounded-[2px]">
              <span className="text-[10px] text-[#A9BFA5]/70 uppercase font-semibold block">REVENUE</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl text-white font-light">₹8.6L</span>
                <span className="text-xs text-emerald-400 font-semibold">↑ 24%</span>
              </div>
            </div>

            <div className="p-4 bg-[#061816] border border-[rgba(169,191,165,0.2)] rounded-[2px] col-span-2 sm:col-span-1">
              <span className="text-[10px] text-[#A9BFA5]/70 uppercase font-semibold block">AI HANDLED</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl text-emerald-400 font-light">71%</span>
                <span className="text-xs text-[#A9BFA5]/80">Auto</span>
              </div>
            </div>
          </div>

          {/* Leads Over Time Chart Box */}
          <div className="p-5 bg-[#061816] border border-[rgba(169,191,165,0.2)] rounded-[2px] space-y-3">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-[rgba(169,191,165,0.12)]">
              <span className="uppercase text-[#A9BFA5]/80 font-semibold">LEADS OVER TIME</span>
              <div className="flex items-center space-x-4 text-[11px]">
                <span className="flex items-center space-x-1.5 text-white">
                  <span className="w-3 h-0.5 bg-emerald-400" />
                  <span>This period</span>
                </span>
                <span className="flex items-center space-x-1.5 text-[#A9BFA5]/50">
                  <span className="w-3 h-0.5 border-t border-dashed border-[#A9BFA5]" />
                  <span>Previous</span>
                </span>
              </div>
            </div>

            {/* Sparkline Histogram */}
            <div className="h-32 flex items-end justify-between gap-1.5 pt-4">
              {[22, 34, 45, 68, 52, 78, 86, 74, 62, 88, 92, 104, 96, 112].map((val, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
                  <div 
                    className="w-full bg-[#0D2D2A] group-hover:bg-emerald-400 transition-colors rounded-t-[1px]"
                    style={{ height: `${(val / 112) * 100}%` }}
                  />
                  <span className="text-[9px] text-[#A9BFA5]/40">{idx + 1}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 2-Column: Funnel & Response */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
            <div className="p-5 bg-[#061816] border border-[rgba(169,191,165,0.2)] rounded-[2px] space-y-3">
              <span className="uppercase text-[#A9BFA5]/80 font-semibold block pb-2 border-b border-[rgba(169,191,165,0.12)]">
                FUNNEL CONVERSION
              </span>
              <div className="space-y-2 text-[#E8E9D8]">
                <div className="flex justify-between"><span>New (86)</span><span>100%</span></div>
                <div className="flex justify-between"><span>Engaged (54)</span><span>63%</span></div>
                <div className="flex justify-between"><span>Qualified (31)</span><span>36%</span></div>
                <div className="flex justify-between"><span>Contacted (18)</span><span>21%</span></div>
                <div className="flex justify-between text-emerald-300 font-semibold"><span>Won (9)</span><span>10.5%</span></div>
              </div>
            </div>

            <div className="p-5 bg-[#061816] border border-[rgba(169,191,165,0.2)] rounded-[2px] space-y-3">
              <span className="uppercase text-[#A9BFA5]/80 font-semibold block pb-2 border-b border-[rgba(169,191,165,0.12)]">
                SPEED & RESPONSE METRICS
              </span>
              <div className="space-y-3 pt-1">
                <div className="flex justify-between items-baseline">
                  <span className="text-[#A9BFA5]">Median first reply</span>
                  <span className="text-emerald-400 font-bold text-sm">40 s</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-[#A9BFA5]">Handoffs triggered</span>
                  <span className="text-white font-bold text-sm">23</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-[#A9BFA5]">Median human reply</span>
                  <span className="text-amber-300 font-bold text-sm">6 min</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================
          TAB 2: LEADS (Page 33 spec)
         ======================================================== */}
      {currentTab === 'leads' && (
        <div className="space-y-5 text-xs">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* By Source */}
            <div className="p-5 bg-[#061816] border border-[rgba(169,191,165,0.2)] rounded space-y-3">
              <span className="uppercase text-[#A9BFA5]/80 font-semibold block pb-2 border-b border-[rgba(169,191,165,0.12)]">
                BY SOURCE
              </span>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="w-24">WhatsApp</span>
                  <div className="flex-1 bg-[#071C1A] h-2.5 mx-3 rounded"><div className="bg-emerald-400 h-full w-[100%]" /></div>
                  <span className="w-8 text-right font-bold">42</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="w-24">Instagram</span>
                  <div className="flex-1 bg-[#071C1A] h-2.5 mx-3 rounded"><div className="bg-pink-400 h-full w-[64%]" /></div>
                  <span className="w-8 text-right font-bold">27</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="w-24">Website</span>
                  <div className="flex-1 bg-[#071C1A] h-2.5 mx-3 rounded"><div className="bg-teal-400 h-full w-[43%]" /></div>
                  <span className="w-8 text-right font-bold">18</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="w-24">LinkedIn</span>
                  <div className="flex-1 bg-[#071C1A] h-2.5 mx-3 rounded"><div className="bg-sky-400 h-full w-[26%]" /></div>
                  <span className="w-8 text-right font-bold">11</span>
                </div>
              </div>
            </div>

            {/* By Campaign */}
            <div className="p-5 bg-[#061816] border border-[rgba(169,191,165,0.2)] rounded space-y-3">
              <span className="uppercase text-[#A9BFA5]/80 font-semibold block pb-2 border-b border-[rgba(169,191,165,0.12)]">
                BY CAMPAIGN
              </span>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="w-32 truncate">Diwali offer</span>
                  <div className="flex-1 bg-[#071C1A] h-2.5 mx-3 rounded"><div className="bg-amber-400 h-full w-[100%]" /></div>
                  <span className="w-8 text-right font-bold">42</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="w-32 truncate">Reactivate 2025</span>
                  <div className="flex-1 bg-[#071C1A] h-2.5 mx-3 rounded"><div className="bg-emerald-400 h-full w-[42%]" /></div>
                  <span className="w-8 text-right font-bold">18</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="w-32 truncate">No campaign</span>
                  <div className="flex-1 bg-[#071C1A] h-2.5 mx-3 rounded"><div className="bg-[#A9BFA5] h-full w-[61%]" /></div>
                  <span className="w-8 text-right font-bold">26</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="p-5 bg-[#061816] border border-[rgba(169,191,165,0.2)] rounded space-y-2">
              <span className="uppercase text-[#A9BFA5]/80 font-semibold block pb-1 border-b border-[rgba(169,191,165,0.12)]">
                TIME IN STAGE (MEDIAN DAYS)
              </span>
              <p className="text-white pt-2 leading-relaxed">
                New: 0.5d · Engaged: 1.2d · Qualified: 3.4d · Contacted: 6.0d
              </p>
            </div>

            <div className="p-5 bg-[#061816] border border-[rgba(169,191,165,0.2)] rounded space-y-2">
              <span className="uppercase text-[#A9BFA5]/80 font-semibold block pb-1 border-b border-[rgba(169,191,165,0.12)]">
                LOST REASONS
              </span>
              <p className="text-[#A9BFA5] pt-2 leading-relaxed">
                Price: 9 · No reply: 7 · Timing: 4 · Chose competitor: 3
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 3: CHANNELS (Page 33 spec)
         ======================================================== */}
      {currentTab === 'channels' && (
        <div className="space-y-4 text-xs">
          <div className="border border-[rgba(169,191,165,0.2)] bg-[#061816] rounded overflow-x-auto">
            <div className="min-w-[700px] grid grid-cols-12 px-5 py-3 bg-[#071C1A] border-b border-[rgba(169,191,165,0.15)] text-[10px] uppercase font-semibold text-[#A9BFA5]">
              <div className="col-span-3">Channel</div>
              <div className="col-span-2 text-right">Conversations</div>
              <div className="col-span-2 text-right">Leads</div>
              <div className="col-span-2 text-right">Qualified</div>
              <div className="col-span-1 text-right">Won</div>
              <div className="col-span-1 text-right">Conv. %</div>
              <div className="col-span-1 text-right">Avg reply</div>
            </div>

            <div className="divide-y divide-[rgba(169,191,165,0.1)]">
              {[
                { name: 'WhatsApp', conv: 120, leads: 42, qual: 18, won: 4, convRate: '43%', reply: '35 s' },
                { name: 'Instagram', conv: 84, leads: 27, qual: 8, won: 2, convRate: '30%', reply: '1m 10s' },
                { name: 'Website', conv: 51, leads: 18, qual: 4, won: 2, convRate: '22%', reply: '50 s' },
                { name: 'LinkedIn', conv: 30, leads: 11, qual: 5, won: 1, convRate: '45%', reply: '4 min' }
              ].map(c => (
                <div key={c.name} className="min-w-[700px] grid grid-cols-12 px-5 py-3 items-center hover:bg-[#0D2D2A]/30">
                  <div className="col-span-3 font-semibold text-white">{c.name}</div>
                  <div className="col-span-2 text-right text-[#A9BFA5]">{c.conv}</div>
                  <div className="col-span-2 text-right text-white font-bold">{c.leads}</div>
                  <div className="col-span-2 text-right text-emerald-400 font-bold">{c.qual}</div>
                  <div className="col-span-1 text-right text-white">{c.won}</div>
                  <div className="col-span-1 text-right text-emerald-300">{c.convRate}</div>
                  <div className="col-span-1 text-right text-[#A9BFA5]/80">{c.reply}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-[#061816] border border-emerald-500/30 rounded text-xs text-emerald-200">
            ✦ Insight: WhatsApp brings the most qualified leads; LinkedIn converts best.
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 4: ACTIVITY (Page 33 spec)
         ======================================================== */}
      {currentTab === 'activity' && (
        <div className="space-y-4 text-xs">
          <div className="p-5 bg-[#061816] border border-[rgba(169,191,165,0.2)] rounded space-y-4">
            <span className="uppercase text-[#A9BFA5]/80 font-semibold block pb-2 border-b border-[rgba(169,191,165,0.12)]">
              TODAY'S ACTIVITY LOG
            </span>

            <div className="divide-y divide-[rgba(169,191,165,0.1)]">
              <div className="py-3 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <span className="text-[#A9BFA5]/70">10:42</span>
                  <span className="text-emerald-400">＋</span>
                  <span className="text-white">New WhatsApp lead · Rahul Sharma</span>
                </div>
                <span className="text-emerald-300 hover:underline cursor-pointer">[Open]</span>
              </div>

              <div className="py-3 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <span className="text-[#A9BFA5]/70">10:36</span>
                  <span className="text-emerald-400">✦</span>
                  <span className="text-white">AI qualified Aster Labs as Hot · score 92</span>
                </div>
                <span className="text-emerald-300 hover:underline cursor-pointer">[Open]</span>
              </div>

              <div className="py-3 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <span className="text-[#A9BFA5]/70">10:18</span>
                  <span className="text-amber-400">👤</span>
                  <span className="text-white">Handoff requested · John Carter · Instagram</span>
                </div>
                <span className="text-emerald-300 hover:underline cursor-pointer">[Open]</span>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
