import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Download, Loader2 } from 'lucide-react';
import type { SubCategory } from '../../types';
import { fetchLeads, getLeadCounts } from '../../legacy/services/leadStore';
import type { Lead } from '../../legacy/types';
import { getInstagramStatus } from '../../legacy/services/instagramService';
import { getFacebookStatus } from '../../legacy/services/facebookService';
import { getWhatsAppStatus } from '../../legacy/services/whatsappService';
import { getAgentAudit, getCompanyStatus } from '../../legacy/services/companyService';

export type AnalyticsTab = 'overview' | 'leads' | 'channels' | 'activity';

interface LiveAnalyticsProps {
  activeSubCategory: SubCategory;
  onNavigateSub: (sub: SubCategory) => void;
  onOpenLead?: (leadId: string) => void;
}

function channelLabel(lead: Lead): string {
  const raw = (lead.channel || lead.platform || 'web').toLowerCase();
  if (raw.includes('whatsapp') || raw === 'whatsapp') return 'WhatsApp';
  if (raw.includes('instagram') || raw === 'instagram') return 'Instagram';
  if (raw.includes('facebook') || raw === 'facebook') return 'Facebook';
  if (raw.includes('linkedin')) return 'LinkedIn';
  if (raw.includes('manual')) return 'Manual';
  return 'Website / Web';
}

function statusBucket(lead: Lead): 'new' | 'engaged' | 'qualified' | 'handed' | 'closed' {
  const s = String(lead.status || 'new').toLowerCase();
  if (s === 'handed_off' || lead.conversationState === 'HUMAN_REQUIRED' || lead.conversationState === 'HUMAN_ACTIVE') {
    return 'handed';
  }
  if (s === 'qualified') return 'qualified';
  if (s === 'contacted') return 'engaged';
  if (s === 'closed') return 'closed';
  return 'new';
}

export default function LiveAnalytics({ activeSubCategory, onNavigateSub, onOpenLead }: LiveAnalyticsProps) {
  const initialTab: AnalyticsTab =
    activeSubCategory === 'leads' || activeSubCategory === 'lead-analytics'
      ? 'leads'
      : activeSubCategory === 'channels' || activeSubCategory === 'channel-performance'
        ? 'channels'
        : activeSubCategory === 'activity-log' || activeSubCategory === 'stats'
          ? 'activity'
          : 'overview';

  const [currentTab, setCurrentTab] = useState<AnalyticsTab>(initialTab);
  const [dateRange, setDateRange] = useState('Last 30 days');
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [companyName, setCompanyName] = useState('');
  const [channels, setChannels] = useState<{ name: string; connected: boolean; detail: string }[]>([]);
  const [audit, setAudit] = useState<Awaited<ReturnType<typeof getAgentAudit>>>([]);

  useEffect(() => {
    setCurrentTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      fetchLeads().catch(() => []),
      getCompanyStatus().catch(() => null),
      getInstagramStatus().catch(() => null),
      getFacebookStatus().catch(() => null),
      getWhatsAppStatus().catch(() => null),
      getAgentAudit(30).catch(() => []),
    ])
      .then(([leadList, company, ig, fb, wa, auditRows]) => {
        if (cancelled) return;
        setLeads(leadList);
        setCompanyName(company?.companyName || '');
        setChannels([
          {
            name: 'Instagram',
            connected: Boolean(ig?.connected),
            detail: ig?.account?.username ? `@${ig.account.username}` : 'Not connected',
          },
          {
            name: 'Facebook',
            connected: Boolean(fb?.connected),
            detail: fb?.account?.pageName || 'Not connected',
          },
          {
            name: 'WhatsApp',
            connected: Boolean(wa?.configured),
            detail: wa?.phoneNumberId ? `Phone ${String(wa.phoneNumberId).slice(0, 6)}…` : 'Not configured',
          },
          {
            name: 'Website / Web',
            connected: true,
            detail: 'Lead Agent + Growth chat',
          },
        ]);
        setAudit(auditRows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const counts = getLeadCounts();
    const total = leads.length || counts.hot + counts.warm + counts.cold;
    const hot = leads.filter((l) => l.temperature === 'hot').length || counts.hot;
    const warm = leads.filter((l) => l.temperature === 'warm').length || counts.warm;
    const cold = leads.filter((l) => l.temperature === 'cold').length || counts.cold;
    const qualified = leads.filter((l) => statusBucket(l) === 'qualified').length;
    const handed = leads.filter((l) => statusBucket(l) === 'handed').length;
    const closed = leads.filter((l) => statusBucket(l) === 'closed').length;
    const contacted = leads.filter((l) => statusBucket(l) === 'engaged').length;
    const aiActive = leads.filter(
      (l) => !l.conversationState || l.conversationState === 'AI_ACTIVE' || l.conversationState === 'AI_WAITING'
    ).length;
    const aiHandledPct = total ? Math.round((aiActive / total) * 100) : 0;

    const bySource = new Map<string, number>();
    for (const lead of leads) {
      const key = channelLabel(lead);
      bySource.set(key, (bySource.get(key) || 0) + 1);
    }
    const sourceRows = [...bySource.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const channelRows = ['WhatsApp', 'Instagram', 'Facebook', 'Website / Web', 'Manual', 'LinkedIn'].map((name) => {
      const subset = leads.filter((l) => channelLabel(l) === name);
      const qual = subset.filter((l) => statusBucket(l) === 'qualified' || l.temperature === 'hot').length;
      const won = subset.filter((l) => statusBucket(l) === 'closed').length;
      const convRate = subset.length ? `${Math.round((qual / subset.length) * 100)}%` : '—';
      return {
        name,
        conv: subset.length,
        leads: subset.length,
        qual,
        won,
        convRate,
        reply: name === 'WhatsApp' || name === 'Instagram' ? 'AI / channel' : 'Inbox',
      };
    }).filter((r) => r.leads > 0 || ['WhatsApp', 'Instagram', 'Website / Web'].includes(r.name));

    // Rough sparkline from lead ages (last 14 buckets)
    const now = Date.now();
    const dayMs = 86400000;
    const buckets = Array.from({ length: 14 }, (_, i) => {
      const start = now - (14 - i) * dayMs;
      const end = start + dayMs;
      return leads.filter((l) => {
        const t = new Date(l.lastMessageAt || l.createdAt || 0).getTime();
        return t >= start && t < end;
      }).length;
    });
    const maxBucket = Math.max(1, ...buckets);

    const activity = [
      ...leads.slice(0, 12).map((l) => ({
        id: l.id,
        time: l.lastMessageAt || l.createdAt
          ? new Date(l.lastMessageAt || l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '—',
        kind: l.temperature === 'hot' ? 'hot' : statusBucket(l) === 'handed' ? 'handoff' : 'lead',
        text: `${channelLabel(l)} · ${(l.author || l.platform || 'Lead').toString().slice(0, 40)} · score ${l.score ?? '—'}`,
        leadId: l.id,
      })),
      ...audit.slice(0, 8).map((row) => ({
        id: row.event_id,
        time: row.timestamp
          ? new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '—',
        kind: 'audit' as const,
        text: `${row.action || 'agent'} · ${row.policy_decision || row.status || '—'} · ${row.result?.intent || ''}`,
        leadId: undefined as string | undefined,
      })),
    ].slice(0, 16);

    return {
      total,
      hot,
      warm,
      cold,
      qualified,
      handed,
      closed,
      contacted,
      aiHandledPct,
      sourceRows,
      channelRows,
      buckets,
      maxBucket,
      activity,
      qualPct: total ? Math.round((qualified / total) * 100) : 0,
      hotPct: total ? Math.round((hot / total) * 100) : 0,
    };
  }, [leads, audit]);

  const setTab = (tab: AnalyticsTab, sub: SubCategory) => {
    setCurrentTab(tab);
    onNavigateSub(sub);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-[#A9BFA5]">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading live analytics…
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-fadeIn text-[#E8E9D8] select-text font-mono">
      <div className="border-b border-[rgba(169,191,165,0.2)] pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-2 sm:space-x-3 overflow-x-auto pb-1 sm:pb-0">
          <span className="serif text-2xl font-light text-white mr-1 tracking-tight">Analytics</span>
          {(
            [
              ['overview', 'overview', 'Overview'],
              ['leads', 'leads', 'Leads'],
              ['channels', 'channels', 'Channels'],
              ['activity', 'activity-log', 'Activity'],
            ] as const
          ).map(([tab, sub, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setTab(tab, sub)}
              className={`px-3 py-1.5 rounded-[2px] text-xs uppercase tracking-wider transition-colors cursor-pointer ${
                currentTab === tab
                  ? 'bg-[#E8E9D8] text-[#071C1A] font-semibold'
                  : 'bg-[#061816] text-[#A9BFA5] border border-[rgba(169,191,165,0.2)] hover:border-[#A9BFA5]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

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
            </select>
            <ChevronDown className="w-3 h-3 text-[#A9BFA5]/60 absolute right-2 top-2.5 pointer-events-none" />
          </div>
          <button
            type="button"
            onClick={() => {
              const rows = [
                ['id', 'channel', 'temperature', 'score', 'status', 'comment'],
                ...leads.map((l) => [
                  l.id,
                  channelLabel(l),
                  l.temperature,
                  String(l.score ?? ''),
                  l.status,
                  (l.customerComment || '').replace(/\n/g, ' ').slice(0, 120),
                ]),
              ];
              const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `nexora-leads-${Date.now()}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="px-3 py-1.5 bg-[#061816] hover:bg-[#0D2D2A] border border-[rgba(169,191,165,0.25)] text-[#E8E9D8] rounded-[2px] cursor-pointer flex items-center space-x-1"
          >
            <Download className="w-3 h-3" />
            <span>Export</span>
          </button>
        </div>
      </div>

      <p className="text-[11px] text-[#A9BFA5]">
        Live CRM for {companyName || 'your workspace'} · {dateRange} · {stats.total} leads
      </p>

      {currentTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: 'LEADS', value: String(stats.total), meta: `${stats.hot} hot` },
              { label: 'HOT', value: String(stats.hot), meta: `${stats.hotPct}%` },
              { label: 'QUALIFIED', value: String(stats.qualified), meta: `${stats.qualPct}%` },
              { label: 'HANDOFFS', value: String(stats.handed), meta: 'Human' },
              { label: 'AI HANDLED', value: `${stats.aiHandledPct}%`, meta: 'Auto' },
            ].map((k) => (
              <div key={k.label} className="p-4 bg-[#061816] border border-[rgba(169,191,165,0.2)] rounded-[2px]">
                <span className="text-[10px] text-[#A9BFA5]/70 uppercase font-semibold block">{k.label}</span>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-2xl text-white font-light">{k.value}</span>
                  <span className="text-xs text-emerald-400 font-semibold">{k.meta}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="p-5 bg-[#061816] border border-[rgba(169,191,165,0.2)] rounded-[2px] space-y-3">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-[rgba(169,191,165,0.12)]">
              <span className="uppercase text-[#A9BFA5]/80 font-semibold">LEADS OVER TIME (14 DAYS)</span>
            </div>
            <div className="h-32 flex items-end justify-between gap-1.5 pt-4">
              {stats.buckets.map((val, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
                  <div
                    className="w-full bg-[#0D2D2A] group-hover:bg-emerald-400 transition-colors rounded-t-[1px] min-h-[2px]"
                    style={{ height: `${(val / stats.maxBucket) * 100}%` }}
                  />
                  <span className="text-[9px] text-[#A9BFA5]/40">{idx + 1}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
            <div className="p-5 bg-[#061816] border border-[rgba(169,191,165,0.2)] rounded-[2px] space-y-3">
              <span className="uppercase text-[#A9BFA5]/80 font-semibold block pb-2 border-b border-[rgba(169,191,165,0.12)]">
                FUNNEL (LIVE)
              </span>
              <div className="space-y-2 text-[#E8E9D8]">
                <div className="flex justify-between"><span>Total ({stats.total})</span><span>100%</span></div>
                <div className="flex justify-between"><span>Hot ({stats.hot})</span><span>{stats.hotPct}%</span></div>
                <div className="flex justify-between"><span>Warm ({stats.warm})</span><span>{stats.total ? Math.round((stats.warm / stats.total) * 100) : 0}%</span></div>
                <div className="flex justify-between"><span>Contacted ({stats.contacted})</span><span>{stats.total ? Math.round((stats.contacted / stats.total) * 100) : 0}%</span></div>
                <div className="flex justify-between"><span>Qualified ({stats.qualified})</span><span>{stats.qualPct}%</span></div>
                <div className="flex justify-between text-emerald-300 font-semibold"><span>Handoffs ({stats.handed})</span><span>{stats.total ? Math.round((stats.handed / stats.total) * 100) : 0}%</span></div>
              </div>
            </div>

            <div className="p-5 bg-[#061816] border border-[rgba(169,191,165,0.2)] rounded-[2px] space-y-3">
              <span className="uppercase text-[#A9BFA5]/80 font-semibold block pb-2 border-b border-[rgba(169,191,165,0.12)]">
                CHANNEL HEALTH
              </span>
              <div className="space-y-3 pt-1">
                {channels.map((c) => (
                  <div key={c.name} className="flex justify-between items-baseline gap-2">
                    <span className="text-[#A9BFA5]">{c.name}</span>
                    <span className={`font-bold text-sm ${c.connected ? 'text-emerald-400' : 'text-amber-300'}`}>
                      {c.connected ? c.detail : 'Disconnected'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {currentTab === 'leads' && (
        <div className="space-y-5 text-xs">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="p-5 bg-[#061816] border border-[rgba(169,191,165,0.2)] rounded space-y-3">
              <span className="uppercase text-[#A9BFA5]/80 font-semibold block pb-2 border-b border-[rgba(169,191,165,0.12)]">
                BY SOURCE
              </span>
              {stats.sourceRows.length === 0 ? (
                <p className="text-[#A9BFA5]">No leads yet.</p>
              ) : (
                <div className="space-y-2">
                  {stats.sourceRows.map((row) => {
                    const max = stats.sourceRows[0]?.count || 1;
                    return (
                      <div key={row.name} className="flex justify-between items-center">
                        <span className="w-28 truncate">{row.name}</span>
                        <div className="flex-1 bg-[#071C1A] h-2.5 mx-3 rounded">
                          <div
                            className="bg-emerald-400 h-full rounded"
                            style={{ width: `${Math.max(8, (row.count / max) * 100)}%` }}
                          />
                        </div>
                        <span className="w-8 text-right font-bold">{row.count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-5 bg-[#061816] border border-[rgba(169,191,165,0.2)] rounded space-y-3">
              <span className="uppercase text-[#A9BFA5]/80 font-semibold block pb-2 border-b border-[rgba(169,191,165,0.12)]">
                BY TEMPERATURE
              </span>
              <div className="space-y-2">
                {[
                  { name: 'Hot', count: stats.hot, color: 'bg-rose-400' },
                  { name: 'Warm', count: stats.warm, color: 'bg-amber-400' },
                  { name: 'Cold', count: stats.cold, color: 'bg-[#A9BFA5]' },
                ].map((row) => (
                  <div key={row.name} className="flex justify-between items-center">
                    <span className="w-28">{row.name}</span>
                    <div className="flex-1 bg-[#071C1A] h-2.5 mx-3 rounded">
                      <div
                        className={`${row.color} h-full rounded`}
                        style={{ width: `${stats.total ? Math.max(8, (row.count / stats.total) * 100) : 0}%` }}
                      />
                    </div>
                    <span className="w-8 text-right font-bold">{row.count}</span>
                  </div>
                ))}
              </div>
              <p className="text-[#A9BFA5] pt-2 leading-relaxed">
                Closed: {stats.closed} · Contacted: {stats.contacted} · Qualified: {stats.qualified}
              </p>
            </div>
          </div>
        </div>
      )}

      {currentTab === 'channels' && (
        <div className="space-y-4 text-xs">
          <div className="border border-[rgba(169,191,165,0.2)] bg-[#061816] rounded overflow-x-auto">
            <div className="min-w-[700px] grid grid-cols-12 px-5 py-3 bg-[#071C1A] border-b border-[rgba(169,191,165,0.15)] text-[10px] uppercase font-semibold text-[#A9BFA5]">
              <div className="col-span-3">Channel</div>
              <div className="col-span-2 text-right">Conversations</div>
              <div className="col-span-2 text-right">Leads</div>
              <div className="col-span-2 text-right">Hot / Qual</div>
              <div className="col-span-1 text-right">Closed</div>
              <div className="col-span-1 text-right">Conv. %</div>
              <div className="col-span-1 text-right">Mode</div>
            </div>
            <div className="divide-y divide-[rgba(169,191,165,0.1)]">
              {stats.channelRows.map((c) => (
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
            ✦ Live from your CRM — connect more channels under Channels to grow these numbers.
          </div>
        </div>
      )}

      {currentTab === 'activity' && (
        <div className="space-y-4 text-xs">
          <div className="p-5 bg-[#061816] border border-[rgba(169,191,165,0.2)] rounded space-y-4">
            <span className="uppercase text-[#A9BFA5]/80 font-semibold block pb-2 border-b border-[rgba(169,191,165,0.12)]">
              RECENT ACTIVITY
            </span>
            {stats.activity.length === 0 ? (
              <p className="text-[#A9BFA5] py-4">No activity yet. Chat with Ava or capture a lead.</p>
            ) : (
              <div className="divide-y divide-[rgba(169,191,165,0.1)]">
                {stats.activity.map((row) => (
                  <div key={row.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <span className="text-[#A9BFA5]/70 shrink-0">{row.time}</span>
                      <span className={row.kind === 'handoff' ? 'text-amber-400' : row.kind === 'hot' ? 'text-rose-400' : 'text-emerald-400'}>
                        {row.kind === 'handoff' ? '👤' : row.kind === 'audit' ? '✦' : '＋'}
                      </span>
                      <span className="text-white truncate">{row.text}</span>
                    </div>
                    {row.leadId && (
                      <button
                        type="button"
                        className="text-emerald-300 hover:underline shrink-0"
                        onClick={() => onOpenLead?.(row.leadId!)}
                      >
                        [Open]
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
