import React, { useState, useMemo, useEffect } from 'react';
import { 
  TrendingUp, 
  ArrowUpRight, 
  Filter, 
  Search, 
  CheckCircle2, 
  Clock, 
  ExternalLink,
  Plus,
  Sparkles,
  ArrowRight,
  Eye
} from 'lucide-react';
import { Lead, TrendingTopic, StatMetric, SubCategory } from '../../types';
import StatsView from './StatsView';
import Pagination from './Pagination';

interface InsightsViewProps {
  activeSubCategory: SubCategory;
  metrics: StatMetric[];
  leads: Lead[];
  trendingTopics: TrendingTopic[];
  onTriggerQuickAction: (action: 'campaign' | 'content' | 'lead' | 'schedule') => void;
  onSelectLead: (lead: Lead) => void;
  onNavigateSub: (sub: SubCategory) => void;
}

export default function InsightsView({
  activeSubCategory,
  metrics,
  leads,
  trendingTopics,
  onTriggerQuickAction,
  onSelectLead,
  onNavigateSub
}: InsightsViewProps) {
  // Live Leads states
  const [leadSearch, setLeadSearch] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('All');
  const [leadPage, setLeadPage] = useState(1);
  const [leadPageSize, setLeadPageSize] = useState(5);

  // Trending Topics pagination state
  const [topicPage, setTopicPage] = useState(1);
  const topicPageSize = 3;

  // Reset pagination when filter or search changes
  useEffect(() => {
    setLeadPage(1);
  }, [leadSearch, selectedStatusFilter]);

  // Filter leads for Live Leads view
  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      const matchesSearch = l.name.toLowerCase().includes(leadSearch.toLowerCase()) ||
                            l.company.toLowerCase().includes(leadSearch.toLowerCase()) ||
                            l.source.toLowerCase().includes(leadSearch.toLowerCase());
      const matchesFilter = selectedStatusFilter === 'All' || l.status.toLowerCase() === selectedStatusFilter.toLowerCase();
      return matchesSearch && matchesFilter;
    });
  }, [leads, leadSearch, selectedStatusFilter]);

  const paginatedLeads = useMemo(() => {
    const start = (leadPage - 1) * leadPageSize;
    return filteredLeads.slice(start, start + leadPageSize);
  }, [filteredLeads, leadPage, leadPageSize]);

  const paginatedTopics = useMemo(() => {
    const start = (topicPage - 1) * topicPageSize;
    return trendingTopics.slice(start, start + topicPageSize);
  }, [trendingTopics, topicPage, topicPageSize]);

  const getStatusBadgeStyle = (status: Lead['status']) => {
    switch (status) {
      case 'Qualified':
        return 'text-emerald-400 border-emerald-500/30 bg-emerald-950/20';
      case 'Proposal':
        return 'text-amber-300 border-amber-500/30 bg-amber-950/20';
      case 'Converted':
        return 'text-[#E8E9D8] border-[#A9BFA5]/40 bg-[#0D2D2A]/60';
      case 'Contacted':
        return 'text-sky-300 border-sky-500/30 bg-sky-950/20';
      case 'New':
      default:
        return 'text-[#A9BFA5] border-[rgba(169,191,165,0.25)] bg-[#071C1A]';
    }
  };

  // Determine current view inside Insights: default is 'live-leads'
  const isLiveLeadsView = !activeSubCategory || activeSubCategory === 'overview' || activeSubCategory === 'live-leads';
  const isStatsView = activeSubCategory === 'stats';
  const isTrendingTopicsView = activeSubCategory === 'trending-topics';

  /* =========================================================================
     1. LIVE LEADS VIEW (DEFAULT SCREEN AFTER LOGIN)
     Shows ONLY Live Leads. No Stats or Trending Topics.
     ========================================================================= */
  if (isLiveLeadsView) {
    return (
      <div className="space-y-8 py-4 animate-fadeIn">
        {/* Header */}
        <section className="border-b border-[rgba(169,191,165,0.2)] pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <span className="text-[10px] sm:text-xs uppercase tracking-widest-plus text-[#A9BFA5] font-normal block mb-2">
              INSIGHTS // REAL-TIME INBOUND
            </span>
            <h1 className="serif text-4xl sm:text-5xl font-light text-[#E8E9D8] tracking-tight">
              Live Leads
            </h1>
            <p className="mt-3 text-xs sm:text-sm text-[#A9BFA5]/80 font-light leading-relaxed max-w-xl">
              Monitor incoming leads and take action in real time.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => onTriggerQuickAction('lead')}
              className="bg-[#E8E9D8] text-[#071C1A] px-5 py-2.5 rounded-[2px] font-semibold uppercase tracking-widest text-xs hover:bg-white transition-colors cursor-pointer flex items-center space-x-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Lead</span>
            </button>
          </div>
        </section>

        {/* Live Leads Controls Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[rgba(169,191,165,0.15)] text-xs">
          <div className="flex items-center space-x-3">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Filter by lead name, studio, channel..."
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
                className="bg-[#071C1A] border border-[rgba(169,191,165,0.2)] text-[#E8E9D8] text-xs px-3 py-1.5 pl-8 rounded-[2px] focus:outline-none focus:border-[#A9BFA5] placeholder-[#A9BFA5]/40 font-light w-64 sm:w-80"
              />
              <Search className="w-3.5 h-3.5 text-[#A9BFA5]/50 absolute left-2.5 top-2.5 pointer-events-none" />
            </div>

            {/* Status Filter */}
            <div className="flex items-center space-x-2">
              <Filter className="w-3 h-3 text-[#A9BFA5]/60" />
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="bg-[#071C1A] border border-[rgba(169,191,165,0.2)] text-[#A9BFA5] text-xs px-2.5 py-1.5 rounded-[2px] focus:outline-none focus:border-[#A9BFA5] cursor-pointer"
              >
                <option value="All">All Statuses</option>
                <option value="New">NEW</option>
                <option value="Contacted">CONTACTED</option>
                <option value="Qualified">QUALIFIED</option>
                <option value="Proposal">PROPOSAL</option>
                <option value="Converted">CONVERTED</option>
              </select>
            </div>
          </div>

          <div className="text-[11px] font-mono text-[#A9BFA5]/70">
            Showing {filteredLeads.length} of {leads.length} incoming leads
          </div>
        </div>

        {/* Live Leads Clean Workspace Table (Open layout, hairline dividers, no cards) */}
        <div className="border border-[rgba(169,191,165,0.2)] bg-[#071C1A] overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[rgba(169,191,165,0.2)] bg-[#061816] text-[10px] uppercase tracking-widest text-[#A9BFA5]/60 font-medium">
                <th className="py-3.5 px-6 font-medium">Lead</th>
                <th className="py-3.5 px-6 font-medium">Source</th>
                <th className="py-3.5 px-6 font-medium">Status</th>
                <th className="py-3.5 px-6 font-medium">Activity</th>
                <th className="py-3.5 px-6 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(169,191,165,0.15)] text-xs">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-xs text-[#A9BFA5]/50 font-light">
                    No incoming leads match the selected query.
                  </td>
                </tr>
              ) : (
                paginatedLeads.map((lead) => (
                  <tr 
                    key={lead.id}
                    className="hover:bg-[#0D2D2A]/30 transition-colors group"
                  >
                    {/* Lead */}
                    <td className="py-4 px-6">
                      <div className="font-medium text-[#E8E9D8] group-hover:text-white transition-colors">
                        {lead.name}
                      </div>
                      <div className="text-[11px] text-[#A9BFA5]/70 font-light mt-0.5">
                        {lead.company}
                      </div>
                    </td>

                    {/* Source */}
                    <td className="py-4 px-6 text-[#A9BFA5] font-light">
                      {lead.source}
                    </td>

                    {/* Status */}
                    <td className="py-4 px-6">
                      <span className={`inline-block text-[9px] uppercase tracking-wider px-2 py-0.5 border rounded-[1px] font-mono font-medium ${getStatusBadgeStyle(lead.status)}`}>
                        {lead.status.toUpperCase()}
                      </span>
                    </td>

                    {/* Activity */}
                    <td className="py-4 px-6 text-[#A9BFA5]/80 font-mono text-[11px]">
                      {lead.lastActivity}
                    </td>

                    {/* Action */}
                    <td className="py-4 px-6 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectLead(lead)}
                        className="text-xs uppercase tracking-widest text-[#E8E9D8] hover:text-white underline decoration-[#A9BFA5]/40 hover:decoration-[#E8E9D8] underline-offset-4 transition-all cursor-pointer font-medium"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {filteredLeads.length > 0 && (
            <Pagination
              currentPage={leadPage}
              totalItems={filteredLeads.length}
              pageSize={leadPageSize}
              onPageChange={setLeadPage}
              onPageSizeChange={setLeadPageSize}
              pageSizeOptions={[5, 10, 20]}
              itemName="leads"
            />
          )}
        </div>
      </div>
    );
  }

  /* =========================================================================
     2. STATS VIEW (DEDICATED VIEW ACCESSIBLE VIA INSIGHTS -> STATS)
     ========================================================================= */
  if (isStatsView) {
    return <StatsView />;
  }

  /* =========================================================================
     3. TRENDING TOPICS VIEW (ONLY VISIBLE WHEN INSIGHTS -> TRENDING TOPICS IS CLICKED)
     ========================================================================= */
  if (isTrendingTopicsView) {
    return (
      <div className="space-y-12 py-4 animate-fadeIn">
        {/* Header */}
        <section className="border-b border-[rgba(169,191,165,0.2)] pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <span className="text-[10px] sm:text-xs uppercase tracking-widest-plus text-[#A9BFA5] font-normal block mb-2">
              INSIGHTS // MARKET RADAR
            </span>
            <h1 className="serif text-4xl sm:text-5xl font-light text-[#E8E9D8] tracking-tight">
              Trending Topics
            </h1>
            <p className="mt-3 text-xs sm:text-sm text-[#A9BFA5]/80 font-light leading-relaxed max-w-xl">
              Analyze market signals and audience interest topics impacting your campaigns.
            </p>
          </div>

          <div className="text-[11px] font-mono text-[#A9BFA5]/70">
            Radar synchronized · 15m cadence
          </div>
        </section>

        {/* Dedicated Trending Topics List */}
        <div className="border border-[rgba(169,191,165,0.2)] bg-[#071C1A]">
          <div className="divide-y divide-[rgba(169,191,165,0.15)]">
            {paginatedTopics.map((topic, index) => {
              const actualIdx = (topicPage - 1) * topicPageSize + index;
              return (
                <div 
                  key={topic.id} 
                  className="p-6 hover:bg-[#0D2D2A]/20 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center space-x-3">
                      <span className="font-mono text-[10px] text-[#A9BFA5]/50">
                        0{actualIdx + 1}
                      </span>
                      <span className="text-[10px] uppercase tracking-widest font-mono px-2 py-0.5 border border-[rgba(169,191,165,0.2)] text-[#A9BFA5]">
                        {topic.category}
                      </span>
                      <span className="text-[10px] text-[#A9BFA5]/60 font-mono">
                        {topic.volume}
                      </span>
                    </div>

                    <h3 className="serif text-xl font-light text-[#E8E9D8]">
                      {topic.name}
                    </h3>

                    <p className="text-xs text-[#A9BFA5]/80 font-light max-w-2xl leading-relaxed">
                      {topic.relevantCampaign}
                    </p>
                  </div>

                  <div className="flex items-center space-x-6 shrink-0 pt-2 md:pt-0">
                    <div className="text-right">
                      <span className="text-[10px] uppercase tracking-widest text-[#A9BFA5]/60 block">Growth Signal</span>
                      <span className="font-mono text-sm text-emerald-400 font-medium">
                        {topic.growth}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onTriggerQuickAction('content')}
                      className="text-xs uppercase tracking-widest text-[#E8E9D8] border border-[rgba(169,191,165,0.3)] hover:border-[#E8E9D8] px-4 py-2 transition-colors cursor-pointer"
                    >
                      Draft Asset &rarr;
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {trendingTopics.length > 0 && (
            <Pagination
              currentPage={topicPage}
              totalItems={trendingTopics.length}
              pageSize={topicPageSize}
              onPageChange={setTopicPage}
              showPageSize={false}
              itemName="topics"
            />
          )}
        </div>
      </div>
    );
  }

  return null;
}
