import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, 
  Search, 
  ChevronDown, 
  Plus, 
  Check, 
  X, 
  LayoutGrid, 
  List, 
  Calendar, 
  Bot, 
  User, 
  Clock, 
  Flame, 
  ArrowRight,
  Filter,
  CheckSquare,
  Square,
  AlertTriangle,
  Send,
  ExternalLink,
  ChevronRight,
  Sparkles,
  MessageSquare
} from 'lucide-react';
import { Lead, SubCategory, LeadStage, LeadTag } from '../../types';
import type { FollowUpQueueItem, LifecyclePipelineSummary } from '../../legacy/types';
import { useTheme } from '../../context/ThemeContext';
import DateRangeCalendarModal, { DateRangeSelection } from './DateRangeCalendarModal';
import { getLeadStageVisual, getTemperatureVisual } from '../../styles/statusLanguage';

interface LeadsViewProps {
  activeSubCategory: SubCategory;
  leads: Lead[];
  selectedLead?: Lead | null;
  onNavigateSub: (sub: SubCategory) => void;
  onSelectLead: (lead: Lead) => void;
  onAddLeadModal: () => void;
  onUpdateLead?: (updated: Lead) => void;
  onNotify?: (title: string, desc: string) => void;
  isFirstRun?: boolean;
  followUpQueue?: FollowUpQueueItem[];
  lifecycleSummary?: LifecyclePipelineSummary | null;
  onExecuteFollowUp?: (leadId: string, followUpId: string, draft: string) => void | Promise<void>;
  onRefreshFollowUps?: () => void;
}

export default function LeadsView({
  activeSubCategory,
  leads,
  selectedLead,
  onNavigateSub,
  onSelectLead,
  onAddLeadModal,
  onUpdateLead,
  onNotify,
  isFirstRun = false,
  followUpQueue = [],
  lifecycleSummary = null,
  onExecuteFollowUp,
  onRefreshFollowUps,
}: LeadsViewProps) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  // Top Tabs: 'leads' vs 'follow-ups'
  const isFollowUpsTab = activeSubCategory === 'follow-ups';
  const [topTab, setTopTab] = useState<'leads' | 'follow-ups'>(isFollowUpsTab ? 'follow-ups' : 'leads');

  useEffect(() => {
    if (activeSubCategory === 'follow-ups') {
      setTopTab('follow-ups');
    } else {
      setTopTab('leads');
    }
  }, [activeSubCategory]);

  // Layout View Switcher: Table vs Board
  const [viewLayout, setViewLayout] = useState<'table' | 'board'>(
    activeSubCategory === 'pipeline' ? 'board' : 'table'
  );

  // Saved Views: 'All' | 'Hot' | 'Needs follow-up'
  const [activeViewChip, setActiveViewChip] = useState<'All' | 'Hot' | 'Needs follow-up'>('All');

  // Filter Dropdowns
  const [stageFilter, setStageFilter] = useState<string>('All');
  const [tempFilter, setTempFilter] = useState<string>('All');
  const [ownerFilter, setOwnerFilter] = useState<string>('All');
  const [channelFilter, setChannelFilter] = useState<string>('All');
  const [search, setSearch] = useState('');

  // Custom Date Range & Calendar
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [isCustomDateActive, setIsCustomDateActive] = useState(false);
  const [customRange, setCustomRange] = useState<DateRangeSelection>({
    startDate: '2026-05-01',
    endDate: '2026-10-06',
    sortBasis: 'newest'
  });

  // Selected Row IDs for Bulk Actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Follow-ups Sub-Tab state: 'overdue' | 'today' | 'upcoming' | 'done'
  const [followUpTab, setFollowUpTab] = useState<'overdue' | 'today' | 'upcoming' | 'done'>('overdue');

  const followUpItems = useMemo(
    () => followUpQueue.filter((item) => item.status === followUpTab),
    [followUpQueue, followUpTab]
  );

  const followUpCounts = useMemo(() => {
    const counts = { overdue: 0, today: 0, upcoming: 0, done: 0 };
    for (const item of followUpQueue) {
      if (item.status in counts) counts[item.status as keyof typeof counts] += 1;
    }
    return counts;
  }, [followUpQueue]);

  // Collapsed columns for Board view (Page 20: Won and Lost are collapsible columns)
  const [isWonCollapsed, setIsWonCollapsed] = useState(true);
  const [isLostCollapsed, setIsLostCollapsed] = useState(true);

  // Pagination for table view
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    const list = leads.filter(l => {
      // Saved views
      if (activeViewChip === 'Hot' && l.score < 80 && l.temperature !== 'HOT') {
        return false;
      }
      if (activeViewChip === 'Needs follow-up' && !l.isPriority && l.tag !== 'Follow-up') {
        return false;
      }

      // Dropdown filters
      if (stageFilter !== 'All') {
        const leadStage = (l.stage || l.status || '').toLowerCase();
        if (!leadStage.includes(stageFilter.toLowerCase())) return false;
      }

      if (tempFilter !== 'All') {
        if (l.temperature !== tempFilter) return false;
      }

      if (ownerFilter !== 'All') {
        if (ownerFilter === 'AI' && (l.handlingMode === 'HUMAN' || l.assignee?.name?.includes('Priya'))) return false;
        if (ownerFilter === 'Human' && l.handlingMode !== 'HUMAN' && !l.assignee?.name?.includes('Priya')) return false;
      }

      if (channelFilter !== 'All') {
        if (l.source !== channelFilter) return false;
      }

      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = l.name.toLowerCase().includes(q);
        const matchesCompany = (l.company || '').toLowerCase().includes(q);
        const matchesEmail = (l.email || '').toLowerCase().includes(q);
        const matchesSource = (l.source || '').toLowerCase().includes(q);
        if (!matchesName && !matchesCompany && !matchesEmail && !matchesSource) return false;
      }

      return true;
    });

    // Custom range sorting if active
    if (isCustomDateActive) {
      list.sort((a, b) => {
        if (customRange.sortBasis === 'priority') {
          return b.score - a.score;
        } else if (customRange.sortBasis === 'value') {
          const extractVal = (valStr?: string) => {
            if (!valStr) return 0;
            const lMatch = valStr.match(/₹?([\d.]+)L/);
            if (lMatch) return parseFloat(lMatch[1]) * 100000;
            const dMatch = valStr.match(/\$?([\d,]+)/);
            if (dMatch) return parseFloat(dMatch[1].replace(/,/g, '')) * 85;
            return 0;
          };
          return extractVal(b.value) - extractVal(a.value);
        } else if (customRange.sortBasis === 'alphabetical') {
          return (a.company || a.name).localeCompare(b.company || b.name);
        } else if (customRange.sortBasis === 'oldest') {
          return a.id.localeCompare(b.id);
        } else {
          return b.id.localeCompare(a.id);
        }
      });
    }

    return list;
  }, [leads, activeViewChip, stageFilter, tempFilter, ownerFilter, channelFilter, search, isCustomDateActive, customRange]);

  // Paginated leads
  const paginatedLeads = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredLeads.slice(startIndex, startIndex + pageSize);
  }, [filteredLeads, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / pageSize));

  // Selection handlers
  const allSelected = paginatedLeads.length > 0 && paginatedLeads.every(l => selectedIds.includes(l.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedLeads.map(l => l.id));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Bulk actions
  const handleBulkChangeStage = (newStage: string) => {
    if (onNotify) onNotify('Bulk Action', `Updated stage to ${newStage} for ${selectedIds.length} leads.`);
    setSelectedIds([]);
  };

  const handleBulkDelete = () => {
    if (onNotify) onNotify('Leads Deleted', `Removed ${selectedIds.length} selected leads.`);
    setSelectedIds([]);
  };

  // Board stages (All 5 active stages visible with clean horizontal scroll)
  const boardStages = [
    { id: 'New', label: 'New', count: 24, value: '₹2.1L' },
    { id: 'Engaged', label: 'Engaged', count: 18, value: '₹3.4L' },
    { id: 'Qualified', label: 'Qualified', count: 11, value: '₹4.8L' },
    { id: 'Contacted', label: 'Contacted', count: 8, value: '₹3.0L' },
    { id: 'Proposal', label: 'Proposal', count: 5, value: '₹2.6L' }
  ];

  // Lead score badge helper matching Inbox & Overview
  const getScoreBadge = (score: number) => {
    if (score >= 90) {
      return {
        text: 'text-emerald-700 dark:text-emerald-400',
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40',
        dot: 'bg-emerald-500'
      };
    }
    if (score >= 80) {
      return {
        text: 'text-amber-700 dark:text-amber-400',
        bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40',
        dot: 'bg-amber-500'
      };
    }
    return {
      text: 'text-rose-700 dark:text-rose-400',
      bg: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40',
      dot: 'bg-rose-500'
    };
  };

  return (
    <div className={`space-y-6 pb-12 animate-fadeIn select-text ${
      isLight ? 'text-slate-900 font-sans' : 'text-[#E8E9D8] font-sans'
    }`}>
      
      {/* ========================================================
          1. TOP NAVIGATION / HEADER
          Leads [ Leads ] [ Follow-ups 7 ]  [+ Add lead]
         ======================================================== */}
      <div className={`border-b pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
        isLight ? 'border-slate-200/90' : 'border-[rgba(169,191,165,0.18)]'
      }`}>
        
        {/* Title & Top Segmented Control Tabs */}
        <div className="flex items-center space-x-3 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <h1 className={`text-2xl sm:text-3xl font-bold tracking-tight mr-1 ${
            isLight ? 'text-slate-900' : 'text-white'
          }`}>
            Leads
          </h1>

          {/* Segmented Control Tabs */}
          <div className={`flex items-center space-x-1 p-0.5 rounded-lg border text-xs font-medium shrink-0 ${
            isLight
              ? 'bg-slate-100/90 border-slate-200/80'
              : 'bg-[#041210] border-[rgba(169,191,165,0.16)]'
          }`}>
            {/* [ Leads ] */}
            <button
              type="button"
              onClick={() => {
                setTopTab('leads');
                onNavigateSub('all-leads');
              }}
              className={`px-3.5 py-1.5 rounded-md transition-all cursor-pointer flex items-center space-x-1.5 ${
                topTab === 'leads'
                  ? isLight
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'bg-[#0E2C26] text-white font-semibold border border-teal-500/30'
                  : isLight
                    ? 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    : 'text-[#A9BFA5] hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Leads</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-1 ${
                topTab === 'leads'
                  ? isLight ? 'bg-slate-100 text-slate-700' : 'bg-[#071C1A] text-[#E8E9D8]'
                  : isLight ? 'bg-slate-200 text-slate-600' : 'bg-slate-800 text-slate-300'
              }`}>
                {leads.length}
              </span>
            </button>

            {/* [ Follow-ups 7 ] */}
            <button
              type="button"
              onClick={() => {
                setTopTab('follow-ups');
                onNavigateSub('follow-ups');
              }}
              className={`px-3.5 py-1.5 rounded-md transition-all cursor-pointer flex items-center space-x-1.5 ${
                topTab === 'follow-ups'
                  ? isLight
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'bg-[#0E2C26] text-white font-semibold border border-teal-500/30'
                  : isLight
                    ? 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    : 'text-[#A9BFA5] hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>Follow-ups</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 ml-1">
                7
              </span>
            </button>
          </div>
        </div>

        {/* [+ Add lead] - Primary action button matching Inbox */}
        <button
          type="button"
          onClick={onAddLeadModal}
          className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Add lead</span>
        </button>
      </div>

      {/* First-Run Empty State */}
      {isFirstRun && (
        <div className={`p-8 sm:p-12 rounded-2xl border text-center space-y-4 max-w-xl mx-auto my-6 shadow-xs animate-fadeIn ${
          isLight
            ? 'bg-white border-slate-200/90'
            : 'bg-[#051614] border-teal-500/30'
        }`}>
          <div className="w-12 h-12 rounded-full bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/40 flex items-center justify-center mx-auto text-teal-600 dark:text-teal-400">
            <Users className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className={`text-xl sm:text-2xl font-bold ${
              isLight ? 'text-slate-900' : 'text-white'
            }`}>
              No leads yet.
            </h3>
            <p className={`text-xs max-w-md mx-auto leading-relaxed ${
              isLight ? 'text-slate-500' : 'text-[#A9BFA5]'
            }`}>
              Leads are created automatically from conversations across your channels, or you can register a new prospect manually.
            </p>
          </div>
          <div>
            <button
              type="button"
              id="leads-add-lead-btn"
              onClick={onAddLeadModal}
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors inline-flex items-center space-x-2 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add lead</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 1: LEADS (Table / Board View)
         ======================================================== */}
      {topTab === 'leads' && (
        <div className="space-y-4">
          
          {/* Row 2: Saved Views Chips & Table/Board Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            {/* Views: [All] [Hot] [Needs follow-up] [+ Save view] */}
            <div className="flex items-center space-x-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <span className={`text-[11px] font-semibold uppercase tracking-wider mr-1 ${
                isLight ? 'text-slate-400' : 'text-[#A9BFA5]/60'
              }`}>
                Views:
              </span>
              {(['All', 'Hot', 'Needs follow-up'] as const).map(chip => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setActiveViewChip(chip)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                    activeViewChip === chip
                      ? isLight
                        ? 'bg-teal-50 text-teal-700 border-teal-300 font-semibold shadow-2xs'
                        : 'bg-[#0D2D2A] border-teal-500/50 text-teal-200 font-semibold'
                      : isLight
                        ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                        : 'bg-[#061816] border-[rgba(169,191,165,0.2)] text-[#A9BFA5] hover:border-[#A9BFA5]'
                  }`}
                >
                  {chip === 'Hot' && <span className="mr-1">🔥</span>}
                  {chip === 'Needs follow-up' && <span className="mr-1">⏰</span>}
                  <span>{chip}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  if (onNotify) onNotify('View Saved', 'Custom view preferences stored.');
                }}
                className="text-xs text-teal-600 dark:text-teal-400 hover:underline font-medium px-2 py-1 cursor-pointer whitespace-nowrap"
              >
                + Save view
              </button>
            </div>

            {/* View Switcher: [≣ Table] [▦ Board] (Segmented Control matching Inbox) */}
            <div className={`flex items-center p-0.5 rounded-lg border text-xs font-medium shrink-0 self-start sm:self-auto ${
              isLight
                ? 'bg-slate-100/90 border-slate-200/80'
                : 'bg-[#041210] border-[rgba(169,191,165,0.16)]'
            }`}>
              <button
                type="button"
                onClick={() => setViewLayout('table')}
                className={`px-3 py-1 rounded-md flex items-center space-x-1.5 transition-all cursor-pointer ${
                  viewLayout === 'table'
                    ? isLight
                      ? 'bg-white text-slate-900 font-semibold shadow-xs'
                      : 'bg-[#0E2C26] text-white font-semibold border border-teal-500/30'
                    : isLight
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-[#A9BFA5] hover:text-white'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Table</span>
              </button>
              <button
                type="button"
                onClick={() => setViewLayout('board')}
                className={`px-3 py-1 rounded-md flex items-center space-x-1.5 transition-all cursor-pointer ${
                  viewLayout === 'board'
                    ? isLight
                      ? 'bg-white text-slate-900 font-semibold shadow-xs'
                      : 'bg-[#0E2C26] text-white font-semibold border border-teal-500/30'
                    : isLight
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-[#A9BFA5] hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Board</span>
              </button>
            </div>
          </div>

          {/* Row 3: Filter Dropdowns & Search Box */}
          <div className={`flex flex-wrap items-center justify-between gap-2.5 p-2.5 rounded-xl border text-xs shadow-xs transition-colors ${
            isLight
              ? 'bg-white border-slate-200/90'
              : 'bg-[#051614] border-[rgba(169,191,165,0.18)]'
          }`}>
            <div className="flex flex-wrap items-center gap-2">
              {/* Stage Filter */}
              <div className="relative">
                <select
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value)}
                  className={`text-xs px-2.5 py-1.5 pr-7 rounded-lg border focus:outline-none cursor-pointer appearance-none font-medium transition-colors ${
                    isLight
                      ? 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 focus:border-teal-600 shadow-xs'
                      : 'bg-[#071F1C] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] focus:border-teal-400'
                  }`}
                >
                  <option value="All">All Stages</option>
                  <option value="New">New</option>
                  <option value="Engaged">Engaged</option>
                  <option value="Qualified">Qualified</option>
                  <option value="Contacted">Contacted</option>
                  <option value="Proposal">Proposal</option>
                  <option value="Won">Won</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2.5 pointer-events-none" />
              </div>

              {/* Temperature Filter */}
              <div className="relative">
                <select
                  value={tempFilter}
                  onChange={(e) => setTempFilter(e.target.value)}
                  className={`text-xs px-2.5 py-1.5 pr-7 rounded-lg border focus:outline-none cursor-pointer appearance-none font-medium transition-colors ${
                    isLight
                      ? 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 focus:border-teal-600 shadow-xs'
                      : 'bg-[#071F1C] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] focus:border-teal-400'
                  }`}
                >
                  <option value="All">All Temperatures</option>
                  <option value="HOT">🔥 Hot</option>
                  <option value="WARM">🟠 Warm</option>
                  <option value="COLD">🔵 Cold</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2.5 pointer-events-none" />
              </div>

              {/* Owner Filter */}
              <div className="relative">
                <select
                  value={ownerFilter}
                  onChange={(e) => setOwnerFilter(e.target.value)}
                  className={`text-xs px-2.5 py-1.5 pr-7 rounded-lg border focus:outline-none cursor-pointer appearance-none font-medium transition-colors ${
                    isLight
                      ? 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 focus:border-teal-600 shadow-xs'
                      : 'bg-[#071F1C] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] focus:border-teal-400'
                  }`}
                >
                  <option value="All">All Owners</option>
                  <option value="AI">🤖 AI Handled</option>
                  <option value="Human">👤 Human Assigned</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2.5 pointer-events-none" />
              </div>

              {/* Channel Filter */}
              <div className="relative">
                <select
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value)}
                  className={`text-xs px-2.5 py-1.5 pr-7 rounded-lg border focus:outline-none cursor-pointer appearance-none font-medium transition-colors ${
                    isLight
                      ? 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 focus:border-teal-600 shadow-xs'
                      : 'bg-[#071F1C] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] focus:border-teal-400'
                  }`}
                >
                  <option value="All">All Channels</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Instagram">Instagram</option>
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="Website">Website</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2.5 pointer-events-none" />
              </div>

              {/* Custom Date Range Filter Button */}
              <button
                type="button"
                id="leads-custom-date-btn"
                onClick={() => setIsCalendarModalOpen(true)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                  isCustomDateActive
                    ? isLight
                      ? 'bg-teal-50 text-teal-700 border-teal-300 shadow-xs'
                      : 'bg-[#0D2D2A] text-teal-300 border-teal-500/50 shadow-sm'
                    : isLight
                      ? 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 shadow-xs'
                      : 'bg-[#071C1A] text-[#A9BFA5] border-[rgba(169,191,165,0.2)] hover:border-[#A9BFA5] hover:text-white'
                }`}
                title="Select start and end date on calendar and sort leads"
              >
                <Calendar className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>Custom Date</span>
                {isCustomDateActive && (
                  <span className="text-[11px] text-teal-700 dark:text-teal-300 font-mono">
                    ({customRange.startDate.slice(5)} → {customRange.endDate.slice(5)})
                  </span>
                )}
              </button>

              {isCustomDateActive && (
                <button
                  type="button"
                  onClick={() => setIsCustomDateActive(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:text-[#A9BFA5]/70 dark:hover:text-white underline cursor-pointer"
                  title="Clear custom date filter"
                >
                  Clear date
                </button>
              )}
            </div>

            {/* Search Box */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search leads..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`text-xs px-2.5 py-1.5 pl-8 pr-7 rounded-lg border focus:outline-none w-44 sm:w-60 transition-all ${
                  isLight
                    ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-teal-600 shadow-xs'
                    : 'bg-[#071F1C] border-[rgba(169,191,165,0.25)] text-white placeholder-[#A9BFA5]/50 focus:border-teal-400'
                }`}
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Active Filter Chips (if any filter is applied) */}
          {(stageFilter !== 'All' || tempFilter !== 'All' || channelFilter !== 'All' || ownerFilter !== 'All') && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`text-[11px] font-semibold ${isLight ? 'text-slate-500' : 'text-[#A9BFA5]/60'}`}>
                Active Filters:
              </span>
              {stageFilter !== 'All' && (
                <span className="px-2.5 py-1 rounded-md bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/50 text-teal-800 dark:text-teal-200 text-xs flex items-center space-x-1.5 font-medium">
                  <span>Stage: {stageFilter}</span>
                  <button type="button" onClick={() => setStageFilter('All')} className="hover:text-rose-600 cursor-pointer">×</button>
                </span>
              )}
              {tempFilter !== 'All' && (
                <span className="px-2.5 py-1 rounded-md bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/50 text-teal-800 dark:text-teal-200 text-xs flex items-center space-x-1.5 font-medium">
                  <span>Temp: {tempFilter}</span>
                  <button type="button" onClick={() => setTempFilter('All')} className="hover:text-rose-600 cursor-pointer">×</button>
                </span>
              )}
              {channelFilter !== 'All' && (
                <span className="px-2.5 py-1 rounded-md bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/50 text-teal-800 dark:text-teal-200 text-xs flex items-center space-x-1.5 font-medium">
                  <span>Channel: {channelFilter}</span>
                  <button type="button" onClick={() => setChannelFilter('All')} className="hover:text-rose-600 cursor-pointer">×</button>
                </span>
              )}
              {ownerFilter !== 'All' && (
                <span className="px-2.5 py-1 rounded-md bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/50 text-teal-800 dark:text-teal-200 text-xs flex items-center space-x-1.5 font-medium">
                  <span>Owner: {ownerFilter}</span>
                  <button type="button" onClick={() => setOwnerFilter('All')} className="hover:text-rose-600 cursor-pointer">×</button>
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setStageFilter('All');
                  setTempFilter('All');
                  setChannelFilter('All');
                  setOwnerFilter('All');
                }}
                className="text-xs text-teal-600 dark:text-teal-400 hover:underline font-medium cursor-pointer ml-1"
              >
                Clear all filters
              </button>
            </div>
          )}

          {/* Bulk Selection Bar (Shown when rows are selected) */}
          {selectedIds.length > 0 && (
            <div
              className={`bulk-actions-bar p-3 rounded-xl flex items-center justify-between text-xs animate-fadeIn shadow-xl border text-white-fixed ${
                isLight
                  ? 'bg-slate-900 border-slate-700 text-white-fixed shadow-slate-900/10'
                  : 'bg-[#0D2D2A] border-teal-500/40 text-white-fixed shadow-black/40'
              }`}
              style={{ color: '#FFFFFF', backgroundColor: isLight ? '#0F172A' : '#0D2D2A' }}
            >
              <div className="flex items-center space-x-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-400 shadow-xs shrink-0" />
                <span className="font-bold text-white-fixed text-xs tracking-wide" style={{ color: '#FFFFFF' }}>
                  {selectedIds.length} lead{selectedIds.length > 1 ? 's' : ''} selected
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleBulkChangeStage('Qualified')}
                  className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white-fixed font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                  style={{ color: '#FFFFFF' }}
                >
                  Change stage
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onNotify) onNotify('Follow-up Queued', `Created follow-up tasks for ${selectedIds.length} leads.`);
                    setSelectedIds([]);
                  }}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white-fixed border border-slate-600 hover:border-slate-500 rounded-lg font-medium transition-colors cursor-pointer"
                  style={{ color: '#FFFFFF' }}
                >
                  Add follow-up
                </button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white-fixed font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                  style={{ color: '#FFFFFF' }}
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="btn-deselect text-slate-300 hover:text-white-fixed ml-2 cursor-pointer font-medium transition-colors hover:underline text-xs"
                  style={{ color: '#CBD5E1' }}
                >
                  Deselect all
                </button>
              </div>
            </div>
          )}

          {/* ========================================================
              LAYOUT A: TABLE VIEW
             ======================================================== */}
          {viewLayout === 'table' ? (
            <div className={`border rounded-xl overflow-hidden shadow-xs transition-colors ${
              isLight
                ? 'bg-white border-slate-200/90'
                : 'bg-[#051614] border-[rgba(169,191,165,0.18)]'
            }`}>
              <div className="overflow-x-auto">
                <div className={`min-w-[760px] grid grid-cols-12 px-5 py-3 text-[11px] uppercase tracking-wider font-semibold border-b ${
                  isLight
                    ? 'text-slate-500 bg-slate-50/90 border-slate-200/80'
                    : 'text-slate-400 bg-[#041210] border-slate-800'
                }`}>
                  <div className="col-span-1 flex items-center">
                    <button type="button" onClick={toggleSelectAll} className="cursor-pointer" aria-label="Select all leads">
                      {allSelected ? (
                        <CheckSquare className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 dark:text-[#A9BFA5]/50" />
                      )}
                    </button>
                  </div>
                  <div className="col-span-3">Lead & Atelier</div>
                  <div className="col-span-2">Pipeline Stage</div>
                  <div className="col-span-2">Intent & Score</div>
                  <div className="col-span-1">Owner</div>
                  <div className="col-span-2">Last Activity</div>
                  <div className="col-span-1 text-right">Action</div>
                </div>

                <div className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-[rgba(169,191,165,0.1)]'}`}>
                  {paginatedLeads.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 dark:text-[#A9BFA5]/60 text-xs">
                      No leads match your current filter criteria.
                    </div>
                  ) : (
                    paginatedLeads.map(lead => {
                      const isSelected = selectedIds.includes(lead.id);
                      const scoreBadge = getScoreBadge(lead.score);

                      return (
                        <div
                          key={lead.id}
                          onClick={() => onSelectLead(lead)}
                          className={`min-w-[760px] grid grid-cols-12 px-5 py-3.5 items-center transition-colors cursor-pointer text-xs ${
                            isSelected
                              ? isLight ? 'bg-teal-50/60' : 'bg-[#0D2D2A]/60'
                              : isLight ? 'hover:bg-slate-50/80' : 'hover:bg-[#0D2D2A]/40'
                          }`}
                        >
                          {/* Checkbox */}
                          <div className="col-span-1 flex items-center" onClick={(e) => e.stopPropagation()}>
                            <button type="button" onClick={() => toggleSelectRow(lead.id)} className="cursor-pointer">
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-400 dark:text-[#A9BFA5]/50" />
                              )}
                            </button>
                          </div>

                          {/* Lead / Company */}
                          <div className="col-span-3 pr-2">
                            <p className={`font-semibold tracking-tight truncate ${
                              isLight ? 'text-slate-900' : 'text-white'
                            }`}>
                              {lead.company || lead.name}
                            </p>
                            <p className={`text-[11px] truncate mt-0.5 ${
                              isLight ? 'text-slate-500' : 'text-[#A9BFA5]/70'
                            }`}>
                              {lead.name} {lead.value ? `· ${lead.value}` : ''}
                            </p>
                          </div>

                          {/* Stage */}
                          <div className="col-span-2">
                            <span className={`text-[11px] px-2 py-0.5 rounded-md uppercase tracking-wide font-medium ${getLeadStageVisual(lead.stage || lead.status).badgeClass}`}>
                              {lead.stage || lead.status}
                            </span>
                          </div>

                          {/* Temp & Score */}
                          <div className="col-span-2 flex items-center space-x-2">
                            <span className={`text-[11px] px-2 py-0.5 rounded-md border font-semibold flex items-center space-x-1 ${scoreBadge.bg}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${scoreBadge.dot}`} />
                              <span>{lead.score}</span>
                            </span>
                            <span className={`text-[11px] font-medium ${
                              lead.temperature === 'HOT'
                                ? 'text-rose-600 dark:text-rose-400'
                                : lead.temperature === 'WARM'
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}>
                              {lead.temperature === 'HOT' ? '🔥 Hot' : lead.temperature === 'WARM' ? '🟠 Warm' : '⚪ Cold'}
                            </span>
                          </div>

                          {/* Owner */}
                          <div className="col-span-1 text-[11px]">
                            {lead.handlingMode === 'HUMAN' || lead.assignee?.name?.includes('Priya') ? (
                              <span className="flex items-center space-x-1 text-sky-600 dark:text-sky-300 font-medium">
                                <User className="w-3.5 h-3.5" />
                                <span>Priya</span>
                              </span>
                            ) : (
                              <span className="flex items-center space-x-1 text-teal-600 dark:text-teal-400 font-medium">
                                <Bot className="w-3.5 h-3.5" />
                                <span>AI</span>
                              </span>
                            )}
                          </div>

                          {/* Last activity */}
                          <div className={`col-span-2 text-[11px] ${
                            isLight ? 'text-slate-500' : 'text-[#A9BFA5]/80'
                          }`}>
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              {lead.source}
                            </span>
                            <span className="mx-1">·</span>
                            <span>{lead.lastActivity || 'Today'}</span>
                          </div>

                          {/* Next action button */}
                          <div className="col-span-1 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectLead(lead);
                              }}
                              className="text-xs text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 font-semibold hover:underline cursor-pointer"
                            >
                              Open lead →
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Table pagination */}
              <div className={`p-3.5 border-t flex items-center justify-between text-xs transition-colors ${
                isLight
                  ? 'bg-slate-50/70 border-slate-200/80 text-slate-500'
                  : 'bg-[#041210] border-slate-800 text-[#A9BFA5]/70'
              }`}>
                <span>
                  Showing {filteredLeads.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, filteredLeads.length)} of {filteredLeads.length} leads
                </span>
                <div className="flex items-center space-x-2">
                  <button 
                    type="button" 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className={`px-3 py-1 border rounded-lg transition-colors cursor-pointer font-medium disabled:opacity-30 disabled:cursor-not-allowed ${
                      isLight
                        ? 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs'
                        : 'border-[rgba(169,191,165,0.2)] bg-[#071F1C] text-white hover:bg-[#0D2D2A]'
                    }`}
                  >
                    Previous
                  </button>
                  <span className={`font-semibold px-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button 
                    type="button" 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className={`px-3 py-1 border rounded-lg transition-colors cursor-pointer font-medium disabled:opacity-30 disabled:cursor-not-allowed ${
                      isLight
                        ? 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs'
                        : 'border-[rgba(169,191,165,0.2)] bg-[#071F1C] text-white hover:bg-[#0D2D2A]'
                    }`}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ========================================================
               LAYOUT B: BOARD VIEW
               NEW 24 | ENGAGED 18 | QUALIFIED 11 | CONTACTED 8 | PROPOSAL 5 | WON 4 ▸ | LOST 9 ▸
               ======================================================== */
            <div className="flex items-start space-x-3.5 overflow-x-auto pb-4 scrollbar-thin">
              {boardStages.map(st => {
                const stageLeads = filteredLeads.filter(l => (l.stage || l.status) === st.id);

                return (
                  <div
                    key={st.id}
                    className={`w-72 shrink-0 rounded-xl border p-3.5 space-y-3 transition-colors ${
                      isLight
                        ? 'bg-slate-100/70 border-slate-200/80'
                        : 'bg-[#051614] border-[rgba(169,191,165,0.18)]'
                    }`}
                  >
                    {/* Column Header */}
                    <div className={`flex items-baseline justify-between border-b pb-2.5 ${
                      isLight ? 'border-slate-200/80' : 'border-slate-800'
                    }`}>
                      <div className="flex items-center space-x-2">
                        <span className={`font-bold text-xs tracking-tight ${
                          isLight ? 'text-slate-800' : 'text-white'
                        }`}>
                          {st.label}
                        </span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          isLight ? 'bg-slate-200 text-slate-700' : 'bg-slate-800 text-slate-300'
                        }`}>
                          {st.count}
                        </span>
                      </div>
                      <span className={`text-xs font-semibold ${
                        isLight ? 'text-slate-500' : 'text-[#A9BFA5]/70'
                      }`}>
                        {st.value}
                      </span>
                    </div>

                    {/* Stage Cards */}
                    <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
                      {(stageLeads.length > 0 ? stageLeads : leads.slice(0, 2)).map(l => {
                        const scoreBadge = getScoreBadge(l.score);

                        return (
                          <div
                            key={l.id}
                            onClick={() => onSelectLead(l)}
                            className={`p-3.5 rounded-lg border transition-all cursor-pointer space-y-2.5 ${
                              isLight
                                ? 'bg-white border-slate-200/90 hover:border-teal-500/50 hover:shadow-sm'
                                : 'bg-[#071F1C] border-[rgba(169,191,165,0.2)] hover:border-[#A9BFA5]'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className={`font-semibold text-xs truncate max-w-[150px] ${
                                isLight ? 'text-slate-900' : 'text-white'
                              }`}>
                                {l.company || l.name}
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-md border font-semibold shrink-0 ${scoreBadge.bg}`}>
                                {l.score}
                              </span>
                            </div>

                            <p className={`text-[11px] truncate ${
                              isLight ? 'text-slate-500' : 'text-[#A9BFA5]/70'
                            }`}>
                              {l.name}
                            </p>

                            <div className={`flex items-center justify-between text-[11px] pt-1 border-t ${
                              isLight ? 'border-slate-100 text-slate-500' : 'border-slate-800/80 text-[#A9BFA5]/70'
                            }`}>
                              <span className="flex items-center space-x-1.5 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                                <span>{l.source}</span>
                              </span>
                              {l.score >= 90 && (
                                <span className="text-amber-700 bg-amber-50 border border-amber-200/70 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40 text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center space-x-1">
                                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                                  <span>Needs human</span>
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Collapsed WON column */}
              <div 
                onClick={() => setIsWonCollapsed(!isWonCollapsed)}
                className={`w-14 shrink-0 rounded-xl border p-3 text-center cursor-pointer transition-colors flex flex-col items-center justify-between min-h-[220px] ${
                  isLight
                    ? 'bg-slate-100/70 border-slate-200/80 hover:bg-slate-100 hover:border-emerald-400'
                    : 'bg-[#051614] border-[rgba(169,191,165,0.2)] hover:border-emerald-400'
                }`}
                title="Toggle Won column"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs uppercase font-bold text-emerald-600 dark:text-emerald-400 block tracking-wider [writing-mode:vertical-rl] rotate-180">
                  Won (4) ▸
                </span>
                <span className="text-[10px] text-slate-400">₹4.8L</span>
              </div>

              {/* Collapsed LOST column */}
              <div 
                onClick={() => setIsLostCollapsed(!isLostCollapsed)}
                className={`w-14 shrink-0 rounded-xl border p-3 text-center cursor-pointer transition-colors flex flex-col items-center justify-between min-h-[220px] ${
                  isLight
                    ? 'bg-slate-100/70 border-slate-200/80 hover:bg-slate-100 hover:border-slate-300'
                    : 'bg-[#051614] border-[rgba(169,191,165,0.2)] hover:border-slate-500'
                }`}
                title="Toggle Lost column"
              >
                <div className="w-2 h-2 rounded-full bg-slate-400" />
                <span className={`text-xs uppercase font-bold block tracking-wider [writing-mode:vertical-rl] rotate-180 ${
                  isLight ? 'text-slate-500' : 'text-[#A9BFA5]/60'
                }`}>
                  Lost (9) ▸
                </span>
                <span className="text-[10px] text-slate-400">₹3.2L</span>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ========================================================
          TAB 2: FOLLOW-UPS (Page 22 & 23 spec)
          [Overdue 3] [Today 4] [Upcoming 12] [Done]
         ======================================================== */}
      {topTab === 'follow-ups' && (
        <div className="space-y-4">
          {lifecycleSummary && (
            <div
              className={`tx-panel tx-panelpad text-xs grid gap-3 sm:grid-cols-5 ${
                isLight ? '' : 'border-teal-900/30'
              }`}
            >
              {[
                { label: 'Capture', key: 'captured', hint: 'Inbound across channels' },
                { label: 'Engage', key: 'engaged', hint: 'AI + human replies' },
                { label: 'Qualify', key: 'qualified', hint: 'Scored & intent' },
                { label: 'Follow up', key: 'pendingFollowUps', hint: 'Scheduled tasks', summary: true },
                { label: 'Reactivate', key: 'reactivationPending', hint: 'Dormant leads', summary: true },
              ].map((step) => {
                const val = step.summary
                  ? (lifecycleSummary as Record<string, number>)[step.key] ?? 0
                  : lifecycleSummary.stages?.[step.key] ?? 0;
                return (
                  <div key={step.label}>
                    <div className="tx-eyebrow">{step.label}</div>
                    <div className={`text-2xl font-bold mt-1 ${isLight ? 'text-slate-900' : 'text-white'}`}>{val}</div>
                    <p className={`mt-1 ${isLight ? 'text-slate-500' : 'text-[#A9BFA5]'}`}>{step.hint}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Sub-tabs bar: Segmented control matching Inbox */}
          <div className="flex items-center justify-between border-b pb-3 border-slate-200/90 dark:border-slate-800">
            <div className={`flex items-center space-x-1 p-0.5 rounded-lg border text-xs font-medium ${
              isLight
                ? 'bg-slate-100/90 border-slate-200/80'
                : 'bg-[#041210] border-[rgba(169,191,165,0.16)]'
            }`}>
              <button
                type="button"
                onClick={() => setFollowUpTab('overdue')}
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center space-x-1.5 ${
                  followUpTab === 'overdue'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200 font-semibold dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800/60 shadow-xs'
                    : isLight
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-[#A9BFA5] hover:text-white'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                <span>Overdue ({followUpCounts.overdue})</span>
              </button>
              <button
                type="button"
                onClick={() => setFollowUpTab('today')}
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center space-x-1.5 ${
                  followUpTab === 'today'
                    ? isLight
                      ? 'bg-white text-slate-900 font-semibold shadow-xs'
                      : 'bg-[#0E2C26] text-white font-semibold border border-teal-500/30'
                    : isLight
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-[#A9BFA5] hover:text-white'
                }`}
              >
                <span>Today ({followUpCounts.today})</span>
              </button>
              <button
                type="button"
                onClick={() => setFollowUpTab('upcoming')}
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center space-x-1.5 ${
                  followUpTab === 'upcoming'
                    ? isLight
                      ? 'bg-white text-slate-900 font-semibold shadow-xs'
                      : 'bg-[#0E2C26] text-white font-semibold border border-teal-500/30'
                    : isLight
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-[#A9BFA5] hover:text-white'
                }`}
              >
                <span>Upcoming ({followUpCounts.upcoming})</span>
              </button>
              <button
                type="button"
                onClick={() => setFollowUpTab('done')}
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center space-x-1.5 ${
                  followUpTab === 'done'
                    ? isLight
                      ? 'bg-white text-slate-900 font-semibold shadow-xs'
                      : 'bg-[#0E2C26] text-white font-semibold border border-teal-500/30'
                    : isLight
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-[#A9BFA5] hover:text-white'
                }`}
              >
                <Check className="w-3.5 h-3.5 text-slate-400" />
                <span>Done</span>
              </button>
            </div>
            
            <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-[#A9BFA5]/70'}`}>
              {followUpCounts.overdue} urgent · {lifecycleSummary?.pendingFollowUps ?? followUpQueue.length} total pending
            </span>
          </div>

          {/* Follow-up Cards */}
          <div className="space-y-3.5">
            {followUpItems.length === 0 && (
              <div
                className={`p-8 rounded-xl border text-center text-sm ${
                  isLight ? 'bg-white border-slate-200 text-slate-600' : 'bg-[#051614] border-teal-900/30 text-[#A9BFA5]'
                }`}
              >
                No follow-ups in this bucket. Connect a channel or wait for AI to schedule after new conversations.
                {onRefreshFollowUps ? (
                  <button type="button" className="block mx-auto mt-3 tecavy-btn sm" onClick={onRefreshFollowUps}>
                    Refresh queue
                  </button>
                ) : null}
              </div>
            )}
            {followUpItems.map(item => (
              <div
                key={item.id}
                className={`p-5 rounded-xl border space-y-3.5 shadow-xs transition-colors ${
                  isLight
                    ? 'bg-white border-slate-200/90'
                    : 'bg-[#051614] border-[rgba(169,191,165,0.2)]'
                }`}
              >
                {/* Card Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                      item.status === 'overdue'
                        ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40'
                        : item.status === 'today'
                        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40'
                        : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                    }`}>
                      {item.badge}
                    </span>
                    <span className={`font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                      {item.company}
                    </span>
                    <span className={isLight ? 'text-slate-400' : 'text-[#A9BFA5]/60'}>·</span>
                    <span className={isLight ? 'text-slate-500' : 'text-[#A9BFA5]'}>
                      {item.contactName} ({item.channel})
                    </span>
                  </div>

                  <span className={`text-[11px] font-medium ${isLight ? 'text-slate-500' : 'text-[#A9BFA5]/70'}`}>
                    Assigned: {item.owner}
                  </span>
                </div>

                {/* Task Name */}
                <h4 className={`text-sm font-semibold tracking-tight ${
                  isLight ? 'text-slate-900' : 'text-white'
                }`}>
                  "{item.task}"
                </h4>

                {/* AI Draft Box */}
                <div className={`p-3.5 rounded-lg border text-xs space-y-1.5 ${
                  isLight
                    ? 'bg-teal-50/60 border-teal-200/70 text-slate-800'
                    : 'bg-[#071F1C] border-teal-800/40 text-[#E8E9D8]'
                }`}>
                  <div className="flex items-center space-x-1.5 text-[11px] font-bold text-teal-700 dark:text-teal-300 uppercase tracking-wide">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>AI Draft Ready</span>
                  </div>
                  <p className="italic leading-relaxed">
                    "{item.draft}"
                  </p>
                </div>

                {/* Action buttons: [Review & send] [Snooze ▼] [Mark done] [Open lead] */}
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      if (onExecuteFollowUp) {
                        void onExecuteFollowUp(item.leadId, item.id, item.draft);
                      } else if (onNotify) {
                        onNotify('Message Dispatched', `Sent reply to ${item.contactName} on ${item.channel}.`);
                      }
                    }}
                    className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg shadow-xs transition-colors cursor-pointer"
                  >
                    {item.type === 'reactivation' ? 'Send reactivation' : 'Review & send'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (onNotify) onNotify('Snoozed', 'Follow-up snoozed until tomorrow 9:00 AM.');
                    }}
                    className={`px-3 py-1.5 border rounded-lg font-medium transition-colors cursor-pointer ${
                      isLight
                        ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        : 'bg-[#071C1A] border-[rgba(169,191,165,0.25)] text-[#A9BFA5] hover:bg-[#0D2D2A]'
                    }`}
                  >
                    Snooze ▼
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (onNotify) onNotify('Task Done', 'Follow-up marked as completed.');
                    }}
                    className={`px-3 py-1.5 border rounded-lg font-medium transition-colors cursor-pointer ${
                      isLight
                        ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        : 'bg-[#071C1A] border-[rgba(169,191,165,0.25)] text-[#A9BFA5] hover:bg-[#0D2D2A]'
                    }`}
                  >
                    Mark done
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const matched =
                        leads.find((l) => l.id === item.leadId) ||
                        leads.find((l) => l.company.toLowerCase().includes(item.company.toLowerCase()));
                      if (matched) onSelectLead(matched);
                    }}
                    className="px-3 py-1.5 text-teal-600 dark:text-teal-400 font-medium hover:underline cursor-pointer ml-auto"
                  >
                    Open lead →
                  </button>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* Date Range & Sort Calendar Modal */}
      <DateRangeCalendarModal
        isOpen={isCalendarModalOpen}
        title="Decide Leads Date Window & Sorting"
        subtitle="Click on the calendar to pick start and end dates. Leads will be filtered and sorted on that basis."
        initialStartDate={customRange.startDate}
        initialEndDate={customRange.endDate}
        initialSortBasis={customRange.sortBasis}
        onClose={() => setIsCalendarModalOpen(false)}
        onApply={(selection) => {
          setCustomRange(selection);
          setIsCustomDateActive(true);
          setIsCalendarModalOpen(false);
        }}
      />
    </div>
  );
}
