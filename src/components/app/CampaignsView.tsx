import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  Filter,
  FileText,
  TrendingUp,
  User,
  Calendar,
  SlidersHorizontal,
  ArrowUpDown,
  X,
  Check,
  RotateCcw,
  Activity,
  CalendarRange,
  Clock3
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { Campaign, CampaignBlueprint, SubCategory } from '../../types';
import CampaignCreationFlow from './CampaignCreationFlow';
import CampaignBlueprintView from './CampaignBlueprintView';
import Pagination from './Pagination';
import { SAMPLE_BLUEPRINT, generateBlueprintFromForm } from '../../data/campaignBlueprintGenerator';
import DateRangeCalendarModal, { DateRangeSelection } from './DateRangeCalendarModal';

export type TimelineFilterOption = 'All' | 'Active' | 'Upcoming' | 'Concluded' | 'Q2' | 'Q3' | 'Custom';
export type ProgressFilterOption = 'All' | 'NotStarted' | 'Early' | 'InProgress' | 'Advanced' | 'Completed';
export type SortOption = 'Default' | 'ProgressDesc' | 'ProgressAsc' | 'StartNewest' | 'StartOldest' | 'EndingSoonest' | 'NameAsc';

interface CampaignsViewProps {
  campaigns: Campaign[];
  activeSubCategory?: SubCategory;
  onAddCampaign: (newCamp: Campaign) => void;
  onUpdateCampaign?: (updatedCamp: Campaign) => void;
  onNavigateToModule?: (category: string, subCategory?: string) => void;
  isFirstRun?: boolean;
  companyName?: string;
  initialFormPatch?: Partial<import('../../data/campaignBlueprintGenerator').CampaignFormData>;
}

function parseCampaignDate(dateStr?: string): Date | null {
  if (!dateStr || dateStr.trim().toLowerCase() === 'ongoing') return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function getCampaignTimelineState(campaign: Campaign): 'active' | 'upcoming' | 'concluded' {
  if (campaign.status === 'Completed' || campaign.progress === 100) {
    return 'concluded';
  }
  if (campaign.status === 'Active') {
    return 'active';
  }
  if (campaign.status === 'Planning' || campaign.status === 'Draft') {
    return 'upcoming';
  }
  
  const now = new Date('2026-06-15');
  const start = parseCampaignDate(campaign.startDate);
  const end = parseCampaignDate(campaign.endDate);
  
  if (start && start > now) return 'upcoming';
  if (end && end < now) return 'concluded';
  return 'active';
}

export default function CampaignsView({
  campaigns,
  activeSubCategory,
  onAddCampaign,
  onUpdateCampaign,
  onNavigateToModule,
  isFirstRun = false,
  companyName,
  initialFormPatch,
}: CampaignsViewProps) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  // Navigation mode within Campaigns: 'landing' | 'create' | 'blueprint'
  const [viewMode, setViewMode] = useState<'landing' | 'create' | 'blueprint'>('landing');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  // Status Filter
  const [statusFilter, setStatusFilter] = useState<'All' | 'Draft' | 'Planning' | 'Active' | 'Completed'>('All');
  
  // Timeline Filter
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilterOption>('All');
  const [isCustomDateOpen, setIsCustomDateOpen] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('2026-05-01');
  const [customEndDate, setCustomEndDate] = useState('2026-08-31');
  const [pendingStartDate, setPendingStartDate] = useState('2026-05-01');
  const [pendingEndDate, setPendingEndDate] = useState('2026-08-31');

  // Progress Filter
  const [progressFilter, setProgressFilter] = useState<ProgressFilterOption>('All');
  const [minProgress, setMinProgress] = useState<number>(0);

  // Search & Sorting
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('Default');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(5);

  // Sync with activeSubCategory from sidebar if provided
  useEffect(() => {
    if (activeSubCategory === 'create-campaign') {
      setViewMode('create');
    } else if (activeSubCategory === 'campaign-performance') {
      setViewMode('landing');
      setStatusFilter('Active');
    } else if (activeSubCategory === 'campaigns-list' || activeSubCategory === 'campaigns-overview') {
      setViewMode('landing');
    }
  }, [activeSubCategory]);

  const handleOpenCreate = () => {
    setViewMode('create');
  };

  const handleBlueprintGenerated = (newCampaign: Campaign, blueprint: CampaignBlueprint) => {
    onAddCampaign(newCampaign);
    setSelectedCampaign(newCampaign);
    setViewMode('blueprint');
  };

  const handleSelectCampaignForBlueprint = (campaign: Campaign) => {
    let campaignWithBp = campaign;
    if (!campaign.blueprint) {
      campaignWithBp = {
        ...campaign,
        blueprint: generateBlueprintFromForm({
          name: campaign.name,
          type: 'Product Launch',
          description: campaign.objective,
          primaryGoal: campaign.objective,
          measurableGoals: ['Acquire qualified accounts', 'Achieve >60% conversion velocity'],
          ageRange: '25–45',
          location: 'Global',
          industry: 'Technology & SaaS',
          interests: 'Growth, Automation, Minimal Operations',
          occupation: 'Founders, Product Leaders',
          audienceType: 'Decision Makers',
          audienceDescription: 'Discerning operators looking for calm execution.',
          budgetType: 'total',
          budgetAmount: campaign.budget.replace(/[^0-9]/g, '') || '3,000',
          resources: ['Website', 'Email list', 'Design assets', 'Sales team'],
          startDate: campaign.startDate,
          endDate: campaign.endDate || '2026-07-31',
          milestones: ['Campaign kickoff', 'Mid-flight review', 'Final synthesis'],
          channels: campaign.channel.split(',').map(c => c.trim()),
          autoRecommendChannels: false,
          brandVoice: 'Premium',
          visualStyle: 'Minimal',
          additionalInstructions: 'Refined editorial tone and high-contrast execution.'
        })
      };
    }
    setSelectedCampaign(campaignWithBp);
    setViewMode('blueprint');
  };

  const handleStartCampaign = () => {
    if (selectedCampaign) {
      const updated: Campaign = {
        ...selectedCampaign,
        status: 'Active',
        progress: selectedCampaign.progress < 20 ? 25 : selectedCampaign.progress
      };
      setSelectedCampaign(updated);
      onUpdateCampaign?.(updated);
    }
  };

  // Reset all applied filters
  const handleResetFilters = () => {
    setStatusFilter('All');
    setTimelineFilter('All');
    setProgressFilter('All');
    setMinProgress(0);
    setSearch('');
    setSortBy('Default');
    setIsCustomDateOpen(false);
    setCurrentPage(1);
  };

  // Reset to page 1 whenever any filter or search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, timelineFilter, progressFilter, minProgress, search, sortBy, customStartDate, customEndDate]);

  // Check if any non-default filter is currently active
  const isAnyFilterActive = 
    statusFilter !== 'All' || 
    timelineFilter !== 'All' || 
    progressFilter !== 'All' || 
    minProgress > 0 || 
    search.trim() !== '' ||
    sortBy !== 'Default';

  // Memoized Filtered and Sorted Campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(c => {
      // 1. Status Filter
      if (statusFilter !== 'All' && c.status !== statusFilter) {
        return false;
      }

      // 2. Search Filter
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesSearch = 
          c.name.toLowerCase().includes(query) || 
          c.objective.toLowerCase().includes(query) ||
          c.owner.toLowerCase().includes(query) ||
          c.channel.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // 3. Timeline Filter
      const timelineState = getCampaignTimelineState(c);
      const parsedStart = parseCampaignDate(c.startDate);
      const parsedEnd = parseCampaignDate(c.endDate);

      if (timelineFilter === 'Active' && timelineState !== 'active') {
        return false;
      }
      if (timelineFilter === 'Upcoming' && timelineState !== 'upcoming') {
        return false;
      }
      if (timelineFilter === 'Concluded' && timelineState !== 'concluded') {
        return false;
      }
      if (timelineFilter === 'Q2') {
        // Q2 2026: Apr 01 to Jun 30, 2026
        const qStart = new Date('2026-04-01');
        const qEnd = new Date('2026-06-30');
        const overlaps = (!parsedStart || parsedStart <= qEnd) && (!parsedEnd || parsedEnd >= qStart);
        if (!overlaps) return false;
      }
      if (timelineFilter === 'Q3') {
        // Q3 2026: Jul 01 to Sep 30, 2026
        const qStart = new Date('2026-07-01');
        const qEnd = new Date('2026-09-30');
        const overlaps = (!parsedStart || parsedStart <= qEnd) && (!parsedEnd || parsedEnd >= qStart);
        if (!overlaps) return false;
      }
      if (timelineFilter === 'Custom') {
        const fStart = new Date(customStartDate);
        const fEnd = new Date(customEndDate);
        const overlaps = (!parsedStart || parsedStart <= fEnd) && (!parsedEnd || parsedEnd >= fStart);
        if (!overlaps) return false;
      }

      // 4. Progress Filter (Bracket)
      if (progressFilter === 'NotStarted' && c.progress !== 0) {
        return false;
      }
      if (progressFilter === 'Early' && (c.progress <= 0 || c.progress > 25)) {
        return false;
      }
      if (progressFilter === 'InProgress' && (c.progress < 26 || c.progress > 74)) {
        return false;
      }
      if (progressFilter === 'Advanced' && (c.progress < 75 || c.progress > 99)) {
        return false;
      }
      if (progressFilter === 'Completed' && c.progress !== 100) {
        return false;
      }

      // 5. Min Progress Threshold
      if (minProgress > 0 && c.progress < minProgress) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      // Sorting
      switch (sortBy) {
        case 'ProgressDesc':
          return b.progress - a.progress;
        case 'ProgressAsc':
          return a.progress - b.progress;
        case 'StartNewest': {
          const tA = parseCampaignDate(a.startDate)?.getTime() || 0;
          const tB = parseCampaignDate(b.startDate)?.getTime() || 0;
          return tB - tA;
        }
        case 'StartOldest': {
          const tA = parseCampaignDate(a.startDate)?.getTime() || 0;
          const tB = parseCampaignDate(b.startDate)?.getTime() || 0;
          return tA - tB;
        }
        case 'EndingSoonest': {
          const tA = parseCampaignDate(a.endDate)?.getTime() || 9999999999999;
          const tB = parseCampaignDate(b.endDate)?.getTime() || 9999999999999;
          return tA - tB;
        }
        case 'NameAsc':
          return a.name.localeCompare(b.name);
        case 'Default':
        default:
          return 0;
      }
    });
  }, [campaigns, statusFilter, search, timelineFilter, customStartDate, customEndDate, progressFilter, minProgress, sortBy]);

  // Paginated campaigns slice for table display
  const paginatedCampaigns = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredCampaigns.slice(startIndex, startIndex + pageSize);
  }, [filteredCampaigns, currentPage, pageSize]);

  // Statistics counters for the current dataset
  const stats = useMemo(() => {
    const total = campaigns.length;
    const active = campaigns.filter(c => getCampaignTimelineState(c) === 'active').length;
    const upcoming = campaigns.filter(c => getCampaignTimelineState(c) === 'upcoming').length;
    const concluded = campaigns.filter(c => getCampaignTimelineState(c) === 'concluded').length;
    const avgProgress = total > 0 ? Math.round(campaigns.reduce((acc, c) => acc + c.progress, 0) / total) : 0;
    return { total, active, upcoming, concluded, avgProgress };
  }, [campaigns]);

  // Table header sort handlers
  const handleToggleSortTimeline = () => {
    if (sortBy === 'StartNewest') setSortBy('StartOldest');
    else if (sortBy === 'StartOldest') setSortBy('EndingSoonest');
    else if (sortBy === 'EndingSoonest') setSortBy('Default');
    else setSortBy('StartNewest');
  };

  const handleToggleSortProgress = () => {
    if (sortBy === 'ProgressDesc') setSortBy('ProgressAsc');
    else if (sortBy === 'ProgressAsc') setSortBy('Default');
    else setSortBy('ProgressDesc');
  };

  const handleToggleSortName = () => {
    if (sortBy === 'NameAsc') setSortBy('Default');
    else setSortBy('NameAsc');
  };

  /* =========================================================================
     VIEW ROUTE: CREATE NEW CAMPAIGN
     ========================================================================= */
  if (viewMode === 'create') {
    return (
      <CampaignCreationFlow
        onBack={() => setViewMode('landing')}
        onBlueprintGenerated={handleBlueprintGenerated}
        companyName={companyName}
        initialFormPatch={initialFormPatch}
      />
    );
  }

  /* =========================================================================
     VIEW ROUTE: AI CAMPAIGN BLUEPRINT
     ========================================================================= */
  if (viewMode === 'blueprint' && selectedCampaign?.blueprint) {
    return (
      <CampaignBlueprintView
        blueprint={selectedCampaign.blueprint}
        onBack={() => setViewMode('landing')}
        onEdit={() => setViewMode('create')}
        onRegenerate={() => {
          if (selectedCampaign?.blueprint) {
            handleSelectCampaignForBlueprint(selectedCampaign);
          }
        }}
        onStartCampaign={handleStartCampaign}
        onNavigateToModule={onNavigateToModule}
      />
    );
  }

  /* =========================================================================
     VIEW ROUTE: 1. CAMPAIGNS LANDING VIEW
     ========================================================================= */
  return (
    <div className="space-y-12 py-4 animate-fadeIn text-[#E8E9D8]">
      {/* 1. Header */}
      <section className="border-b border-[rgba(169,191,165,0.2)] pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <span className="text-[10px] sm:text-xs uppercase tracking-widest-plus text-[#A9BFA5] font-mono block mb-2">
            WORKSPACE // STRATEGY & ORCHESTRATION
          </span>
          <h1 className="serif text-4xl sm:text-5xl font-light text-[#E8E9D8] tracking-tight">
            Campaigns
          </h1>
          <p className="mt-3 text-xs sm:text-sm text-[#A9BFA5]/80 font-light leading-relaxed max-w-xl">
            Plan, launch, and manage campaigns from one place.
          </p>
        </div>

        {/* Primary Action Button */}
        <div>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="bg-[#E8E9D8] text-[#071C1A] px-6 py-2.5 rounded-[2px] font-semibold uppercase tracking-widest text-xs hover:bg-white transition-colors cursor-pointer focus:outline-none flex items-center space-x-2"
          >
            <Plus className="w-3.5 h-3.5 text-current" />
            <span>Create New Campaign</span>
          </button>
        </div>
      </section>

      {/* First-Run Empty State (Image 6 spec) */}
      {isFirstRun && (
        <div className="p-8 sm:p-12 rounded-[2px] bg-[#061816] border border-emerald-500/40 text-center space-y-4 max-w-xl mx-auto my-6 animate-fadeIn shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="serif text-xl sm:text-2xl font-light text-white">
              No campaigns yet.
            </h3>
            <p className="text-xs text-[#A9BFA5] font-light max-w-md mx-auto leading-relaxed">
              Launch strategic automated outreach and multichannel campaign initiatives.
            </p>
          </div>
          <div>
            <button
              type="button"
              id="campaigns-new-campaign-btn"
              onClick={handleOpenCreate}
              className="px-6 py-2.5 bg-[#E8E9D8] text-[#071C1A] hover:bg-white text-xs font-mono font-bold uppercase tracking-wider rounded-[2px] transition-colors inline-flex items-center space-x-2 cursor-pointer shadow-md"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>New campaign → /campaigns/new</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. Top Filter and Search Row */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b ${isLight ? 'border-[#E2ECE0]' : 'border-[rgba(169,191,165,0.15)]'} text-xs`}>
        <div className="flex items-center space-x-5 uppercase tracking-widest font-mono text-[11px] overflow-x-auto pb-1 sm:pb-0">
          {(['All', 'Active', 'Planning', 'Draft', 'Completed'] as const).map(tab => {
            const count = tab === 'All' 
              ? campaigns.length 
              : campaigns.filter(c => c.status === tab).length;
            const isSelected = statusFilter === tab;

            return (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`pb-1 border-b transition-colors cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
                  isSelected 
                    ? isLight 
                      ? 'text-[#122420] border-[#143630] font-semibold' 
                      : 'text-[#E8E9D8] border-[#A9BFA5] font-medium' 
                    : isLight 
                      ? 'text-[#3E6A5E] border-transparent hover:text-[#122420]' 
                      : 'text-[#A9BFA5]/60 border-transparent hover:text-[#A9BFA5]'
                }`}
              >
                <span>{tab}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                  isSelected 
                    ? isLight ? 'bg-[#143630] text-white font-medium' : 'bg-[#0D2D2A] text-[#A9BFA5]' 
                    : isLight ? 'bg-[#EDF3EA] text-[#3E6A5E]' : 'text-[#A9BFA5]/40'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Search campaigns, objectives, owner..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${
              isLight 
                ? 'bg-white border-[#D0DDD0] text-[#122420] placeholder-[#668877] focus:border-[#244B40]' 
                : 'bg-[#071C1A] border-[rgba(169,191,165,0.2)] text-[#E8E9D8] placeholder-[#A9BFA5]/40 focus:border-[#A9BFA5]'
            } text-xs px-3 py-1.5 pl-8 pr-7 rounded-[2px] border focus:outline-none font-light w-full sm:w-72 transition-colors`}
          />
          <Search className={`w-3.5 h-3.5 absolute left-2.5 top-2.5 pointer-events-none ${isLight ? 'text-[#244B40]' : 'text-[#A9BFA5]/50'}`} />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className={`absolute right-2 top-2 hover:opacity-100 cursor-pointer ${isLight ? 'text-[#3E6A5E] hover:text-[#122420]' : 'text-[#A9BFA5]/50 hover:text-[#E8E9D8]'}`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 3. Streamlined Filter & Controls Toolbar */}
      <div className={`space-y-3.5 ${isLight ? 'bg-white border-[#E2ECE0]' : 'bg-[#061816] border-[rgba(169,191,165,0.2)]'} p-3.5 sm:p-4 rounded-[2px] border transition-colors shadow-sm`}>
        {/* Main Controls Row */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 text-xs">
          {/* Left: Filter Selectors */}
          <div className="flex items-center flex-wrap gap-2.5">
            {/* Timeline Filter Select & Direct Custom Button */}
            <div className="flex items-center space-x-1.5">
              <CalendarRange className={`w-3.5 h-3.5 ${isLight ? 'text-[#244B40]' : 'text-[#A9BFA5]'}`} />
              <select
                value={timelineFilter}
                onChange={(e) => {
                  const val = e.target.value as TimelineFilterOption;
                  setTimelineFilter(val);
                  if (val === 'Custom') {
                    setIsCalendarModalOpen(true);
                    setIsCustomDateOpen(true);
                  } else {
                    setIsCustomDateOpen(false);
                  }
                }}
                className={`${
                  isLight
                    ? 'bg-[#F8F9F5] text-[#122420] border-[#D0DDD0] focus:border-[#244B40]'
                    : 'bg-[#071C1A] text-[#E8E9D8] border-[rgba(169,191,165,0.25)] focus:border-[#A9BFA5]'
                } text-xs font-mono px-2.5 py-1.5 rounded-[2px] border focus:outline-none cursor-pointer transition-colors`}
              >
                <option value="All">Timeline: All</option>
                <option value="Active">Active Now</option>
                <option value="Upcoming">Upcoming</option>
                <option value="Concluded">Concluded</option>
                <option value="Q2">Q2 2026 (Apr–Jun)</option>
                <option value="Q3">Q3 2026 (Jul–Sep)</option>
                <option value="Custom">Custom Date Range...</option>
              </select>

              {/* Direct Custom Timeline Button */}
              <button
                type="button"
                id="campaigns-custom-btn"
                onClick={() => setIsCalendarModalOpen(true)}
                className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-[2px] border text-xs font-mono transition-colors cursor-pointer ${
                  timelineFilter === 'Custom'
                    ? (isLight ? 'bg-[#143630] text-white border-[#143630]' : 'bg-[#0D2D2A] text-emerald-300 border-emerald-500/50 shadow-sm')
                    : (isLight ? 'bg-white text-[#244B40] border-[#D0DDD0] hover:border-[#244B40]' : 'bg-[#061816] text-[#A9BFA5] border-[rgba(169,191,165,0.25)] hover:text-white')
                }`}
                title="Click on Custom to decide start and end date on calendar and sort campaigns on that basis"
              >
                <Calendar className="w-3 h-3 text-emerald-400" />
                <span>Custom</span>
                {timelineFilter === 'Custom' && (
                  <span className="text-[10px] text-emerald-400/90 font-mono">
                    ({customStartDate.slice(5)} → {customEndDate.slice(5)})
                  </span>
                )}
              </button>
            </div>

            {/* Progress Filter Select */}
            <div className="flex items-center space-x-1.5">
              <Activity className={`w-3.5 h-3.5 ${isLight ? 'text-[#244B40]' : 'text-[#A9BFA5]'}`} />
              <select
                value={progressFilter}
                onChange={(e) => setProgressFilter(e.target.value as ProgressFilterOption)}
                className={`${
                  isLight
                    ? 'bg-[#F8F9F5] text-[#122420] border-[#D0DDD0] focus:border-[#244B40]'
                    : 'bg-[#071C1A] text-[#E8E9D8] border-[rgba(169,191,165,0.25)] focus:border-[#A9BFA5]'
                } text-xs font-mono px-2.5 py-1.5 rounded-[2px] border focus:outline-none cursor-pointer transition-colors`}
              >
                <option value="All">Progress: All</option>
                <option value="NotStarted">0% (Draft)</option>
                <option value="Early">1–25% (Early Stage)</option>
                <option value="InProgress">26–74% (In Flight)</option>
                <option value="Advanced">75–99% (Advanced)</option>
                <option value="Completed">100% (Completed)</option>
              </select>
            </div>

            {/* Minimum Progress Threshold */}
            <div className="flex items-center space-x-1.5">
              <SlidersHorizontal className={`w-3.5 h-3.5 ${isLight ? 'text-[#244B40]' : 'text-[#A9BFA5]'}`} />
              <select
                value={minProgress}
                onChange={(e) => setMinProgress(Number(e.target.value))}
                className={`${
                  isLight
                    ? 'bg-[#F8F9F5] text-[#122420] border-[#D0DDD0] focus:border-[#244B40]'
                    : 'bg-[#071C1A] text-[#E8E9D8] border-[rgba(169,191,165,0.25)] focus:border-[#A9BFA5]'
                } text-xs font-mono px-2.5 py-1.5 rounded-[2px] border focus:outline-none cursor-pointer transition-colors`}
              >
                <option value={0}>Min Progress: Any</option>
                <option value={25}>Min Progress: ≥25%</option>
                <option value={50}>Min Progress: ≥50%</option>
                <option value={75}>Min Progress: ≥75%</option>
              </select>
            </div>

            {/* Reset All Quick Action */}
            {isAnyFilterActive && (
              <button
                type="button"
                onClick={handleResetFilters}
                className={`text-[11px] font-mono flex items-center space-x-1 px-2.5 py-1.5 rounded-[2px] border transition-colors cursor-pointer ${
                  isLight 
                    ? 'text-[#244B40] hover:text-[#122420] border-[#D0DDD0] hover:bg-[#EDF3EA]' 
                    : 'text-[#A9BFA5] hover:text-white border-[rgba(169,191,165,0.3)] hover:bg-[#0D2D2A]'
                }`}
                title="Reset all filters to default"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          {/* Right: Sort & Live Count */}
          <div className="flex items-center flex-wrap gap-3 shrink-0">
            {/* Sort Select */}
            <div className="flex items-center space-x-1.5">
              <ArrowUpDown className={`w-3.5 h-3.5 ${isLight ? 'text-[#244B40]' : 'text-[#A9BFA5]'}`} />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className={`${
                  isLight
                    ? 'bg-[#F8F9F5] text-[#122420] border-[#D0DDD0] focus:border-[#244B40]'
                    : 'bg-[#071C1A] text-[#E8E9D8] border-[rgba(169,191,165,0.25)] focus:border-[#A9BFA5]'
                } text-xs font-mono px-2.5 py-1.5 rounded-[2px] border focus:outline-none cursor-pointer transition-colors`}
              >
                <option value="Default">Sort: Default Order</option>
                <option value="ProgressDesc">Sort: Progress High → Low</option>
                <option value="ProgressAsc">Sort: Progress Low → High</option>
                <option value="StartNewest">Sort: Start Date (Newest)</option>
                <option value="StartOldest">Sort: Start Date (Oldest)</option>
                <option value="EndingSoonest">Sort: Ending Soonest</option>
                <option value="NameAsc">Sort: Campaign Name (A–Z)</option>
              </select>
            </div>

            {/* Campaign Counters */}
            <div className={`text-[11px] font-mono px-2.5 py-1 rounded-[2px] border ${
              isLight 
                ? 'bg-[#EDF3EA] border-[#D0DDD0] text-[#244B40]' 
                : 'bg-[#071C1A] border-[rgba(169,191,165,0.2)] text-[#A9BFA5]'
            }`}>
              Showing <strong className={isLight ? 'text-[#122420]' : 'text-white'}>{filteredCampaigns.length}</strong> of {campaigns.length}
            </div>
          </div>
        </div>

        {/* Expandable Custom Date Range Drawer */}
        {(timelineFilter === 'Custom' || isCustomDateOpen) && (
          <div className={`p-3.5 ${isLight ? 'bg-[#F8F9F5] border-[#D0DDD0]' : 'bg-[#071C1A] border-[rgba(169,191,165,0.25)]'} border rounded-[2px] space-y-3 animate-fadeIn`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center flex-wrap gap-4 text-xs font-mono">
                <div className="flex items-center space-x-2">
                  <span className={`${isLight ? 'text-[#244B40]' : 'text-[#A9BFA5]'} text-[11px] uppercase`}>From:</span>
                  <input
                    type="date"
                    value={pendingStartDate}
                    onChange={(e) => setPendingStartDate(e.target.value)}
                    className={`${isLight ? 'bg-white border-[#D0DDD0] text-[#122420]' : 'bg-[#061816] border-[rgba(169,191,165,0.3)] text-[#E8E9D8]'} text-xs px-2.5 py-1 rounded-[2px] border focus:outline-none font-mono cursor-pointer`}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <span className={`${isLight ? 'text-[#244B40]' : 'text-[#A9BFA5]'} text-[11px] uppercase`}>To:</span>
                  <input
                    type="date"
                    value={pendingEndDate}
                    onChange={(e) => setPendingEndDate(e.target.value)}
                    className={`${isLight ? 'bg-white border-[#D0DDD0] text-[#122420]' : 'bg-[#061816] border-[rgba(169,191,165,0.3)] text-[#E8E9D8]'} text-xs px-2.5 py-1 rounded-[2px] border focus:outline-none font-mono cursor-pointer`}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomStartDate(pendingStartDate);
                      setCustomEndDate(pendingEndDate);
                      setTimelineFilter('Custom');
                      setIsCustomDateOpen(false);
                    }}
                    className={`${isLight ? 'bg-[#143630] text-white hover:bg-[#1E4D45]' : 'bg-[#E8E9D8] text-[#071C1A] hover:bg-white'} px-3 py-1 rounded-[2px] text-[11px] font-mono font-semibold uppercase transition-colors cursor-pointer`}
                  >
                    Apply Window
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCalendarModalOpen(true)}
                    className="border border-emerald-500/50 bg-[#0D2D2A] text-emerald-300 hover:text-white px-2.5 py-1 rounded-[2px] text-[11px] font-mono flex items-center space-x-1 cursor-pointer"
                  >
                    <Calendar className="w-3 h-3 text-emerald-400" />
                    <span>Open Calendar 📅</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingStartDate('2026-05-01');
                      setPendingEndDate('2026-08-31');
                      setCustomStartDate('2026-05-01');
                      setCustomEndDate('2026-08-31');
                      setTimelineFilter('All');
                      setIsCustomDateOpen(false);
                    }}
                    className={`${isLight ? 'border-[#D0DDD0] text-[#244B40] hover:text-[#122420]' : 'border-[rgba(169,191,165,0.3)] text-[#A9BFA5] hover:text-[#E8E9D8]'} border px-2.5 py-1 rounded-[2px] text-[11px] font-mono transition-colors cursor-pointer`}
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center flex-wrap gap-1.5 text-[10px] font-mono">
                <span className={`${isLight ? 'text-[#3E6A5E]' : 'text-[#A9BFA5]/60'} mr-1`}>Quick:</span>
                {[
                  { label: 'May–Jul 2026', start: '2026-05-01', end: '2026-07-31' },
                  { label: 'Jun–Aug 2026', start: '2026-06-01', end: '2026-08-31' },
                  { label: 'Q2 2026', start: '2026-04-01', end: '2026-06-30' },
                  { label: 'Q3 2026', start: '2026-07-01', end: '2026-09-30' },
                  { label: 'Full Year', start: '2026-01-01', end: '2026-12-31' },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setPendingStartDate(preset.start);
                      setPendingEndDate(preset.end);
                      setCustomStartDate(preset.start);
                      setCustomEndDate(preset.end);
                      setTimelineFilter('Custom');
                    }}
                    className={`px-2 py-0.5 border rounded-[2px] cursor-pointer transition-colors ${
                      isLight
                        ? 'border-[#D0DDD0] bg-white text-[#244B40] hover:border-[#244B40]'
                        : 'border-[rgba(169,191,165,0.2)] bg-[#0D2D2A]/40 text-[#A9BFA5] hover:text-[#E8E9D8] hover:border-[#A9BFA5]/50'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Active Filter Chips Strip (only displayed when active filters exist) */}
        {isAnyFilterActive && (
          <div className={`flex items-center flex-wrap gap-2 pt-2.5 border-t ${isLight ? 'border-[#E2ECE0]' : 'border-[rgba(169,191,165,0.12)]'} text-xs`}>
            <span className={`text-[10px] font-mono uppercase tracking-wider ${isLight ? 'text-[#3E6A5E]' : 'text-[#A9BFA5]/60'}`}>
              Active Filters:
            </span>

            {statusFilter !== 'All' && (
              <span className={`inline-flex items-center space-x-1 px-2 py-0.5 border text-[10px] font-mono rounded-[2px] ${
                isLight ? 'bg-[#EDF3EA] border-[#D0DDD0] text-[#122420]' : 'bg-[#0D2D2A] border-[rgba(169,191,165,0.3)] text-[#E8E9D8]'
              }`}>
                <span>Status: {statusFilter}</span>
                <button 
                  type="button" 
                  onClick={() => setStatusFilter('All')} 
                  className="hover:opacity-75 cursor-pointer ml-1 font-bold"
                >
                  ×
                </button>
              </span>
            )}

            {timelineFilter !== 'All' && (
              <span className={`inline-flex items-center space-x-1 px-2 py-0.5 border text-[10px] font-mono rounded-[2px] ${
                isLight ? 'bg-[#EDF3EA] border-[#D0DDD0] text-[#122420]' : 'bg-[#0D2D2A] border-[rgba(169,191,165,0.3)] text-[#E8E9D8]'
              }`}>
                <span>
                  Timeline: {timelineFilter === 'Custom' ? `${customStartDate} → ${customEndDate}` : timelineFilter}
                </span>
                <button 
                  type="button" 
                  onClick={() => setTimelineFilter('All')} 
                  className="hover:opacity-75 cursor-pointer ml-1 font-bold"
                >
                  ×
                </button>
              </span>
            )}

            {progressFilter !== 'All' && (
              <span className={`inline-flex items-center space-x-1 px-2 py-0.5 border text-[10px] font-mono rounded-[2px] ${
                isLight ? 'bg-[#EDF3EA] border-[#D0DDD0] text-[#122420]' : 'bg-[#0D2D2A] border-[rgba(169,191,165,0.3)] text-[#E8E9D8]'
              }`}>
                <span>Progress: {progressFilter}</span>
                <button 
                  type="button" 
                  onClick={() => setProgressFilter('All')} 
                  className="hover:opacity-75 cursor-pointer ml-1 font-bold"
                >
                  ×
                </button>
              </span>
            )}

            {minProgress > 0 && (
              <span className={`inline-flex items-center space-x-1 px-2 py-0.5 border text-[10px] font-mono rounded-[2px] ${
                isLight ? 'bg-[#EDF3EA] border-[#D0DDD0] text-[#122420]' : 'bg-[#0D2D2A] border-[rgba(169,191,165,0.3)] text-[#E8E9D8]'
              }`}>
                <span>Min: ≥{minProgress}%</span>
                <button 
                  type="button" 
                  onClick={() => setMinProgress(0)} 
                  className="hover:opacity-75 cursor-pointer ml-1 font-bold"
                >
                  ×
                </button>
              </span>
            )}

            {search && (
              <span className={`inline-flex items-center space-x-1 px-2 py-0.5 border text-[10px] font-mono rounded-[2px] ${
                isLight ? 'bg-[#EDF3EA] border-[#D0DDD0] text-[#122420]' : 'bg-[#0D2D2A] border-[rgba(169,191,165,0.3)] text-[#E8E9D8]'
              }`}>
                <span>Search: "{search}"</span>
                <button 
                  type="button" 
                  onClick={() => setSearch('')} 
                  className="hover:opacity-75 cursor-pointer ml-1 font-bold"
                >
                  ×
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={handleResetFilters}
              className={`text-[10px] font-mono underline underline-offset-2 cursor-pointer flex items-center space-x-1 ml-1 ${
                isLight ? 'text-[#244B40] hover:text-[#122420]' : 'text-[#A9BFA5] hover:text-white'
              }`}
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Reset All</span>
            </button>
          </div>
        )}
      </div>

      {/* 4. Campaigns Table */}
      <div className={`border ${isLight ? 'border-[#E2ECE0] divide-[#E2ECE0] bg-white' : 'border-[rgba(169,191,165,0.2)] divide-[rgba(169,191,165,0.15)] bg-[#071C1A]'} divide-y overflow-x-auto rounded-[2px] transition-colors shadow-sm`}>
        {/* Table Header with interactive sort triggers */}
        <div className={`min-w-[900px] grid grid-cols-12 px-6 py-3 text-[10px] uppercase tracking-widest font-mono ${
          isLight ? 'text-[#244B40] bg-[#F8F9F5]' : 'text-[#A9BFA5]/60 bg-[#061816]'
        }`}>
          <div 
            onClick={handleToggleSortName}
            className={`col-span-4 flex items-center space-x-1.5 cursor-pointer ${isLight ? 'hover:text-[#122420]' : 'hover:text-[#E8E9D8]'} transition-colors select-none`}
          >
            <span>Campaign Name & Objective</span>
            {sortBy === 'NameAsc' && <span className={isLight ? 'text-[#143630] font-bold' : 'text-[#A9BFA5]'}>↑</span>}
          </div>

          <div className="col-span-2">
            Status
          </div>

          <div 
            onClick={handleToggleSortTimeline}
            className={`col-span-2 flex items-center space-x-1.5 cursor-pointer ${isLight ? 'hover:text-[#122420]' : 'hover:text-[#E8E9D8]'} transition-colors select-none`}
          >
            <span>Timeline</span>
            {sortBy === 'StartNewest' && <span className={isLight ? 'text-[#143630] font-bold' : 'text-[#A9BFA5]'}>↓ Start</span>}
            {sortBy === 'StartOldest' && <span className={isLight ? 'text-[#143630] font-bold' : 'text-[#A9BFA5]'}>↑ Start</span>}
            {sortBy === 'EndingSoonest' && <span className={isLight ? 'text-[#143630] font-bold' : 'text-[#A9BFA5]'}>→ Ending</span>}
            {sortBy !== 'StartNewest' && sortBy !== 'StartOldest' && sortBy !== 'EndingSoonest' && (
              <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />
            )}
          </div>

          <div 
            onClick={handleToggleSortProgress}
            className={`col-span-2 flex items-center space-x-1.5 cursor-pointer ${isLight ? 'hover:text-[#122420]' : 'hover:text-[#E8E9D8]'} transition-colors select-none pr-6`}
          >
            <span>Progress</span>
            {sortBy === 'ProgressDesc' && <span className={isLight ? 'text-[#143630] font-bold' : 'text-[#A9BFA5]'}>↓ High</span>}
            {sortBy === 'ProgressAsc' && <span className={isLight ? 'text-[#143630] font-bold' : 'text-[#A9BFA5]'}>↑ Low</span>}
            {sortBy !== 'ProgressDesc' && sortBy !== 'ProgressAsc' && (
              <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />
            )}
          </div>

          <div className="col-span-2 text-right">
            Owner & Blueprint
          </div>
        </div>

        {/* Campaign Rows */}
        {filteredCampaigns.length === 0 ? (
          <div className="py-16 text-center text-xs font-light space-y-3">
            <div className={`serif text-lg ${isLight ? 'text-[#122420]' : 'text-[#E8E9D8]'}`}>No campaigns match the current criteria</div>
            <p className={`max-w-md mx-auto text-[11px] font-mono ${isLight ? 'text-[#3E6A5E]' : 'text-[#A9BFA5]/60'}`}>
              Try adjusting your timeline window, progress threshold, or status filter to reveal campaigns.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className={`mt-2 inline-flex items-center space-x-1.5 px-4 py-2 border text-xs font-mono uppercase tracking-wider rounded-[2px] transition-colors cursor-pointer ${
                isLight 
                  ? 'border-[#D0DDD0] text-[#122420] hover:bg-[#EDF3EA]' 
                  : 'border-[rgba(169,191,165,0.3)] text-[#E8E9D8] hover:bg-[#0D2D2A]'
              }`}
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset All Filters</span>
            </button>
          </div>
        ) : (
          paginatedCampaigns.map(campaign => {
            const timelineState = getCampaignTimelineState(campaign);
            
            // Progress stage label
            let progressStage = 'Kickoff';
            if (campaign.progress === 100) progressStage = 'Complete';
            else if (campaign.progress >= 75) progressStage = 'Advanced';
            else if (campaign.progress >= 26) progressStage = 'In Flight';
            else if (campaign.progress > 0) progressStage = 'Early';

            return (
              <div 
                key={campaign.id}
                onClick={() => handleSelectCampaignForBlueprint(campaign)}
                className={`min-w-[900px] grid grid-cols-12 px-6 py-4 items-center transition-colors ${
                  isLight ? 'hover:bg-[#F4F8F2]' : 'hover:bg-[#0D2D2A]/30'
                } group cursor-pointer`}
              >
                {/* Campaign Name & Objective */}
                <div className="col-span-4 pr-4">
                  <h4 className={`text-xs sm:text-sm font-medium ${isLight ? 'text-[#122420] group-hover:text-[#0A1F1B]' : 'text-[#E8E9D8] group-hover:text-white'} transition-colors`}>
                    {campaign.name}
                  </h4>
                  <p className={`text-[11px] ${isLight ? 'text-[#3E6A5E]' : 'text-[#A9BFA5]/70'} font-light mt-0.5 line-clamp-1`}>
                    {campaign.objective}
                  </p>
                  <span className={`text-[10px] font-mono ${isLight ? 'text-[#244B40]/70' : 'text-[#A9BFA5]/50'} block mt-1`}>
                    {campaign.channel}
                  </span>
                </div>

                {/* Status */}
                <div className="col-span-2">
                  <span className={`inline-block text-[10px] uppercase tracking-widest px-2.5 py-0.5 border font-mono rounded-[2px] ${
                    campaign.status === 'Active' 
                      ? isLight ? 'text-[#15803D] border-[#86EFAC] bg-[#F0FDF4]' : 'text-emerald-400 border-emerald-500/30 bg-emerald-950/30'
                      : campaign.status === 'Planning'
                      ? isLight ? 'text-[#0369A1] border-[#BAE6FD] bg-[#F0F9FF]' : 'text-sky-400 border-sky-500/30 bg-sky-950/30'
                      : campaign.status === 'Completed'
                      ? isLight ? 'text-[#143630] border-[#D0DDD0] bg-[#EDF3EA]' : 'text-[#E8E9D8] border-[#A9BFA5]/40 bg-[#0D2D2A]/60'
                      : isLight ? 'text-[#3E6A5E] border-[#D0DDD0] bg-[#F8F9F5]' : 'text-[#A9BFA5] border-[rgba(169,191,165,0.2)] bg-[#071C1A]'
                  }`}>
                    {campaign.status}
                  </span>
                </div>

                {/* Timeline Column with Status Chip */}
                <div className={`col-span-2 text-xs font-mono ${isLight ? 'text-[#244B40]' : 'text-[#A9BFA5]/90'}`}>
                  <div className="flex items-center space-x-1.5">
                    {timelineState === 'active' && (
                      <span className={`inline-flex items-center space-x-1 text-[9px] uppercase px-1.5 py-0.2 rounded border ${
                        isLight ? 'bg-[#F0FDF4] border-[#86EFAC] text-[#15803D]' : 'bg-emerald-950/50 border-emerald-500/30 text-emerald-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isLight ? 'bg-[#15803D]' : 'bg-emerald-400'} animate-pulse`} />
                        <span>Active</span>
                      </span>
                    )}
                    {timelineState === 'upcoming' && (
                      <span className={`inline-flex items-center space-x-1 text-[9px] uppercase px-1.5 py-0.2 rounded border ${
                        isLight ? 'bg-[#F0F9FF] border-[#BAE6FD] text-[#0369A1]' : 'bg-sky-950/50 border-sky-500/30 text-sky-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isLight ? 'bg-[#0369A1]' : 'bg-sky-400'}`} />
                        <span>Upcoming</span>
                      </span>
                    )}
                    {timelineState === 'concluded' && (
                      <span className={`inline-flex items-center space-x-1 text-[9px] uppercase px-1.5 py-0.2 rounded border ${
                        isLight ? 'bg-[#EDF3EA] border-[#D0DDD0] text-[#3E6A5E]' : 'bg-[#0D2D2A]/60 border-[#A9BFA5]/30 text-[#A9BFA5]'
                      }`}>
                        <span>Concluded</span>
                      </span>
                    )}
                  </div>
                  <div className={`mt-1 font-medium ${isLight ? 'text-[#122420]' : 'text-[#E8E9D8]'}`}>{campaign.startDate}</div>
                  <div className={`text-[10px] ${isLight ? 'text-[#3E6A5E]' : 'text-[#A9BFA5]/50'} mt-0.5`}>
                    to {campaign.endDate || 'Ongoing'}
                  </div>
                </div>

                {/* Progress Column with Dynamic Bar and Stage */}
                <div className="col-span-2 pr-6">
                  <div className={`flex items-center justify-between text-[11px] font-mono ${isLight ? 'text-[#122420]' : 'text-[#E8E9D8]'} mb-1.5`}>
                    <span className={`text-[10px] ${isLight ? 'text-[#3E6A5E]' : 'text-[#A9BFA5]/70'}`}>{progressStage}</span>
                    <span className="font-semibold">{campaign.progress}%</span>
                  </div>
                  <div className={`w-full h-1.5 ${isLight ? 'bg-[#E2ECE0] border-[#D0DDD0]' : 'bg-[#061816] border-[rgba(169,191,165,0.2)]'} border overflow-hidden rounded-[1px]`}>
                    <div 
                      className={`h-full transition-all duration-300 ${
                        campaign.progress === 100
                          ? isLight ? 'bg-[#15803D]' : 'bg-emerald-400'
                          : campaign.progress >= 75
                          ? isLight ? 'bg-[#143630]' : 'bg-[#E8E9D8]'
                          : campaign.progress >= 25
                          ? isLight ? 'bg-[#2E6B5D]' : 'bg-[#A9BFA5]'
                          : isLight ? 'bg-[#6D9F91]' : 'bg-[#A9BFA5]/50'
                      }`}
                      style={{ width: `${campaign.progress}%` }}
                    />
                  </div>
                </div>

                {/* Owner & Action */}
                <div className="col-span-2 flex items-center justify-end space-x-4">
                  <div className="text-right">
                    <span className={`text-xs ${isLight ? 'text-[#122420]' : 'text-[#E8E9D8]'} font-light block`}>
                      {campaign.owner}
                    </span>
                    <span className={`text-[10px] ${isLight ? 'text-[#3E6A5E]' : 'text-[#A9BFA5]/60'} font-mono`}>
                      Owner
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectCampaignForBlueprint(campaign);
                    }}
                    className="px-3 py-1.5 border border-[rgba(169,191,165,0.3)] text-[10px] uppercase font-mono tracking-wider text-[#E8E9D8] hover:bg-[#0D2D2A] transition-colors cursor-pointer shrink-0"
                  >
                    Blueprint &rarr;
                  </button>
                </div>
              </div>
            );
          })
        )}

        {/* Pagination Footer */}
        {filteredCampaigns.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={filteredCampaigns.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[3, 5, 10, 20]}
            itemName="campaigns"
          />
        )}
      </div>

      {/* Date Range & Sort Calendar Modal */}
      <DateRangeCalendarModal
        isOpen={isCalendarModalOpen}
        title="Decide Campaign Timeline & Sorting"
        subtitle="Click on the calendar to pick start and end dates. Campaigns will be filtered and sorted on that basis."
        initialStartDate={customStartDate}
        initialEndDate={customEndDate}
        initialSortBasis={
          sortBy === 'StartOldest' ? 'oldest' :
          sortBy === 'NameAsc' ? 'alphabetical' :
          sortBy === 'ProgressDesc' ? 'priority' : 'newest'
        }
        onClose={() => setIsCalendarModalOpen(false)}
        onApply={(selection) => {
          setCustomStartDate(selection.startDate);
          setCustomEndDate(selection.endDate);
          setPendingStartDate(selection.startDate);
          setPendingEndDate(selection.endDate);
          setTimelineFilter('Custom');
          if (selection.sortBasis === 'oldest') {
            setSortBy('StartOldest');
          } else if (selection.sortBasis === 'alphabetical') {
            setSortBy('NameAsc');
          } else if (selection.sortBasis === 'priority' || selection.sortBasis === 'value') {
            setSortBy('ProgressDesc');
          } else {
            setSortBy('StartNewest');
          }
          setIsCalendarModalOpen(false);
          setIsCustomDateOpen(false);
        }}
      />
    </div>
  );
}
