import React, { useState } from 'react';
import { 
  ArrowLeft, 
  ChevronDown, 
  ChevronRight, 
  Sparkles, 
  ArrowRight, 
  Download, 
  RefreshCw, 
  Play, 
  Save, 
  Check, 
  FileText,
  Clock,
  CheckCircle2,
  Users,
  Megaphone,
  Share2,
  TrendingUp,
  AlertTriangle,
  Lightbulb
} from 'lucide-react';
import { CampaignBlueprint, RoadmapPhase } from '../../types';

interface CampaignBlueprintViewProps {
  blueprint: CampaignBlueprint;
  onBack: () => void;
  onEdit: () => void;
  onRegenerate: () => void;
  onStartCampaign?: () => void;
  onNavigateToModule?: (module: string, sub?: string) => void;
}

export default function CampaignBlueprintView({
  blueprint,
  onBack,
  onEdit,
  onRegenerate,
  onStartCampaign,
  onNavigateToModule
}: CampaignBlueprintViewProps) {
  // Track expanded roadmap phases
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({
    'phase-1': true,
    'phase-5': true
  });

  // Track completed execution items for interactive UX
  const [completedWorkstreams, setCompletedWorkstreams] = useState<Record<string, boolean>>({});

  // Export / Save feedback state
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);

  const togglePhase = (phaseId: string) => {
    setExpandedPhases(prev => ({ ...prev, [phaseId]: !prev[phaseId] }));
  };

  const toggleWorkstreamItem = (key: string) => {
    setCompletedWorkstreams(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleExport = () => {
    const jsonStr = JSON.stringify(blueprint, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${blueprint.campaignName.toLowerCase().replace(/\s+/g, '-')}-blueprint.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotice('Blueprint exported to JSON');
  };

  const handleSave = () => {
    showNotice('Blueprint saved to campaign archive');
  };

  const showNotice = (msg: string) => {
    setCopiedNotification(msg);
    setTimeout(() => setCopiedNotification(null), 3000);
  };

  return (
    <div className="space-y-16 py-4 max-w-5xl mx-auto animate-fadeIn text-[#E8E9D8]">
      {/* Toast Notice */}
      {copiedNotification && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0D2D2A] border border-[#A9BFA5] text-[#E8E9D8] px-4 py-3 text-xs font-mono shadow-2xl flex items-center space-x-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{copiedNotification}</span>
        </div>
      )}

      {/* =====================================================================
          HEADER & TOP-RIGHT ACTIONS
          ===================================================================== */}
      <header className="border-b border-[rgba(169,191,165,0.2)] pb-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <button
              type="button"
              onClick={onBack}
              className="group inline-flex items-center space-x-2 text-xs uppercase tracking-widest text-[#A9BFA5]/70 hover:text-[#E8E9D8] transition-colors mb-4 cursor-pointer font-mono"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
              <span>Back to Campaigns</span>
            </button>

            <span className="text-[10px] sm:text-xs uppercase tracking-widest-plus text-[#A9BFA5] font-mono block mb-2">
              CAMPAIGN BLUEPRINT // AI-GENERATED STRATEGY
            </span>

            <h1 className="serif text-3xl sm:text-4xl lg:text-5xl font-light text-[#E8E9D8] tracking-tight">
              {blueprint.campaignName}
            </h1>

            <p className="mt-2 text-xs sm:text-sm text-[#A9BFA5]/80 font-light leading-relaxed max-w-2xl">
              AI-generated strategy based on your goals, audience, resources, and timeline.
            </p>
          </div>

          {/* Top-Right Action Controls */}
          <div className="flex flex-wrap items-center gap-3 font-mono text-xs uppercase tracking-widest">
            <button
              type="button"
              onClick={onEdit}
              className="px-3.5 py-2 border border-[rgba(169,191,165,0.3)] text-[#E8E9D8] hover:bg-[#0D2D2A] transition-colors cursor-pointer"
            >
              Edit
            </button>

            <button
              type="button"
              onClick={onRegenerate}
              className="px-3.5 py-2 border border-[rgba(169,191,165,0.3)] text-[#A9BFA5] hover:text-[#E8E9D8] hover:bg-[#0D2D2A] transition-colors cursor-pointer flex items-center space-x-1.5"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Regenerate</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-3.5 py-2 border border-[rgba(169,191,165,0.3)] text-[#A9BFA5] hover:text-[#E8E9D8] hover:bg-[#0D2D2A] transition-colors cursor-pointer flex items-center space-x-1.5"
            >
              <Save className="w-3 h-3" />
              <span>Save</span>
            </button>

            <button
              type="button"
              onClick={handleExport}
              className="px-3.5 py-2 border border-[rgba(169,191,165,0.3)] text-[#A9BFA5] hover:text-[#E8E9D8] hover:bg-[#0D2D2A] transition-colors cursor-pointer flex items-center space-x-1.5"
            >
              <Download className="w-3 h-3" />
              <span>Export</span>
            </button>

            <button
              type="button"
              onClick={onStartCampaign}
              className="px-4 py-2 bg-[#E8E9D8] text-[#071C1A] hover:bg-white font-medium transition-colors cursor-pointer flex items-center space-x-1.5"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Start Campaign</span>
            </button>
          </div>
        </div>
      </header>

      {/* =====================================================================
          A. CAMPAIGN OVERVIEW (CLEAN INFORMATION GRID, NOT CARDS)
          ===================================================================== */}
      <section className="space-y-6">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-[#A9BFA5] font-mono block mb-1">
            SECTION A
          </span>
          <h2 className="serif text-2xl font-light text-[#E8E9D8]">
            Campaign Overview
          </h2>
        </div>

        <div className="border-t border-b border-[rgba(169,191,165,0.2)] divide-y divide-[rgba(169,191,165,0.15)]">
          <div className="py-4 grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-3 text-xs uppercase tracking-widest text-[#A9BFA5]/60 font-mono">
              Objective
            </div>
            <div className="md:col-span-9 text-sm text-[#E8E9D8] font-light">
              {blueprint.overview.objective}
            </div>
          </div>

          <div className="py-4 grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-3 text-xs uppercase tracking-widest text-[#A9BFA5]/60 font-mono">
              Target Audience
            </div>
            <div className="md:col-span-9 text-sm text-[#E8E9D8] font-light">
              {blueprint.overview.targetAudience}
            </div>
          </div>

          <div className="py-4 grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-3 text-xs uppercase tracking-widest text-[#A9BFA5]/60 font-mono">
              Timeline
            </div>
            <div className="md:col-span-9 text-sm text-[#E8E9D8] font-mono">
              <span dangerouslySetInnerHTML={{ __html: blueprint.overview.timeline }} />
            </div>
          </div>

          <div className="py-4 grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-3 text-xs uppercase tracking-widest text-[#A9BFA5]/60 font-mono">
              Budget
            </div>
            <div className="md:col-span-9 text-sm text-[#E8E9D8] font-mono">
              {blueprint.overview.budget}
            </div>
          </div>

          <div className="py-4 grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-3 text-xs uppercase tracking-widest text-[#A9BFA5]/60 font-mono">
              Primary Channels
            </div>
            <div className="md:col-span-9 flex flex-wrap gap-2">
              {blueprint.overview.primaryChannels.map((channel, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 text-xs border border-[rgba(169,191,165,0.3)] bg-[#0D2D2A]/40 text-[#E8E9D8] font-mono"
                >
                  {channel}
                </span>
              ))}
            </div>
          </div>

          <div className="py-4 grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-3 text-xs uppercase tracking-widest text-[#A9BFA5]/60 font-mono">
              Success Metrics
            </div>
            <div className="md:col-span-9 space-y-1 text-sm text-[#A9BFA5] font-light">
              {blueprint.overview.successMetrics.map((metric, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 bg-[#A9BFA5]" />
                  <span>{metric}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          B. CAMPAIGN STRATEGY
          ===================================================================== */}
      <section className="space-y-6">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-[#A9BFA5] font-mono block mb-1">
            SECTION B
          </span>
          <h2 className="serif text-2xl font-light text-[#E8E9D8]">
            Campaign Strategy
          </h2>
        </div>

        {/* Core Message Callout */}
        <div className="p-6 border-l-2 border-[#A9BFA5] bg-[#0D2D2A]/40 space-y-2">
          <span className="text-[10px] uppercase tracking-widest-plus text-[#A9BFA5] font-mono block">
            Core Message
          </span>
          <blockquote className="serif text-xl sm:text-2xl text-[#E8E9D8] font-light italic">
            &ldquo;{blueprint.strategy.keyMessage}&rdquo;
          </blockquote>
        </div>

        {/* Strategic Points */}
        <div className="border-t border-b border-[rgba(169,191,165,0.2)] divide-y divide-[rgba(169,191,165,0.15)] text-sm font-light">
          <div className="py-4 grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-3 text-xs uppercase tracking-widest text-[#A9BFA5]/60 font-mono">
              Core Objective
            </div>
            <div className="md:col-span-9 text-[#E8E9D8]">
              {blueprint.strategy.coreObjective}
            </div>
          </div>

          <div className="py-4 grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-3 text-xs uppercase tracking-widest text-[#A9BFA5]/60 font-mono">
              Positioning
            </div>
            <div className="md:col-span-9 text-[#E8E9D8]">
              {blueprint.strategy.positioning}
            </div>
          </div>

          <div className="py-4 grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-3 text-xs uppercase tracking-widest text-[#A9BFA5]/60 font-mono">
              Audience Strategy
            </div>
            <div className="md:col-span-9 text-[#E8E9D8]">
              {blueprint.strategy.audienceStrategy}
            </div>
          </div>

          <div className="py-4 grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-3 text-xs uppercase tracking-widest text-[#A9BFA5]/60 font-mono">
              Campaign Angle
            </div>
            <div className="md:col-span-9 text-[#E8E9D8]">
              {blueprint.strategy.campaignAngle}
            </div>
          </div>

          <div className="py-4 grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-3 text-xs uppercase tracking-widest text-[#A9BFA5]/60 font-mono">
              Recommended Approach
            </div>
            <div className="md:col-span-9 text-[#E8E9D8]">
              {blueprint.strategy.recommendedApproach}
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          C. CAMPAIGN ROADMAP (VISUAL TIMELINE WITH EXPANDABLE PHASES)
          ===================================================================== */}
      <section className="space-y-6">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-[#A9BFA5] font-mono block mb-1">
            SECTION C
          </span>
          <h2 className="serif text-2xl font-light text-[#E8E9D8]">
            Campaign Roadmap
          </h2>
          <p className="text-xs text-[#A9BFA5]/80 font-light mt-1">
            Expand each phase below to inspect deliverables, tasks, and team assignments.
          </p>
        </div>

        {/* Linear Step Progression Indicator */}
        <div className="hidden sm:flex items-center justify-between border-b border-[rgba(169,191,165,0.2)] pb-4 text-[10px] uppercase tracking-wider font-mono text-[#A9BFA5]/70 overflow-x-auto">
          {blueprint.roadmap.map((phase, idx) => (
            <React.Fragment key={phase.id}>
              <span className={`px-2 py-0.5 ${expandedPhases[phase.id] ? 'text-[#E8E9D8] font-bold border-b border-[#A9BFA5]' : ''}`}>
                {phase.name}
              </span>
              {idx < blueprint.roadmap.length - 1 && (
                <span className="text-[#A9BFA5]/30">&rarr;</span>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Expandable Phase Accordions */}
        <div className="border-t border-[rgba(169,191,165,0.2)] divide-y divide-[rgba(169,191,165,0.15)]">
          {blueprint.roadmap.map((phase, idx) => {
            const isExpanded = !!expandedPhases[phase.id];
            return (
              <div key={phase.id} className="py-4">
                <button
                  type="button"
                  onClick={() => togglePhase(phase.id)}
                  className="w-full flex items-center justify-between text-left py-2 hover:text-white transition-colors cursor-pointer group"
                >
                  <div className="flex items-center space-x-4">
                    <span className="font-mono text-xs text-[#A9BFA5]/50">
                      0{idx + 1}
                    </span>
                    <span className="text-sm uppercase tracking-widest font-mono text-[#E8E9D8] group-hover:text-white">
                      {phase.name}
                    </span>
                    <span className="text-xs font-mono text-[#A9BFA5]/70 hidden md:inline">
                      · {phase.suggestedTimeline}
                    </span>
                  </div>

                  <div className="flex items-center space-x-3 text-xs font-mono text-[#A9BFA5]">
                    <span className="hidden sm:inline text-[11px] text-[#A9BFA5]/60">
                      {phase.responsible}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-[#A9BFA5]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[#A9BFA5]/60" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="pt-4 pb-2 pl-8 pr-2 space-y-4 text-xs font-light text-[#A9BFA5]/90 border-l border-[rgba(169,191,165,0.15)] ml-3 mt-2 animate-fadeIn">
                    <p className="text-sm text-[#E8E9D8] font-normal">
                      {phase.objective}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                      {/* Tasks */}
                      <div className="space-y-2">
                        <span className="text-[10px] uppercase tracking-widest font-mono text-[#A9BFA5] block">
                          Key Tasks
                        </span>
                        <ul className="space-y-1.5 list-disc list-inside">
                          {phase.tasks.map((task, tIdx) => (
                            <li key={tIdx} className="leading-relaxed">
                              {task}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Deliverables */}
                      <div className="space-y-2">
                        <span className="text-[10px] uppercase tracking-widest font-mono text-[#A9BFA5] block">
                          Deliverables & Milestones
                        </span>
                        <div className="space-y-1.5">
                          {phase.deliverables.map((del, dIdx) => (
                            <div key={dIdx} className="flex items-center space-x-2">
                              <span className="w-1.5 h-1.5 bg-emerald-400" />
                              <span className="text-[#E8E9D8] font-mono text-[11px]">{del}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* =====================================================================
          D. EXECUTION BLUEPRINT (WORKSTREAMS)
          ===================================================================== */}
      <section className="space-y-6">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-[#A9BFA5] font-mono block mb-1">
            SECTION D
          </span>
          <h2 className="serif text-2xl font-light text-[#E8E9D8]">
            Execution Blueprint
          </h2>
          <p className="text-xs text-[#A9BFA5]/80 font-light mt-1">
            Structured operational workstreams. Click tasks to toggle completion status.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
          {Object.entries(blueprint.execution).map(([streamKey, tasks]) => {
            const title = streamKey === 'leadGeneration' ? 'Lead Generation' : streamKey.charAt(0).toUpperCase() + streamKey.slice(1);
            return (
              <div
                key={streamKey}
                className="border border-[rgba(169,191,165,0.2)] bg-[#071C1A] p-5 space-y-4"
              >
                <div className="border-b border-[rgba(169,191,165,0.15)] pb-2 flex items-center justify-between">
                  <span className="text-xs uppercase tracking-widest font-mono text-[#E8E9D8] font-medium">
                    {title}
                  </span>
                  <span className="text-[10px] font-mono text-[#A9BFA5]/60">
                    {tasks.length} tasks
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  {tasks.map((task, idx) => {
                    const taskKey = `${streamKey}-${idx}`;
                    const isDone = !!completedWorkstreams[taskKey];
                    return (
                      <div
                        key={idx}
                        onClick={() => toggleWorkstreamItem(taskKey)}
                        className={`flex items-start space-x-2.5 transition-colors cursor-pointer select-none ${
                          isDone ? 'opacity-50 line-through text-[#A9BFA5]' : 'text-[#E8E9D8] hover:text-white'
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 mt-0.5 border flex items-center justify-center shrink-0 ${
                          isDone ? 'bg-[#E8E9D8] border-[#E8E9D8]' : 'border-[rgba(169,191,165,0.4)]'
                        }`}>
                          {isDone && <Check className="w-2.5 h-2.5 text-[#071C1A] stroke-[2.5]" />}
                        </div>
                        <span className="leading-snug">{task}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* =====================================================================
          E. CONTENT PLAN
          ===================================================================== */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-[#A9BFA5] font-mono block mb-1">
              SECTION E
            </span>
            <h2 className="serif text-2xl font-light text-[#E8E9D8]">
              Content Plan
            </h2>
            <p className="text-xs text-[#A9BFA5]/80 font-light mt-1">
              Recommended multichannel publishing cadence directly linked to Creative Lab.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigateToModule?.('creative-lab', 'create')}
            className="text-xs uppercase tracking-widest font-mono text-[#E8E9D8] hover:text-white underline decoration-[#A9BFA5]/50 underline-offset-4 cursor-pointer"
          >
            Open Creative Lab &rarr;
          </button>
        </div>

        {/* Content Plan Table */}
        <div className="border border-[rgba(169,191,165,0.2)] bg-[#071C1A] overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[rgba(169,191,165,0.2)] bg-[#061816] text-[10px] uppercase tracking-widest text-[#A9BFA5]/70 font-mono">
                <th className="py-3 px-4 font-normal">Content Type</th>
                <th className="py-3 px-4 font-normal">Platform</th>
                <th className="py-3 px-4 font-normal">Purpose</th>
                <th className="py-3 px-4 font-normal">Timing</th>
                <th className="py-3 px-4 font-normal">CTA</th>
                <th className="py-3 px-4 text-right font-normal">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(169,191,165,0.12)] font-light">
              {blueprint.contentPlan.map((item) => (
                <tr key={item.id} className="hover:bg-[#0D2D2A]/30 transition-colors">
                  <td className="py-3.5 px-4 font-medium text-[#E8E9D8]">
                    {item.contentType}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-[#A9BFA5]">
                    {item.platform}
                  </td>
                  <td className="py-3.5 px-4 text-[#A9BFA5]/80">
                    {item.purpose}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-[#E8E9D8]">
                    {item.timing}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-[#A9BFA5]">
                    {item.cta}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => onNavigateToModule?.('creative-lab', 'create')}
                      className="text-[11px] uppercase tracking-wider text-[#E8E9D8] hover:text-white underline decoration-[#A9BFA5]/40 underline-offset-4 cursor-pointer font-mono whitespace-nowrap"
                    >
                      Generate this content &rarr;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* =====================================================================
          F. SOCIAL MEDIA PLAN
          ===================================================================== */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-[#A9BFA5] font-mono block mb-1">
              SECTION F
            </span>
            <h2 className="serif text-2xl font-light text-[#E8E9D8]">
              Social Media Plan
            </h2>
            <p className="text-xs text-[#A9BFA5]/80 font-light mt-1">
              Audience response orchestration and distribution cadences.
            </p>
          </div>

          <div className="flex items-center space-x-4 font-mono text-xs uppercase tracking-widest">
            <button
              type="button"
              onClick={() => onNavigateToModule?.('creative-lab', 'create')}
              className="px-3 py-1.5 border border-[rgba(169,191,165,0.3)] text-[#E8E9D8] hover:bg-[#0D2D2A] cursor-pointer"
            >
              Create Content
            </button>
            <button
              type="button"
              onClick={() => onNavigateToModule?.('social-hub', 'manual-scheduling')}
              className="px-3 py-1.5 border border-[rgba(169,191,165,0.3)] text-[#A9BFA5] hover:text-[#E8E9D8] hover:bg-[#0D2D2A] cursor-pointer"
            >
              Schedule Post
            </button>
          </div>
        </div>

        <div className="border-t border-b border-[rgba(169,191,165,0.2)] divide-y divide-[rgba(169,191,165,0.15)] text-xs font-light">
          <div className="py-4 grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-3 uppercase tracking-widest text-[#A9BFA5]/60 font-mono">
              Posting Frequency
            </div>
            <div className="md:col-span-9 text-[#E8E9D8]">
              {blueprint.socialPlan.postingFrequency}
            </div>
          </div>

          <div className="py-4 grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-3 uppercase tracking-widest text-[#A9BFA5]/60 font-mono">
              Content Themes
            </div>
            <div className="md:col-span-9 space-y-1">
              {blueprint.socialPlan.contentThemes.map((theme, i) => (
                <div key={i} className="text-[#E8E9D8] flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 bg-[#A9BFA5]" />
                  <span>{theme}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="py-4 grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-3 uppercase tracking-widest text-[#A9BFA5]/60 font-mono">
              Post Ideas
            </div>
            <div className="md:col-span-9 space-y-2">
              {blueprint.socialPlan.postIdeas.map((idea, i) => (
                <div key={i} className="p-3 bg-[#0D2D2A]/30 border border-[rgba(169,191,165,0.15)] text-[#E8E9D8]">
                  &ldquo;{idea}&rdquo;
                </div>
              ))}
            </div>
          </div>

          <div className="py-4 grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-3 uppercase tracking-widest text-[#A9BFA5]/60 font-mono">
              Best Formats
            </div>
            <div className="md:col-span-9 flex flex-wrap gap-2">
              {blueprint.socialPlan.bestFormats.map((format, i) => (
                <span key={i} className="px-2 py-0.5 border border-[rgba(169,191,165,0.2)] text-[#A9BFA5] font-mono">
                  {format}
                </span>
              ))}
            </div>
          </div>

          <div className="py-4 grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-3 uppercase tracking-widest text-[#A9BFA5]/60 font-mono">
              Engagement Strategy
            </div>
            <div className="md:col-span-9 text-[#E8E9D8]">
              {blueprint.socialPlan.engagementStrategy}
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          G. LEAD STRATEGY
          ===================================================================== */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-[#A9BFA5] font-mono block mb-1">
              SECTION G
            </span>
            <h2 className="serif text-2xl font-light text-[#E8E9D8]">
              Lead Strategy
            </h2>
            <p className="text-xs text-[#A9BFA5]/80 font-light mt-1">
              High-intent prospect capture, automated scoring, and rapid executive response.
            </p>
          </div>

          <div className="flex items-center space-x-4 font-mono text-xs uppercase tracking-widest">
            <button
              type="button"
              onClick={() => onNavigateToModule?.('leads', 'lead-automation')}
              className="px-3 py-1.5 border border-[rgba(169,191,165,0.3)] text-[#E8E9D8] hover:bg-[#0D2D2A] cursor-pointer"
            >
              Create Lead Automation
            </button>
            <button
              type="button"
              onClick={() => onNavigateToModule?.('leads', 'generated-responses')}
              className="px-3 py-1.5 border border-[rgba(169,191,165,0.3)] text-[#A9BFA5] hover:text-[#E8E9D8] hover:bg-[#0D2D2A] cursor-pointer"
            >
              Generate Response Templates
            </button>
          </div>
        </div>

        <div className="border-t border-b border-[rgba(169,191,165,0.2)] divide-y divide-[rgba(169,191,165,0.15)] text-xs font-light">
          <div className="py-4 grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-3 uppercase tracking-widest text-[#A9BFA5]/60 font-mono">
              Capture Strategy
            </div>
            <div className="md:col-span-9 text-[#E8E9D8]">
              {blueprint.leadStrategy.captureStrategy}
            </div>
          </div>

          <div className="py-4 grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-3 uppercase tracking-widest text-[#A9BFA5]/60 font-mono">
              Qualification Logic
            </div>
            <div className="md:col-span-9 text-[#E8E9D8]">
              {blueprint.leadStrategy.qualification}
            </div>
          </div>

          <div className="py-4 grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-3 uppercase tracking-widest text-[#A9BFA5]/60 font-mono">
              Follow-Up Sequence
            </div>
            <div className="md:col-span-9 text-[#E8E9D8]">
              {blueprint.leadStrategy.followUp}
            </div>
          </div>

          <div className="py-4 grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-3 uppercase tracking-widest text-[#A9BFA5]/60 font-mono">
              Response Strategy
            </div>
            <div className="md:col-span-9 text-[#E8E9D8]">
              {blueprint.leadStrategy.responseStrategy}
            </div>
          </div>

          <div className="py-4 grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-3 uppercase tracking-widest text-[#A9BFA5]/60 font-mono">
              Automation Triggers
            </div>
            <div className="md:col-span-9 space-y-1.5">
              {blueprint.leadStrategy.automationOpportunities.map((opp, idx) => (
                <div key={idx} className="flex items-center space-x-2 text-emerald-400 font-mono text-[11px]">
                  <span>&rarr;</span>
                  <span>{opp}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          H. KPIS & SUCCESS METRICS
          ===================================================================== */}
      <section className="space-y-6">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-[#A9BFA5] font-mono block mb-1">
            SECTION H
          </span>
          <h2 className="serif text-2xl font-light text-[#E8E9D8]">
            KPIs & Success Metrics
          </h2>
          <p className="text-xs text-[#A9BFA5]/80 font-light mt-1">
            Measurable benchmarks tracked against live workspace ingestion.
          </p>
        </div>

        {/* Metrics Table */}
        <div className="border border-[rgba(169,191,165,0.2)] bg-[#071C1A]">
          <div className="grid grid-cols-12 px-6 py-3 text-[10px] uppercase tracking-widest text-[#A9BFA5]/60 font-mono border-b border-[rgba(169,191,165,0.2)] bg-[#061816]">
            <div className="col-span-6">Metric</div>
            <div className="col-span-3 text-right">Target Value</div>
            <div className="col-span-3 text-right">Current Status</div>
          </div>

          <div className="divide-y divide-[rgba(169,191,165,0.12)]">
            {blueprint.kpis.map((kpi) => (
              <div key={kpi.id} className="grid grid-cols-12 px-6 py-3.5 items-center text-xs">
                <div className="col-span-6 font-medium text-[#E8E9D8]">
                  {kpi.name}
                </div>
                <div className="col-span-3 text-right font-mono text-[#A9BFA5]">
                  {kpi.target}
                </div>
                <div className="col-span-3 text-right font-mono text-emerald-400 font-medium">
                  {kpi.current}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================================
          I. RISKS & RECOMMENDATIONS
          ===================================================================== */}
      <section className="space-y-6">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-[#A9BFA5] font-mono block mb-1">
            SECTION I
          </span>
          <h2 className="serif text-2xl font-light text-[#E8E9D8]">
            Risks & Recommendations
          </h2>
          <p className="text-xs text-[#A9BFA5]/80 font-light mt-1">
            Proactive mitigation strategies identified by Nexora Campaign Strategist.
          </p>
        </div>

        <div className="border-t border-b border-[rgba(169,191,165,0.2)] divide-y divide-[rgba(169,191,165,0.15)] text-xs">
          {blueprint.risks.map((item, idx) => (
            <div key={item.id} className="py-5 grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-4 space-y-1">
                <div className="flex items-center space-x-2">
                  <span className={`px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-mono border ${
                    item.severity === 'High' ? 'text-rose-400 border-rose-500/30' :
                    item.severity === 'Medium' ? 'text-amber-400 border-amber-500/30' :
                    'text-[#A9BFA5] border-[rgba(169,191,165,0.2)]'
                  }`}>
                    {item.severity} Risk
                  </span>
                  <span className="font-mono text-[#A9BFA5]/50 text-[10px]">0{idx + 1}</span>
                </div>
                <p className="font-medium text-[#E8E9D8] pt-1">
                  {item.risk}
                </p>
              </div>

              <div className="md:col-span-8 text-[#A9BFA5]/90 font-light leading-relaxed pl-0 md:pl-4 border-l-0 md:border-l border-[rgba(169,191,165,0.1)]">
                <span className="text-[10px] uppercase tracking-widest font-mono text-[#A9BFA5] block mb-1">
                  Recommendation
                </span>
                {item.recommendation}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* =====================================================================
          J. NEXT STEPS
          ===================================================================== */}
      <section className="space-y-6 pt-4">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-[#A9BFA5] font-mono block mb-1">
            SECTION J
          </span>
          <h2 className="serif text-3xl font-light text-[#E8E9D8]">
            Your campaign is ready to execute.
          </h2>
          <p className="text-xs text-[#A9BFA5]/80 font-light mt-1">
            Begin with the immediate next actions below to operationalize your strategy.
          </p>
        </div>

        <div className="border border-[rgba(169,191,165,0.2)] bg-[#071C1A] divide-y divide-[rgba(169,191,165,0.15)]">
          {blueprint.nextSteps.map((step) => (
            <div
              key={step.number}
              onClick={() => {
                if (step.actionKey === 'content') onNavigateToModule?.('creative-lab', 'create');
                else if (step.actionKey === 'leads') onNavigateToModule?.('leads', 'lead-automation');
                else if (step.actionKey === 'social') onNavigateToModule?.('social-hub', 'connect');
                else if (step.actionKey === 'schedule') onNavigateToModule?.('social-hub', 'manual-scheduling');
                else if (step.actionKey === 'launch') onStartCampaign?.();
              }}
              className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#0D2D2A]/40 transition-colors cursor-pointer group"
            >
              <div className="flex items-start space-x-4">
                <span className="font-mono text-xs text-[#A9BFA5]/60 mt-0.5">
                  {step.number}
                </span>
                <div>
                  <h4 className="text-sm font-medium text-[#E8E9D8] group-hover:text-white transition-colors">
                    {step.title}
                  </h4>
                  <p className="text-xs text-[#A9BFA5]/70 font-light mt-0.5">
                    {step.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 text-xs font-mono uppercase tracking-wider text-[#A9BFA5] group-hover:text-[#E8E9D8] shrink-0">
                <span>Execute</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
