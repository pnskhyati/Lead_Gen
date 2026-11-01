import React, { useState, useMemo } from 'react';
import { 
  Share2, 
  Send, 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  RefreshCw, 
  Clock, 
  Sparkles,
  ArrowRight,
  ExternalLink,
  Plus,
  Trash2,
  Eye,
  Check,
  X,
  Filter,
  Layers,
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Globe,
  Radio,
  FileText,
  AlertCircle,
  Tag,
  Film,
  Image as ImageIcon,
  Copy,
  ArrowLeft
} from 'lucide-react';
import { SocialAccount, SubCategory, ScheduledPost, MediaAttachment } from '../../types';
import Pagination from './Pagination';
import MediaAttachmentPicker from './MediaAttachmentPicker';

interface SocialHubViewProps {
  activeSubCategory: SubCategory;
  accounts: SocialAccount[];
  scheduledPosts?: ScheduledPost[];
  onNavigateSub: (sub: SubCategory) => void;
  onSchedulePostSuccess: () => void;
  onAddScheduledPost?: (post: ScheduledPost) => void;
  onDeleteScheduledPost?: (id: string) => void;
  onUpdateScheduledPost?: (post: ScheduledPost) => void;
  isFirstRun?: boolean;
  liveGenerateDraft?: (prompt: string, platforms: string[]) => Promise<string>;
  onOpenLinkedInStudio?: () => void;
  onOpenConnections?: () => void;
}

const API_BASE = import.meta.env.VITE_API_URL || '';

function openLinkedInOAuth() {
  const width = 600;
  const height = 700;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;
  window.open(
    `${API_BASE}/auth/linkedin`,
    'LinkedIn Auth',
    `width=${width},height=${height},left=${left},top=${top}`
  );
}

const PLATFORM_OPTIONS = [
  { id: 'LinkedIn', label: 'LinkedIn', handle: 'nexora-systems', desc: 'Professional network · 28.4K followers' },
  { id: 'X (Twitter)', label: 'X (Twitter)', handle: '@nexora_hq', desc: 'Real-time broadcast · 46.1K followers' },
  { id: 'Substack', label: 'Substack', handle: 'The Quiet Horizon', desc: 'Editorial notes · 14.8K subscribers' },
  { id: 'Instagram', label: 'Instagram', handle: '@nexora.atelier', desc: 'Visual atelier · 19.2K followers' },
  { id: 'Threads', label: 'Threads', handle: '@nexora.atelier', desc: 'Conversational stream · 8.4K followers' },
  { id: 'Meta / Facebook', label: 'Meta / Facebook', handle: 'Nexora Studio', desc: 'Community page · 12.1K followers' }
];

const TIMING_PRESETS = [
  'Today, 5:00 PM',
  'Tomorrow, 9:00 AM',
  'Tomorrow, 2:30 PM',
  'Thursday, 11:00 AM',
  'Friday, 3:00 PM',
  'Next Monday, 8:45 AM',
  'Custom Date & Time'
];

const COPY_TEMPLATES = [
  {
    label: 'Studio Architecture',
    title: 'Why software should speak in hairlines, not badges',
    text: 'We spent two years analyzing how high-growth founders structure their workspaces. Simplicity is not an aesthetic luxury — it is an operating system for deep conviction. Minimal visual noise is an operational superpower.'
  },
  {
    label: 'Engine Rollout',
    title: 'Release note: Automated lead qualifier engine v2.5 rollout',
    text: 'Version 2.5 introduces cryptographic sandbox keys for prospect verification and cross-border timezone schedule optimization. Sub-120ms verification pipeline across multi-channel lead funnels.'
  },
  {
    label: 'Calm Design Note',
    title: 'Thread: 10 architectural principles for high-output design studios',
    text: '1. Kill unnecessary real-time notifications.\n2. Restrict container palettes to single-digit contrast shifts.\n3. Make typography do the organizational work.\n4. Design for calm conviction over transient excitement.'
  }
];

export default function SocialHubView({
  activeSubCategory,
  accounts,
  scheduledPosts,
  onNavigateSub,
  onSchedulePostSuccess,
  onAddScheduledPost,
  onDeleteScheduledPost,
  onUpdateScheduledPost,
  isFirstRun = false,
  liveGenerateDraft,
  onOpenLinkedInStudio,
  onOpenConnections,
}: SocialHubViewProps) {
  const currentTab = 
    activeSubCategory === 'connect' 
      ? 'connect' 
      : activeSubCategory === 'manual-scheduling' 
      ? 'manual-scheduling' 
      : 'ai-guided-creation';

  // Fallback local queue if not provided via props
  const [localQueue, setLocalQueue] = useState<ScheduledPost[]>([]);
  const queue = scheduledPosts || localQueue;

  // AI Guided state
  const [postPrompt, setPostPrompt] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['LinkedIn', 'X (Twitter)']);
  const [generatedDraft, setGeneratedDraft] = useState('');
  const [isDraftGenerating, setIsDraftGenerating] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [scheduledDate, setScheduledDate] = useState('Tomorrow, 9:00 AM');
  const [isScheduled, setIsScheduled] = useState(false);
  const [aiAttachments, setAiAttachments] = useState<MediaAttachment[]>([]);

  // Manual Scheduling state (Dual View: Queue vs Composer to avoid clumsy endless scroll)
  const [schedulingView, setSchedulingView] = useState<'queue' | 'composer'>('queue');
  const [manualPlatforms, setManualPlatforms] = useState<string[]>(['LinkedIn', 'X (Twitter)']);
  const [manualTitle, setManualTitle] = useState('');
  const [manualContent, setManualContent] = useState('');
  const [manualTimingPreset, setManualTimingPreset] = useState('Tomorrow, 9:00 AM');
  const [manualDate, setManualDate] = useState('2026-09-15');
  const [manualTime, setManualTime] = useState('09:00');
  const [manualTags, setManualTags] = useState('#nexora #broadcast #systems');
  const [manualStatus, setManualStatus] = useState<ScheduledPost['status']>('Queued');
  const [manualAttachments, setManualAttachments] = useState<MediaAttachment[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);

  // Queue search & filters
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedPostIds, setExpandedPostIds] = useState<string[]>([]);
  const [inspectingPost, setInspectingPost] = useState<ScheduledPost | null>(null);

  // Pagination states
  const [accountsPage, setAccountsPage] = useState<number>(1);
  const accountsPageSize = 3;

  const [queuePage, setQueuePage] = useState<number>(1);
  const [queuePageSize, setQueuePageSize] = useState<number>(4);

  const paginatedAccounts = useMemo(() => {
    const start = (accountsPage - 1) * accountsPageSize;
    return accounts.slice(start, start + accountsPageSize);
  }, [accounts, accountsPage, accountsPageSize]);

  // Platform selection toggles for manual scheduling
  const toggleManualPlatform = (platformId: string) => {
    setManualPlatforms(prev => {
      const next = prev.includes(platformId)
        ? prev.filter(p => p !== platformId)
        : [...prev, platformId];
      if (next.length > 0 && formError) setFormError(null);
      return next;
    });
  };

  const selectAllManualPlatforms = () => {
    setManualPlatforms(PLATFORM_OPTIONS.map(p => p.id));
    if (formError) setFormError(null);
  };

  const clearAllManualPlatforms = () => {
    setManualPlatforms([]);
  };

  // Quick fill copy template
  const applyCopyTemplate = (tpl: typeof COPY_TEMPLATES[0]) => {
    setManualTitle(tpl.title);
    setManualContent(tpl.text);
    if (formError) setFormError(null);
  };

  // Add post to scheduled queue
  const handleCreateScheduledPost = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualPlatforms.length === 0) {
      setFormError('Please choose at least one platform to upload to.');
      return;
    }
    if (!manualContent.trim()) {
      setFormError('Please input broadcast content or select a starter template.');
      return;
    }
    setFormError(null);

    const finalScheduleTime = manualTimingPreset === 'Custom Date & Time'
      ? (manualDate && manualTime ? `${manualDate} at ${manualTime}` : 'Custom release slot')
      : manualTimingPreset;

    const newPost: ScheduledPost = {
      id: `post-${Date.now()}`,
      title: manualTitle.trim() || (manualContent.slice(0, 48) + '...'),
      content: manualContent.trim(),
      platforms: [...manualPlatforms],
      scheduledTime: finalScheduleTime,
      status: manualStatus,
      tags: manualTags.split(' ').filter(t => t.trim().length > 0),
      mediaCount: manualAttachments.length,
      mediaAttachments: [...manualAttachments],
      author: 'Elena Rostova',
      createdAt: 'Just now'
    };

    if (onAddScheduledPost) {
      onAddScheduledPost(newPost);
    } else {
      setLocalQueue(prev => [newPost, ...prev]);
    }

    setFormSuccess(true);
    setTimeout(() => setFormSuccess(false), 3500);

    // Reset fields & transition to queue view
    setManualTitle('');
    setManualContent('');
    setManualAttachments([]);
    setQueuePage(1);
    setSchedulingView('queue');
    onSchedulePostSuccess();
  };

  // Populate composer from existing queued item
  const handleLoadPostIntoComposer = (post: ScheduledPost) => {
    setManualTitle(post.title || '');
    setManualContent(post.content || '');
    if (post.platforms && post.platforms.length > 0) {
      setManualPlatforms([...post.platforms]);
    }
    if (post.tags && post.tags.length > 0) {
      setManualTags(post.tags.join(' '));
    }
    if (post.mediaAttachments && post.mediaAttachments.length > 0) {
      setManualAttachments([...post.mediaAttachments]);
    }
    setSchedulingView('composer');
  };

  // Remove post
  const handleDeletePost = (id: string) => {
    if (onDeleteScheduledPost) {
      onDeleteScheduledPost(id);
    } else {
      setLocalQueue(prev => prev.filter(p => p.id !== id));
    }
  };

  // Dispatch post now
  const handleDispatchNow = (post: ScheduledPost) => {
    const updated: ScheduledPost = { ...post, status: 'Dispatched' };
    if (onUpdateScheduledPost) {
      onUpdateScheduledPost(updated);
    } else {
      setLocalQueue(prev => prev.map(p => p.id === post.id ? updated : p));
    }
  };

  const toggleExpandContent = (id: string) => {
    setExpandedPostIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Filtered queue items
  const filteredQueue = useMemo(() => {
    return queue.filter(item => {
      // Platform match
      const matchesPlatform = platformFilter === 'all' 
        ? true 
        : item.platforms.some(p => p.toLowerCase().includes(platformFilter.toLowerCase()) || platformFilter.toLowerCase().includes(p.toLowerCase()));
      
      // Status match
      const matchesStatus = statusFilter === 'all' ? true : item.status === statusFilter;

      // Search query match
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || (
        item.title.toLowerCase().includes(q) ||
        item.content.toLowerCase().includes(q) ||
        item.platforms.some(p => p.toLowerCase().includes(q)) ||
        (item.tags && item.tags.some(t => t.toLowerCase().includes(q)))
      );

      return matchesPlatform && matchesStatus && matchesSearch;
    });
  }, [queue, platformFilter, statusFilter, searchQuery]);

  const paginatedQueue = useMemo(() => {
    const start = (queuePage - 1) * queuePageSize;
    return filteredQueue.slice(start, start + queuePageSize);
  }, [filteredQueue, queuePage, queuePageSize]);

  // AI Guided Tab Handlers
  const togglePlatform = (p: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(p) ? prev.filter(item => item !== p) : [...prev, p]
    );
  };

  const handleGeneratePost = () => {
    if (!postPrompt.trim()) return;
    if (liveGenerateDraft) {
      setIsDraftGenerating(true);
      setDraftError(null);
      void liveGenerateDraft(postPrompt.trim(), selectedPlatforms)
        .then((text) => {
          if (!text?.trim()) {
            throw new Error('Vertex returned an empty draft. Check billing and /api/ai/status.');
          }
          setGeneratedDraft(text);
        })
        .catch((err) => {
          setGeneratedDraft('');
          setDraftError(
            err instanceof Error ? err.message : 'Vertex AI generation failed. Sign in and check the API on port 4000.'
          );
        })
        .finally(() => setIsDraftGenerating(false));
      return;
    }
    setDraftError('Live AI is unavailable — open Content Studio or sign in to Nexora.');
  };

  const handleConfirmSchedule = () => {
    setIsScheduled(true);
    setTimeout(() => {
      setIsScheduled(false);
      const newPost: ScheduledPost = {
        id: `post-${Date.now()}`,
        title: postPrompt.slice(0, 48) || 'AI-Formed Multi-Network Broadcast',
        content: generatedDraft,
        platforms: [...selectedPlatforms],
        scheduledTime: scheduledDate,
        status: 'Queued',
        tags: ['#ai-guided', '#nexora'],
        mediaCount: aiAttachments.length,
        mediaAttachments: [...aiAttachments],
        author: 'Elena Rostova',
        createdAt: 'Just now'
      };
      if (onAddScheduledPost) {
        onAddScheduledPost(newPost);
      } else {
        setLocalQueue(prev => [newPost, ...prev]);
      }
      setPostPrompt('');
      setGeneratedDraft('');
      setAiAttachments([]);
      onSchedulePostSuccess();
      onNavigateSub('manual-scheduling');
    }, 1200);
  };

  return (
    <div className="space-y-12 py-4">
      {/* Header */}
      <section className="border-b border-[rgba(169,191,165,0.2)] pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <span className="text-[10px] sm:text-xs uppercase tracking-widest-plus text-[#A9BFA5] font-normal block mb-2">
            BROADCAST & AUDIENCE NETWORK
          </span>
          <h1 className="serif text-4xl sm:text-5xl font-light text-[#E8E9D8] tracking-tight">
            Social Hub
          </h1>
          <p className="mt-3 text-xs sm:text-sm text-[#A9BFA5]/80 font-light leading-relaxed max-w-xl">
            Synchronize unified messaging across external platforms with AI-assisted formatting, audience tone calibration, and automated release schedules.
          </p>
        </div>

        {/* Subnav switcher */}
        <div className="flex items-center space-x-6 text-xs uppercase tracking-widest border-b border-[rgba(169,191,165,0.2)] pb-1">
          <button
            type="button"
            onClick={() => onNavigateSub('ai-guided-creation')}
            className={`pb-1 border-b transition-colors cursor-pointer ${
              currentTab === 'ai-guided-creation' 
                ? 'text-[#E8E9D8] border-[#E8E9D8] font-medium' 
                : 'text-[#A9BFA5]/60 border-transparent hover:text-[#A9BFA5]'
            }`}
          >
            AI Guided Creation
          </button>
          <button
            type="button"
            onClick={() => onNavigateSub('manual-scheduling')}
            className={`pb-1 border-b transition-colors cursor-pointer ${
              currentTab === 'manual-scheduling' 
                ? 'text-[#E8E9D8] border-[#E8E9D8] font-medium' 
                : 'text-[#A9BFA5]/60 border-transparent hover:text-[#A9BFA5]'
            }`}
          >
            Manual Scheduling ({queue.length})
          </button>
          <button
            type="button"
            onClick={() => onNavigateSub('connect')}
            className={`pb-1 border-b transition-colors cursor-pointer ${
              currentTab === 'connect' 
                ? 'text-[#E8E9D8] border-[#E8E9D8] font-medium' 
                : 'text-[#A9BFA5]/60 border-transparent hover:text-[#A9BFA5]'
            }`}
          >
            Connected ({accounts.filter((a) => a.status === 'Connected').length})
          </button>
        </div>
      </section>

      {/* First-Run Empty State (Image 6 spec) */}
      {isFirstRun && (
        <div className="p-8 sm:p-12 rounded-[2px] bg-[#061816] border border-emerald-500/40 text-center space-y-4 max-w-xl mx-auto my-6 animate-fadeIn shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
            <CalendarIcon className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="serif text-xl sm:text-2xl font-light text-white">
              Nothing scheduled.
            </h3>
            <p className="text-xs text-[#A9BFA5] font-light max-w-md mx-auto leading-relaxed">
              Plan and automate social publications across connected brand accounts.
            </p>
          </div>
          <div>
            <button
              type="button"
              id="schedule-create-post-btn"
              onClick={() => onNavigateSub('manual-scheduling')}
              className="px-6 py-2.5 bg-[#E8E9D8] text-[#071C1A] hover:bg-white text-xs font-mono font-bold uppercase tracking-wider rounded-[2px] transition-colors inline-flex items-center space-x-2 cursor-pointer shadow-md"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Create a post → composer drawer</span>
            </button>
          </div>
        </div>
      )}

      {/* 1. Connected Tab */}
      {currentTab === 'connect' && (
        <div className="space-y-6">
          <div className="p-4 border border-[rgba(169,191,165,0.2)] bg-[#071C1A] flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[#A9BFA5] max-w-lg">
              Connect LinkedIn, Instagram, Meta, and X here. Publishing stays in Create / LinkedIn studio.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={openLinkedInOAuth}
                className="text-xs uppercase tracking-wider text-[#071C1A] bg-[#E8E9D8] hover:bg-white px-4 py-2 rounded-[2px] font-semibold transition-colors cursor-pointer"
              >
                Connect LinkedIn
              </button>
              {onOpenConnections && (
                <button
                  type="button"
                  onClick={onOpenConnections}
                  className="text-xs uppercase tracking-wider text-[#E8E9D8] border border-[rgba(169,191,165,0.35)] hover:border-[#E8E9D8] px-4 py-2 rounded-[2px] font-semibold transition-colors cursor-pointer"
                >
                  All connections →
                </button>
              )}
            </div>
          </div>
          <div className="border border-[rgba(169,191,165,0.2)] divide-y divide-[rgba(169,191,165,0.15)] bg-[#071C1A]">
            <div className="grid grid-cols-12 px-6 py-3 text-[10px] uppercase tracking-widest text-[#A9BFA5]/60 font-medium bg-[#061816]">
              <div className="col-span-4">Platform / Handle</div>
              <div className="col-span-3">Status</div>
              <div className="col-span-2 text-right">Followers</div>
              <div className="col-span-3 text-right">Engagement / Sync</div>
            </div>

            {paginatedAccounts.map(acc => (
              <div key={acc.id} className="grid grid-cols-12 px-6 py-4 items-center hover:bg-[#0D2D2A]/30 transition-colors">
                <div className="col-span-4">
                  <p className="text-xs sm:text-sm font-medium text-[#E8E9D8]">{acc.platform}</p>
                  <p className="text-[11px] text-[#A9BFA5]/70 font-mono">{acc.handle}</p>
                </div>

                <div className="col-span-3">
                  <span className="inline-flex items-center space-x-1.5 text-[10px] uppercase tracking-wider px-2 py-0.5 border border-emerald-500/30 text-emerald-400 bg-emerald-950/20 rounded-[1px] font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>{acc.status}</span>
                  </span>
                </div>

                <div className="col-span-2 text-right font-mono text-xs text-[#E8E9D8]">
                  {acc.followers}
                </div>

                <div className="col-span-3 text-right">
                  <p className="text-xs font-mono text-[#E8E9D8]">{acc.engagement}</p>
                  <p className="text-[10px] text-[#A9BFA5]/60">{acc.lastSync}</p>
                </div>
              </div>
            ))}

            {/* Pagination for Accounts */}
            {accounts.length > 0 && (
              <Pagination
                currentPage={accountsPage}
                totalItems={accounts.length}
                pageSize={accountsPageSize}
                onPageChange={setAccountsPage}
                showPageSize={false}
                itemName="accounts"
              />
            )}
          </div>

          <div className="p-4 border border-[rgba(169,191,165,0.2)] bg-[#071C1A] flex items-center justify-between">
            <span className="text-xs text-[#A9BFA5]">Connect another channel (Bluesky, Threads, Mastodon)</span>
            <button
              type="button"
              className="text-xs uppercase tracking-widest text-[#E8E9D8] border border-[rgba(169,191,165,0.3)] hover:border-[#E8E9D8] px-4 py-1.5 transition-colors cursor-pointer"
            >
              + Link Account
            </button>
          </div>
        </div>
      )}

      {/* 2. AI Guided Creation Tab */}
      {currentTab === 'ai-guided-creation' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-6 space-y-6 border border-[rgba(169,191,165,0.2)] p-6 sm:p-8 bg-[#071C1A]">
            <span className="text-[10px] uppercase tracking-widest-plus text-[#A9BFA5] block">
              Step 1 // Composition Intent
            </span>

            <div>
              <label className="block text-xs uppercase tracking-wider text-[#E8E9D8] mb-2 font-medium">
                Target Networks
              </label>
              <div className="flex flex-wrap gap-2">
                {['LinkedIn', 'X (Twitter)', 'Substack', 'Instagram'].map(platform => {
                  const active = selectedPlatforms.includes(platform);
                  return (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => togglePlatform(platform)}
                      className={`text-xs uppercase tracking-wider px-3 py-1.5 border rounded-[2px] transition-colors cursor-pointer ${
                        active 
                          ? 'text-[#E8E9D8] border-[#A9BFA5] bg-[#0D2D2A]' 
                          : 'text-[#A9BFA5]/60 border-[rgba(169,191,165,0.2)]'
                      }`}
                    >
                      {platform}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-[#E8E9D8] mb-2 font-medium">
                Core Premise / Update
              </label>
              <textarea
                rows={4}
                value={postPrompt}
                onChange={(e) => setPostPrompt(e.target.value)}
                placeholder="What insight, release, or thought should Nexora translate into an authoritative multi-channel announcement?"
                className="w-full bg-[#061816] border border-[rgba(169,191,165,0.25)] text-[#E8E9D8] text-xs p-3 rounded-[2px] focus:outline-none focus:border-[#A9BFA5] placeholder-[#A9BFA5]/30 leading-relaxed font-light resize-none"
              />
            </div>

            <button
              type="button"
              onClick={handleGeneratePost}
              disabled={!postPrompt.trim() || isDraftGenerating}
              className="w-full bg-[#E8E9D8] text-[#071C1A] py-3 rounded-[2px] font-semibold uppercase tracking-widest text-xs hover:bg-white transition-colors cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-40"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isDraftGenerating ? 'Generating with Vertex…' : 'Format Multi-Network Broadcast'}</span>
            </button>
            {draftError && (
              <p className="text-xs text-red-400/90 mt-2 leading-relaxed">{draftError}</p>
            )}
            {onOpenLinkedInStudio && (
              <button
                type="button"
                onClick={onOpenLinkedInStudio}
                className="w-full mt-2 border border-[rgba(169,191,165,0.35)] text-[#E8E9D8] py-2.5 rounded-[2px] text-xs font-semibold uppercase tracking-wider hover:bg-[#0D2D2A] transition-colors cursor-pointer"
              >
                Open LinkedIn publish studio
              </button>
            )}
          </div>

          {/* Draft preview & scheduling */}
          <div className="lg:col-span-6 border border-[rgba(169,191,165,0.2)] p-6 sm:p-8 bg-[#071C1A] flex flex-col justify-between">
            <div>
              <div className="flex items-baseline justify-between border-b border-[rgba(169,191,165,0.2)] pb-3 mb-4">
                <span className="text-[10px] uppercase tracking-widest text-[#A9BFA5]">
                  Step 2 // Network Preview
                </span>
                <span className="text-[10px] text-[#A9BFA5]/60 font-mono">
                  {selectedPlatforms.join(' · ')}
                </span>
              </div>

              {generatedDraft ? (
                <div className="space-y-4">
                  <div className="p-4 bg-[#061816] border border-[rgba(169,191,165,0.2)] text-xs sm:text-sm text-[#E8E9D8] leading-relaxed font-light whitespace-pre-line">
                    {generatedDraft}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-[#A9BFA5] mb-1">
                        Release Window
                      </label>
                      <input
                        type="text"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="w-full bg-[#061816] border border-[rgba(169,191,165,0.25)] text-xs text-[#E8E9D8] px-2.5 py-1.5 rounded-[2px]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-[#A9BFA5] mb-1">
                        Tracking Tag
                      </label>
                      <input
                        type="text"
                        defaultValue="#nexora #calmdesign"
                        className="w-full bg-[#061816] border border-[rgba(169,191,165,0.25)] text-xs text-[#E8E9D8] px-2.5 py-1.5 rounded-[2px]"
                      />
                    </div>
                  </div>

                  {/* Attached media for AI-generated draft */}
                  <div className="pt-3 border-t border-[rgba(169,191,165,0.15)]">
                    <MediaAttachmentPicker
                      attachments={aiAttachments}
                      onChange={setAiAttachments}
                      compact={true}
                      label="Attach Media (Optional)"
                      helperText="Attach visuals or editorial documents to accompany this generated post."
                    />
                  </div>
                </div>
              ) : (
                <div className="py-20 text-center text-xs text-[#A9BFA5]/50 font-light">
                  Input your premise on the left to review platform-tailored drafts.
                </div>
              )}
            </div>

            {generatedDraft && (
              <button
                type="button"
                onClick={handleConfirmSchedule}
                className="w-full mt-6 bg-[#E8E9D8] text-[#071C1A] py-3 rounded-[2px] font-semibold uppercase tracking-widest text-xs hover:bg-white transition-colors cursor-pointer flex items-center justify-center space-x-2"
              >
                {isScheduled ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-950" />
                    <span>Synchronized to Queue</span>
                  </>
                ) : (
                  <>
                    <CalendarIcon className="w-3.5 h-3.5" />
                    <span>Confirm & Queue Broadcast</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. Manual Scheduling Tab */}
      {currentTab === 'manual-scheduling' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Top Bar with Mode Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[rgba(169,191,165,0.15)]">
            <div>
              <span className="text-[10px] uppercase tracking-widest-plus text-[#A9BFA5] block">
                SOCIAL HUB // MULTI-NETWORK DISPATCH
              </span>
              <h2 className="serif text-2xl sm:text-3xl font-light text-[#E8E9D8] mt-0.5">
                {schedulingView === 'queue' ? 'Broadcast Queue' : 'Compose Broadcast'}
              </h2>
              <p className="text-xs text-[#A9BFA5]/70 font-light mt-1">
                {schedulingView === 'queue'
                  ? 'Monitor upcoming dispatches, manage publication timing, and inspect live payload feeds.'
                  : 'Configure destination networks, format message copy, and calibrate release slots.'}
              </p>
            </div>

            {/* Segmented Mode Selector */}
            <div className="inline-flex p-1 bg-[#061816] border border-[rgba(169,191,165,0.2)] rounded-[2px] self-start sm:self-auto shrink-0">
              <button
                type="button"
                onClick={() => setSchedulingView('queue')}
                className={`px-3.5 py-1.5 text-xs font-mono uppercase tracking-wider rounded-[1px] transition-all cursor-pointer flex items-center space-x-2 ${
                  schedulingView === 'queue'
                    ? 'bg-[#E8E9D8] text-[#071C1A] font-semibold shadow-sm'
                    : 'text-[#A9BFA5]/70 hover:text-[#E8E9D8]'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Queue ({queue.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setSchedulingView('composer')}
                className={`px-3.5 py-1.5 text-xs font-mono uppercase tracking-wider rounded-[1px] transition-all cursor-pointer flex items-center space-x-2 ${
                  schedulingView === 'composer'
                    ? 'bg-[#E8E9D8] text-[#071C1A] font-semibold shadow-sm'
                    : 'text-[#A9BFA5]/70 hover:text-[#E8E9D8]'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Broadcast</span>
              </button>
            </div>
          </div>

          {/* Form success banner */}
          {formSuccess && (
            <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between rounded-[2px] animate-fadeIn font-mono">
              <div className="flex items-center space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Broadcast successfully scheduled and queued for multi-network dispatch!</span>
              </div>
              <button
                type="button"
                onClick={() => setFormSuccess(false)}
                className="text-emerald-400 hover:text-white text-[11px] underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* VIEW A: QUEUE SCHEDULE */}
          {schedulingView === 'queue' && (
            <div className="space-y-6">
              {/* Compact 4-Card Status Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 border border-[rgba(169,191,165,0.2)] bg-[#071C1A]">
                  <span className="text-[10px] uppercase tracking-widest text-[#A9BFA5]/60 block font-mono">
                    Total Queue
                  </span>
                  <p className="text-xl font-light text-[#E8E9D8] mt-0.5 serif">
                    {queue.length} Releases
                  </p>
                </div>

                <div className="p-3.5 border border-[rgba(169,191,165,0.2)] bg-[#071C1A]">
                  <span className="text-[10px] uppercase tracking-widest text-[#A9BFA5]/60 block font-mono">
                    Pending Dispatch
                  </span>
                  <p className="text-xl font-light text-amber-300 mt-0.5 serif">
                    {queue.filter(q => q.status === 'Queued' || q.status === 'Scheduled').length} Slots
                  </p>
                </div>

                <div className="p-3.5 border border-[rgba(169,191,165,0.2)] bg-[#071C1A]">
                  <span className="text-[10px] uppercase tracking-widest text-[#A9BFA5]/60 block font-mono">
                    Active Networks
                  </span>
                  <p className="text-xl font-light text-emerald-300 mt-0.5 serif">
                    {accounts.length} Platforms
                  </p>
                </div>

                <div className="p-3.5 border border-[rgba(169,191,165,0.2)] bg-[#071C1A]">
                  <span className="text-[10px] uppercase tracking-widest text-[#A9BFA5]/60 block font-mono">
                    Next Release
                  </span>
                  <p className="text-xs font-medium text-[#E8E9D8] mt-1.5 truncate">
                    {queue[0]?.scheduledTime || 'None scheduled'}
                  </p>
                </div>
              </div>

              {/* Queue Controls & Filters */}
              <div className="border border-[rgba(169,191,165,0.2)] p-5 bg-[#071C1A] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[rgba(169,191,165,0.15)]">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-xs uppercase tracking-widest text-[#E8E9D8] font-medium">
                      Scheduled Broadcasts
                    </h3>
                    <span className="text-[10px] text-[#A9BFA5] font-mono px-2 py-0.5 border border-[rgba(169,191,165,0.2)] rounded-[1px]">
                      {filteredQueue.length} of {queue.length}
                    </span>
                  </div>
                </div>

                {/* Filter Toolbar */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center text-xs">
                  <div className="md:col-span-6 relative">
                    <Search className="w-3.5 h-3.5 text-[#A9BFA5]/50 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setQueuePage(1); }}
                      placeholder="Search title, copy, platform, or tags..."
                      className="w-full bg-[#061816] border border-[rgba(169,191,165,0.2)] text-[#E8E9D8] pl-9 pr-8 py-2 rounded-[2px] focus:outline-none focus:border-[#A9BFA5] text-xs placeholder-[#A9BFA5]/30 font-light"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-2 text-[#A9BFA5]/60 hover:text-[#E8E9D8]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="md:col-span-3 flex items-center space-x-2">
                    <span className="text-[10px] uppercase tracking-widest text-[#A9BFA5]/60 shrink-0 font-mono">Platform:</span>
                    <select
                      value={platformFilter}
                      onChange={(e) => { setPlatformFilter(e.target.value); setQueuePage(1); }}
                      className="w-full bg-[#061816] border border-[rgba(169,191,165,0.2)] text-[#E8E9D8] px-2.5 py-2 rounded-[2px] focus:outline-none focus:border-[#A9BFA5] text-xs"
                    >
                      <option value="all">All Platforms</option>
                      <option value="LinkedIn">LinkedIn</option>
                      <option value="X (Twitter)">X (Twitter)</option>
                      <option value="Substack">Substack</option>
                      <option value="Instagram">Instagram</option>
                      <option value="Threads">Threads</option>
                      <option value="Meta">Meta / Facebook</option>
                    </select>
                  </div>

                  <div className="md:col-span-3 flex items-center space-x-2">
                    <span className="text-[10px] uppercase tracking-widest text-[#A9BFA5]/60 shrink-0 font-mono">Status:</span>
                    <select
                      value={statusFilter}
                      onChange={(e) => { setStatusFilter(e.target.value); setQueuePage(1); }}
                      className="w-full bg-[#061816] border border-[rgba(169,191,165,0.2)] text-[#E8E9D8] px-2.5 py-2 rounded-[2px] focus:outline-none focus:border-[#A9BFA5] text-xs"
                    >
                      <option value="all">All Statuses</option>
                      <option value="Queued">Queued</option>
                      <option value="Approved">Approved</option>
                      <option value="Draft Review">Draft Review</option>
                      <option value="Scheduled">Scheduled</option>
                      <option value="Dispatched">Dispatched</option>
                    </select>
                  </div>
                </div>

                {/* Queue Items List */}
                <div className="divide-y divide-[rgba(169,191,165,0.15)] pt-2">
                  {paginatedQueue.length > 0 ? (
                    paginatedQueue.map((item) => {
                      const isExpanded = expandedPostIds.includes(item.id);
                      return (
                        <div 
                          key={item.id} 
                          className="py-4 hover:bg-[#0D2D2A]/20 transition-colors px-2 rounded-[2px] space-y-2.5"
                        >
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                            {/* Time & Title info */}
                            <div className="flex items-start space-x-3.5 min-w-0">
                              <div className="flex items-center space-x-1.5 text-xs font-mono text-[#A9BFA5] w-38 shrink-0 mt-0.5">
                                <Clock className="w-3.5 h-3.5 text-[#A9BFA5]/70 shrink-0" />
                                <span>{item.scheduledTime}</span>
                              </div>

                              <div className="min-w-0 space-y-1">
                                <h4 className="text-xs sm:text-sm text-[#E8E9D8] font-medium leading-snug">
                                  {item.title}
                                </h4>

                                {/* Destination platforms */}
                                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                  {item.platforms.map((plat) => (
                                    <span 
                                      key={plat}
                                      className="inline-flex items-center space-x-1 text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 bg-[#061816] border border-[rgba(169,191,165,0.25)] text-[#E8E9D8] rounded-[2px]"
                                    >
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#A9BFA5]" />
                                      <span>{plat}</span>
                                    </span>
                                  ))}

                                  {item.mediaAttachments && item.mediaAttachments.length > 0 ? (
                                    <div className="inline-flex items-center space-x-1.5 px-2 py-0.5 bg-[#061816] border border-[rgba(169,191,165,0.25)] text-[#E8E9D8] rounded-[2px]">
                                      <div className="flex items-center -space-x-1">
                                        {item.mediaAttachments.slice(0, 3).map((med, idx) => (
                                          <div 
                                            key={med.id || idx} 
                                            className="w-4 h-4 rounded-[1px] overflow-hidden bg-[#071C1A] border border-[rgba(169,191,165,0.3)] shrink-0"
                                            title={`${med.name} (${med.type})`}
                                          >
                                            {med.type === 'image' && med.url ? (
                                              <img src={med.url} alt={med.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                                            ) : med.type === 'video' ? (
                                              <Film className="w-2.5 h-2.5 text-amber-300 m-auto mt-0.5" />
                                            ) : (
                                              <FileText className="w-2.5 h-2.5 text-[#A9BFA5] m-auto mt-0.5" />
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                      <span className="text-[10px] text-[#A9BFA5]/80 font-mono">
                                        {item.mediaAttachments.length} asset{item.mediaAttachments.length > 1 ? 's' : ''}
                                      </span>
                                    </div>
                                  ) : item.mediaCount && item.mediaCount > 0 ? (
                                    <span className="text-[10px] text-[#A9BFA5]/60 font-mono px-1.5 py-0.5 border border-[rgba(169,191,165,0.15)] rounded-[2px]">
                                      {item.mediaCount} media
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </div>

                            {/* Status & Actions */}
                            <div className="flex items-center space-x-2.5 self-end lg:self-center shrink-0">
                              <span className={`text-[10px] uppercase tracking-widest font-mono px-2.5 py-1 border rounded-[2px] ${
                                item.status === 'Dispatched'
                                  ? 'border-cyan-500/40 text-cyan-300 bg-cyan-950/20'
                                  : item.status === 'Approved'
                                  ? 'border-emerald-500/40 text-emerald-300 bg-emerald-950/20'
                                  : item.status === 'Draft Review'
                                  ? 'border-sky-500/40 text-sky-300 bg-sky-950/20'
                                  : 'border-[rgba(169,191,165,0.3)] text-[#A9BFA5] bg-[#061816]'
                              }`}>
                                {item.status}
                              </span>

                              <div className="flex items-center space-x-1 pl-2 border-l border-[rgba(169,191,165,0.15)]">
                                <button
                                  type="button"
                                  onClick={() => setInspectingPost(item)}
                                  title="Inspect full dispatch payload"
                                  className="p-1.5 text-[#A9BFA5]/70 hover:text-[#E8E9D8] hover:bg-[#061816] rounded-[2px] transition-colors cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleLoadPostIntoComposer(item)}
                                  title="Duplicate or Edit in Composer"
                                  className="p-1.5 text-[#A9BFA5]/70 hover:text-[#E8E9D8] hover:bg-[#061816] rounded-[2px] transition-colors cursor-pointer"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>

                                {item.status !== 'Dispatched' && (
                                  <button
                                    type="button"
                                    onClick={() => handleDispatchNow(item)}
                                    title="Dispatch immediately"
                                    className="p-1.5 text-[#A9BFA5]/70 hover:text-emerald-300 hover:bg-[#061816] rounded-[2px] transition-colors cursor-pointer"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleDeletePost(item.id)}
                                  title="Cancel & remove from queue"
                                  className="p-1.5 text-[#A9BFA5]/50 hover:text-red-400 hover:bg-red-950/20 rounded-[2px] transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Content preview accordion */}
                          {item.content && (
                            <div className="pl-0 lg:pl-42 text-xs font-light text-[#A9BFA5]/80">
                              <p className={isExpanded ? 'whitespace-pre-line leading-relaxed text-[#E8E9D8]' : 'line-clamp-2 leading-relaxed'}>
                                {item.content}
                              </p>
                              {item.content.length > 120 && (
                                <button
                                  type="button"
                                  onClick={() => toggleExpandContent(item.id)}
                                  className="text-[10px] text-[#A9BFA5] hover:text-[#E8E9D8] font-mono mt-1 underline cursor-pointer"
                                >
                                  {isExpanded ? 'Show less' : 'Read full draft...'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-12 text-center text-xs text-[#A9BFA5]/60 font-light space-y-3">
                      <p>No scheduled broadcasts matching your active filter criteria.</p>
                      <div className="flex items-center justify-center space-x-3">
                        {(searchQuery || platformFilter !== 'all' || statusFilter !== 'all') && (
                          <button
                            type="button"
                            onClick={() => {
                              setSearchQuery('');
                              setPlatformFilter('all');
                              setStatusFilter('all');
                            }}
                            className="text-xs text-[#E8E9D8] underline font-mono cursor-pointer"
                          >
                            Reset filters
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setSchedulingView('composer')}
                          className="text-xs uppercase font-mono tracking-wider px-3.5 py-1.5 bg-[#E8E9D8] text-[#071C1A] font-semibold rounded-[2px] cursor-pointer hover:bg-white"
                        >
                          + Compose New Broadcast
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Pagination */}
                {filteredQueue.length > 0 && (
                  <div className="mt-4 -mx-5 -mb-5">
                    <Pagination
                      currentPage={queuePage}
                      totalItems={filteredQueue.length}
                      pageSize={queuePageSize}
                      onPageChange={setQueuePage}
                      onPageSizeChange={(newSize) => { setQueuePageSize(newSize); setQueuePage(1); }}
                      pageSizeOptions={[4, 8, 12]}
                      showPageSize={true}
                      itemName="broadcasts"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW B: COMPOSER */}
          {schedulingView === 'composer' && (
            <form onSubmit={handleCreateScheduledPost} className="space-y-6">
              {/* Back Link & Info */}
              <div className="flex items-center justify-between pb-2">
                <button
                  type="button"
                  onClick={() => setSchedulingView('queue')}
                  className="text-xs text-[#A9BFA5] hover:text-[#E8E9D8] flex items-center space-x-1.5 font-mono cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Return to Broadcast Queue</span>
                </button>

                <span className="text-[11px] text-[#A9BFA5]/60 font-mono">
                  {manualPlatforms.length} platform{manualPlatforms.length > 1 ? 's' : ''} targeted
                </span>
              </div>

              {/* Error Alert */}
              {formError && (
                <div className="p-3 bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs flex items-center space-x-2 rounded-[2px] animate-fadeIn font-mono">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* 2-Column Split */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Platforms, Title, Content, Media (7 cols) */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Destination Platforms */}
                  <div className="border border-[rgba(169,191,165,0.2)] p-5 bg-[#071C1A] space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-xs uppercase tracking-wider text-[#E8E9D8] font-medium">
                          1. Target Networks
                        </label>
                        <p className="text-[11px] text-[#A9BFA5]/70 font-light">
                          Select the destination channels for this broadcast.
                        </p>
                      </div>

                      <div className="flex items-center space-x-2.5 text-xs font-mono">
                        <button
                          type="button"
                          onClick={selectAllManualPlatforms}
                          className="text-[#A9BFA5] hover:text-[#E8E9D8] underline cursor-pointer text-[11px]"
                        >
                          All
                        </button>
                        <span className="text-[#A9BFA5]/30">|</span>
                        <button
                          type="button"
                          onClick={clearAllManualPlatforms}
                          className="text-[#A9BFA5]/60 hover:text-[#E8E9D8] underline cursor-pointer text-[11px]"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    {/* Compact platform selector grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {PLATFORM_OPTIONS.map(plat => {
                        const isSelected = manualPlatforms.includes(plat.id);
                        return (
                          <button
                            key={plat.id}
                            type="button"
                            onClick={() => toggleManualPlatform(plat.id)}
                            className={`p-2.5 border text-left rounded-[2px] transition-all cursor-pointer flex items-center justify-between ${
                              isSelected
                                ? 'bg-[#0D2D2A] border-[#A9BFA5] text-[#E8E9D8]'
                                : 'bg-[#061816] border-[rgba(169,191,165,0.18)] text-[#A9BFA5]/60 hover:border-[rgba(169,191,165,0.35)] hover:text-[#A9BFA5]'
                            }`}
                          >
                            <div className="min-w-0 pr-1.5">
                              <span className="text-xs font-medium block truncate">{plat.label}</span>
                              <span className="text-[10px] font-mono text-[#A9BFA5]/60 block truncate">{plat.handle}</span>
                            </div>
                            <div className={`w-3.5 h-3.5 rounded-[1px] border flex items-center justify-center shrink-0 ${
                              isSelected 
                                ? 'bg-[#E8E9D8] border-[#E8E9D8] text-[#071C1A]' 
                                : 'border-[rgba(169,191,165,0.3)]'
                            }`}>
                              {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Headline & Body Copy */}
                  <div className="border border-[rgba(169,191,165,0.2)] p-5 bg-[#071C1A] space-y-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs uppercase tracking-wider text-[#E8E9D8] font-medium">
                        2. Headline / Hook
                      </label>
                      <input
                        type="text"
                        value={manualTitle}
                        onChange={(e) => setManualTitle(e.target.value)}
                        placeholder="e.g. Why studio software requires architectural restraint..."
                        className="w-full bg-[#061816] border border-[rgba(169,191,165,0.25)] text-[#E8E9D8] text-xs px-3 py-2.5 rounded-[2px] focus:outline-none focus:border-[#A9BFA5] placeholder-[#A9BFA5]/30 font-light"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs uppercase tracking-wider text-[#E8E9D8] font-medium">
                          3. Message Copy
                        </label>
                        <div className="flex items-center space-x-2 text-[10px] font-mono text-[#A9BFA5]/70">
                          <span>{manualContent.length} chars</span>
                          <span>·</span>
                          <span>{manualContent.split(/\s+/).filter(Boolean).length} words</span>
                          {manualPlatforms.includes('X (Twitter)') && (
                            <span className={manualContent.length > 280 ? 'text-amber-400 font-bold' : 'text-[#A9BFA5]/50'}>
                              · (X: 280)
                            </span>
                          )}
                        </div>
                      </div>

                      <textarea
                        rows={5}
                        value={manualContent}
                        onChange={(e) => setManualContent(e.target.value)}
                        placeholder="Draft the message copy or insert a template..."
                        className="w-full bg-[#061816] border border-[rgba(169,191,165,0.25)] text-[#E8E9D8] text-xs p-3 rounded-[2px] focus:outline-none focus:border-[#A9BFA5] placeholder-[#A9BFA5]/30 leading-relaxed font-light resize-y"
                      />

                      {/* Quick copy template chips */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[10px] uppercase tracking-widest text-[#A9BFA5]/60 font-mono">
                          Templates:
                        </span>
                        {COPY_TEMPLATES.map((tpl, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => applyCopyTemplate(tpl)}
                            className="text-[10px] font-mono px-2 py-0.5 border border-[rgba(169,191,165,0.2)] hover:border-[#A9BFA5] text-[#A9BFA5] hover:text-[#E8E9D8] rounded-[1px] transition-colors cursor-pointer"
                          >
                            + {tpl.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Media Attachments */}
                  <div className="border border-[rgba(169,191,165,0.2)] p-5 bg-[#071C1A]">
                    <MediaAttachmentPicker
                      attachments={manualAttachments}
                      onChange={setManualAttachments}
                      compact={true}
                      label="4. Media Attachments (Optional)"
                      helperText="Attach images, slides, or documents to be released with this broadcast."
                    />
                  </div>
                </div>

                {/* Right Column: Timing, Priority, Live Preview, Submit (5 cols) */}
                <div className="lg:col-span-5 space-y-6">
                  {/* Timing & Priority */}
                  <div className="border border-[rgba(169,191,165,0.2)] p-5 bg-[#071C1A] space-y-4">
                    <div className="space-y-2">
                      <label className="block text-xs uppercase tracking-wider text-[#E8E9D8] font-medium">
                        Dispatch Window
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {TIMING_PRESETS.map(preset => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setManualTimingPreset(preset)}
                            className={`text-[11px] px-2.5 py-1 border rounded-[1px] transition-colors font-mono cursor-pointer ${
                              manualTimingPreset === preset
                                ? 'border-[#A9BFA5] bg-[#0D2D2A] text-[#E8E9D8]'
                                : 'border-[rgba(169,191,165,0.2)] text-[#A9BFA5]/60 hover:text-[#A9BFA5]'
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>

                      {manualTimingPreset === 'Custom Date & Time' && (
                        <div className="grid grid-cols-2 gap-2 pt-2">
                          <input
                            type="date"
                            value={manualDate}
                            onChange={(e) => setManualDate(e.target.value)}
                            className="bg-[#061816] border border-[rgba(169,191,165,0.25)] text-xs text-[#E8E9D8] px-2.5 py-1.5 rounded-[1px] focus:outline-none focus:border-[#A9BFA5]"
                          />
                          <input
                            type="time"
                            value={manualTime}
                            onChange={(e) => setManualTime(e.target.value)}
                            className="bg-[#061816] border border-[rgba(169,191,165,0.25)] text-xs text-[#E8E9D8] px-2.5 py-1.5 rounded-[1px] focus:outline-none focus:border-[#A9BFA5]"
                          />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[rgba(169,191,165,0.15)]">
                      <div>
                        <label className="block text-[10px] uppercase tracking-widest text-[#A9BFA5] mb-1 font-mono">
                          Status
                        </label>
                        <select
                          value={manualStatus}
                          onChange={(e) => setManualStatus(e.target.value as ScheduledPost['status'])}
                          className="w-full bg-[#061816] border border-[rgba(169,191,165,0.25)] text-xs text-[#E8E9D8] px-2 py-1.5 rounded-[1px] focus:outline-none focus:border-[#A9BFA5]"
                        >
                          <option value="Queued">Queued</option>
                          <option value="Approved">Approved</option>
                          <option value="Draft Review">Draft Review</option>
                          <option value="Scheduled">Scheduled</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase tracking-widest text-[#A9BFA5] mb-1 font-mono">
                          Tags
                        </label>
                        <input
                          type="text"
                          value={manualTags}
                          onChange={(e) => setManualTags(e.target.value)}
                          placeholder="#broadcast #design"
                          className="w-full bg-[#061816] border border-[rgba(169,191,165,0.25)] text-xs text-[#E8E9D8] px-2 py-1.5 rounded-[1px] focus:outline-none focus:border-[#A9BFA5] font-mono text-[11px]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Live Dispatch Preview Card */}
                  <div className="border border-[rgba(169,191,165,0.25)] p-4 bg-[#061816] space-y-3">
                    <div className="flex items-center justify-between border-b border-[rgba(169,191,165,0.15)] pb-2">
                      <span className="text-[10px] uppercase tracking-widest text-[#A9BFA5] font-mono">
                        Live Preview Card
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400">
                        {manualTimingPreset === 'Custom Date & Time' ? `${manualDate} ${manualTime}` : manualTimingPreset}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1">
                        {manualPlatforms.length > 0 ? (
                          manualPlatforms.map(p => (
                            <span key={p} className="text-[9px] font-mono uppercase px-1.5 py-0.5 bg-[#071C1A] border border-[rgba(169,191,165,0.2)] text-[#E8E9D8]">
                              {p}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-amber-400 font-mono">Select at least 1 platform</span>
                        )}
                      </div>

                      <h4 className="text-xs font-medium text-[#E8E9D8]">
                        {manualTitle || 'Untitled Broadcast'}
                      </h4>

                      <p className="text-xs text-[#A9BFA5]/80 font-light line-clamp-3 leading-relaxed">
                        {manualContent || 'Message content will render here in real time...'}
                      </p>

                      {/* Attachments preview snippet */}
                      {manualAttachments.length > 0 && (
                        <div className="flex items-center space-x-2 pt-1">
                          <span className="text-[10px] text-[#A9BFA5]/60 font-mono">
                            {manualAttachments.length} media asset{manualAttachments.length > 1 ? 's' : ''} attached
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Submission Buttons */}
                  <div className="space-y-2">
                    <button
                      type="submit"
                      disabled={manualPlatforms.length === 0 || !manualContent.trim()}
                      className="w-full bg-[#E8E9D8] text-[#071C1A] py-3 rounded-[2px] font-semibold uppercase tracking-widest text-xs hover:bg-white transition-colors cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-40"
                    >
                      <CalendarIcon className="w-3.5 h-3.5" />
                      <span>Queue Broadcast ({manualPlatforms.length} Channels)</span>
                    </button>

                    <div className="flex items-center justify-between text-xs font-mono pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setManualTitle('');
                          setManualContent('');
                          setManualAttachments([]);
                          setFormError(null);
                        }}
                        className="text-[#A9BFA5]/60 hover:text-[#E8E9D8] cursor-pointer text-[11px]"
                      >
                        Reset Form
                      </button>

                      <button
                        type="button"
                        onClick={() => setSchedulingView('queue')}
                        className="text-[#A9BFA5] hover:text-[#E8E9D8] cursor-pointer text-[11px] underline"
                      >
                        Cancel & View Queue
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Detail Inspection Modal */}
      {inspectingPost && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm animate-fadeIn"
          onClick={() => setInspectingPost(null)}
        >
          <div 
            className="relative w-full max-w-xl bg-[#071C1A] border border-[rgba(169,191,165,0.25)] p-6 sm:p-8 shadow-2xl animate-scaleUp text-[#E8E9D8] space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-[rgba(169,191,165,0.15)] pb-4">
              <div>
                <span className="text-[10px] uppercase tracking-widest-plus text-[#A9BFA5] block mb-1">
                  SCHEDULED BROADCAST INSPECTOR
                </span>
                <h3 className="serif text-xl sm:text-2xl font-light text-[#E8E9D8]">
                  {inspectingPost.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectingPost(null)}
                className="text-[#A9BFA5] hover:text-[#E8E9D8] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Meta badges */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
              <div className="p-2.5 bg-[#061816] border border-[rgba(169,191,165,0.2)]">
                <span className="text-[9px] uppercase tracking-widest text-[#A9BFA5]/60 block">Release Window</span>
                <span className="text-[#E8E9D8] mt-0.5 block">{inspectingPost.scheduledTime}</span>
              </div>
              <div className="p-2.5 bg-[#061816] border border-[rgba(169,191,165,0.2)]">
                <span className="text-[9px] uppercase tracking-widest text-[#A9BFA5]/60 block">Status</span>
                <span className="text-emerald-400 mt-0.5 block">{inspectingPost.status}</span>
              </div>
              <div className="p-2.5 bg-[#061816] border border-[rgba(169,191,165,0.2)] col-span-2 sm:col-span-1">
                <span className="text-[9px] uppercase tracking-widest text-[#A9BFA5]/60 block">Author</span>
                <span className="text-[#E8E9D8] mt-0.5 block">{inspectingPost.author || 'Elena Rostova'}</span>
              </div>
            </div>

            {/* Destination Channels Breakdown */}
            <div className="space-y-2">
              <label className="block text-[10px] uppercase tracking-widest text-[#A9BFA5] font-medium font-mono">
                Target Networks ({inspectingPost.platforms.length} Platforms Configured)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {inspectingPost.platforms.map(plat => (
                  <div key={plat} className="p-2.5 bg-[#061816] border border-[rgba(169,191,165,0.2)] flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-[#E8E9D8]">{plat}</p>
                      <p className="text-[10px] text-[#A9BFA5]/60 font-mono">Synced endpoint</p>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-mono">Ready</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Full Message Copy */}
            <div className="space-y-2">
              <label className="block text-[10px] uppercase tracking-widest text-[#A9BFA5] font-medium font-mono">
                Synchronized Post Copy
              </label>
              <div className="p-4 bg-[#061816] border border-[rgba(169,191,165,0.2)] text-xs text-[#E8E9D8] leading-relaxed font-light whitespace-pre-line max-h-56 overflow-y-auto">
                {inspectingPost.content}
              </div>
            </div>

            {/* Tags */}
            {inspectingPost.tags && inspectingPost.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[10px] uppercase tracking-widest text-[#A9BFA5]/60 font-mono">Tags:</span>
                {inspectingPost.tags.map(t => (
                  <span key={t} className="text-[10px] font-mono text-[#A9BFA5] px-2 py-0.5 bg-[#061816] border border-[rgba(169,191,165,0.2)] rounded-[1px]">
                    {t}
                  </span>
                ))}
              </div>
            )}

            {/* Attached Media Assets */}
            {inspectingPost.mediaAttachments && inspectingPost.mediaAttachments.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-[rgba(169,191,165,0.15)]">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] uppercase tracking-widest text-[#A9BFA5] font-medium font-mono">
                    Attached Media Assets ({inspectingPost.mediaAttachments.length})
                  </label>
                  <span className="text-[10px] text-[#A9BFA5]/60 font-mono">
                    Synchronized across selected platforms
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {inspectingPost.mediaAttachments.map((med) => (
                    <div
                      key={med.id}
                      className="p-2 bg-[#061816] border border-[rgba(169,191,165,0.2)] rounded-[2px] flex items-center space-x-3"
                    >
                      <div className="w-12 h-12 bg-[#071C1A] border border-[rgba(169,191,165,0.25)] rounded-[1px] overflow-hidden shrink-0 flex items-center justify-center">
                        {med.type === 'image' && med.url ? (
                          <img
                            src={med.url}
                            alt={med.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : med.type === 'video' ? (
                          <Film className="w-5 h-5 text-amber-300" />
                        ) : (
                          <FileText className="w-5 h-5 text-[#A9BFA5]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-[#E8E9D8] truncate font-medium">{med.name}</p>
                        <div className="flex items-center space-x-2 text-[10px] text-[#A9BFA5]/60 font-mono mt-0.5">
                          <span className="uppercase">{med.type}</span>
                          {med.size && <span>• {med.size}</span>}
                        </div>
                      </div>
                      {med.url && (
                        <a
                          href={med.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] uppercase font-mono tracking-wider text-[#A9BFA5] hover:text-[#E8E9D8] px-2 py-1 border border-[rgba(169,191,165,0.2)] hover:border-[#A9BFA5] rounded-[1px] transition-colors"
                        >
                          View
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="pt-4 border-t border-[rgba(169,191,165,0.15)] flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  handleDeletePost(inspectingPost.id);
                  setInspectingPost(null);
                }}
                className="text-xs uppercase tracking-widest text-red-400 hover:text-red-300 font-mono cursor-pointer"
              >
                Delete from Queue
              </button>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setInspectingPost(null)}
                  className="px-4 py-2 text-xs uppercase tracking-widest text-[#A9BFA5] hover:text-[#E8E9D8] cursor-pointer"
                >
                  Close
                </button>
                {inspectingPost.status !== 'Dispatched' && (
                  <button
                    type="button"
                    onClick={() => {
                      handleDispatchNow(inspectingPost);
                      setInspectingPost(null);
                    }}
                    className="bg-[#E8E9D8] text-[#071C1A] px-5 py-2 rounded-[2px] font-semibold uppercase tracking-widest text-xs hover:bg-white transition-colors cursor-pointer flex items-center space-x-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Dispatch Now</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

