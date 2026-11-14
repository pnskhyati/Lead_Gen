import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Globe2, Loader2, RefreshCw } from 'lucide-react';
import { useOptionalTheme } from '../../context/ThemeContext';
import type { NavCategory, SubCategory } from '../../types';
import {
  categoryLabel,
  confirmationLabel,
  disconnectSeoGeoGoogle,
  loadSeoGeoRecommendations,
  patchSeoGeoRecommendation,
  proposeSeoGeoFix,
  runSeoGeoAudit,
  startSeoGeoGoogleOAuth,
  statusLabel,
  type ConfirmationLevel,
  type RecommendationStatus,
  type SeoGeoCategory,
  type SeoGeoPriority,
  type SeoGeoRecommendation,
  type SeoGeoRecommendationsResponse,
} from '../../legacy/services/seoGeoService';
import { PLATFORM_TABS, TAB_HELP, SeoGeoToolTabPanel, type SeoGeoPlatformTab } from './SeoGeoToolTabs';

interface SeoGeoPanelProps {
  variant?: 'overview' | 'legacy';
  onNavigate?: (category: NavCategory, subCategory?: SubCategory) => void;
  onLegacyAdmin?: () => void;
  isLight?: boolean;
  className?: string;
}

const ALL_CATEGORIES: Array<SeoGeoCategory | 'all'> = ['all', 'technical_seo', 'local_seo', 'geo'];
const ALL_PRIORITIES: Array<SeoGeoPriority | 'all'> = ['all', 'P0', 'P1', 'P2'];

const PENALTY: Record<string, number> = { P0: 12, P1: 6, P2: 3, P3: 1 };

/** 0-100 from the problems still unfixed. Done and ignored items do not count against the site. */
function healthScore(recs: SeoGeoRecommendation[]): number {
  const penalty = recs
    .filter((r) => r.status !== 'verified' && r.status !== 'dismissed')
    .reduce((sum, r) => sum + (PENALTY[r.priority] ?? 1), 0);
  return Math.max(0, 100 - penalty);
}

function scoreBand(score: number): { label: string; tone: string } {
  if (score >= 85) return { label: 'Good', tone: 'text-emerald-500' };
  if (score >= 60) return { label: 'Needs work', tone: 'text-amber-500' };
  return { label: 'Poor', tone: 'text-rose-500' };
}

const PRIORITY_LABEL: Record<string, string> = { P0: 'Fix first', P1: 'Important', P2: 'When you can', P3: 'When you can' };

function PriorityBadge({ priority, isLight }: { priority: SeoGeoPriority; isLight: boolean }) {
  const tone =
    priority === 'P0'
      ? isLight
        ? 'bg-rose-100 text-rose-900 border-rose-200'
        : 'bg-rose-500/20 text-rose-200 border-rose-500/40'
      : priority === 'P1'
        ? isLight
          ? 'bg-amber-100 text-amber-900 border-amber-200'
          : 'bg-amber-500/20 text-amber-200 border-amber-500/40'
        : isLight
          ? 'bg-slate-100 text-slate-700 border-slate-200'
          : 'bg-[#0D2D2A] text-[#A9BFA5] border-[rgba(169,191,165,0.2)]';
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${tone}`}>{PRIORITY_LABEL[priority] || priority}</span>
  );
}

function RecommendationCard({
  rec,
  isLight,
  busy,
  onStatus,
  onDraft,
}: {
  rec: SeoGeoRecommendation;
  isLight: boolean;
  busy: boolean;
  onStatus: (id: string, status: RecommendationStatus) => void | Promise<void>;
  onDraft: (id: string) => void | Promise<void>;
}) {
  const muted = isLight ? 'text-slate-500' : 'text-[#A9BFA5]';
  const title = isLight ? 'text-slate-900' : 'text-white';
  const [expanded, setExpanded] = useState(false);

  return (
    <li
      className={`rounded-lg border px-3 py-3 space-y-2 ${
        isLight ? 'bg-slate-50/90 border-slate-200' : 'bg-[#061816] border-[rgba(169,191,165,0.15)]'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={rec.priority} isLight={isLight} />
            <span className={`text-[10px] font-semibold ${muted}`}>{categoryLabel(rec.category)}</span>
          </div>
          <p className={`text-sm font-semibold leading-snug ${title}`}>{rec.title}</p>
        </div>
        <span
          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
            isLight ? 'border-slate-200 text-slate-600' : 'border-[rgba(169,191,165,0.2)] text-[#A9BFA5]'
          }`}
        >
          {statusLabel(rec.status)}
        </span>
      </div>

      <p className={`text-xs ${muted}`}>
        <span className="font-semibold text-teal-700 dark:text-teal-400">Why it matters: </span>
        {rec.businessImpact}
      </p>
      <p className={`text-xs ${title}`}>
        <span className="font-semibold">What to do: </span>
        {rec.recommendedAction}
      </p>

      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className={`flex items-center gap-1 text-[11px] font-semibold ${isLight ? 'text-teal-700' : 'text-teal-400'}`}
      >
        How we found this
        <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <ul className={`text-[11px] list-disc pl-4 space-y-0.5 ${muted}`}>
          {rec.evidence.map((line) => (
            <li key={line}>{line}</li>
          ))}
          {rec.affectedUrls.length > 0 && (
            <li>
              URLs:{' '}
              {rec.affectedUrls.map((u) => (
                <a key={u} href={u} target="_blank" rel="noreferrer" className="underline break-all">
                  {u}
                </a>
              ))}
            </li>
          )}
          <li>How to check it is fixed: {rec.verificationMethod}</li>
          <li>{confirmationLabel(rec.confirmationLevel as ConfirmationLevel)} · Effort: {rec.effort}</li>
        </ul>
      )}

      <div className="flex flex-wrap gap-1.5 pt-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onDraft(rec.id)}
          className={`text-[10px] font-semibold px-2 py-1 rounded-md ${isLight ? 'bg-teal-600 text-white' : 'bg-teal-500/30 text-teal-100'} disabled:opacity-50`}
        >
          Draft a fix
        </button>
        {(['in_progress', 'verified', 'dismissed', 'open'] as RecommendationStatus[])
          .filter((s) => s !== 'open' || rec.status !== 'open')
          .map(
          (s) => (
            <button
              key={s}
              type="button"
              disabled={busy}
              onClick={() => onStatus(rec.id, s)}
              className={`text-[10px] font-semibold px-2 py-1 rounded-md border disabled:opacity-50 ${
                rec.status === s
                  ? isLight
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-teal-500/30 text-teal-100 border-teal-500/40'
                  : isLight
                    ? 'bg-white border-slate-200 text-slate-600'
                    : 'border-[rgba(169,191,165,0.2)] text-[#A9BFA5]'
              }`}
            >
              {s === 'open' ? 'Reopen' : s === 'in_progress' ? 'Working on it' : statusLabel(s)}
            </button>
          )
        )}
      </div>
    </li>
  );
}

export default function SeoGeoPanel({
  variant = 'overview',
  onNavigate,
  onLegacyAdmin,
  isLight: isLightProp,
  className = '',
}: SeoGeoPanelProps) {
  const themeCtx = useOptionalTheme();
  const isLight = isLightProp ?? (themeCtx ? themeCtx.theme === 'light' : true);

  const [data, setData] = useState<SeoGeoRecommendationsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [auditing, setAuditing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [connectBusy, setConnectBusy] = useState(false);

  const [platformTab, setPlatformTab] = useState<SeoGeoPlatformTab>('audit');
  const [category, setCategory] = useState<SeoGeoCategory | 'all'>('all');
  const [priority, setPriority] = useState<SeoGeoPriority | 'all'>('all');
  const [showDone, setShowDone] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await loadSeoGeoRecommendations();
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load SEO / GEO audit');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.recommendations.filter((r) => {
      if (category !== 'all' && r.category !== category) return false;
      if (priority !== 'all' && r.priority !== priority) return false;
      if (!showDone && (r.status === 'verified' || r.status === 'dismissed')) return false;
      return true;
    });
  }, [data, category, priority, showDone]);

  const onConnectGoogle = async () => {
    setConnectBusy(true);
    setError(null);
    try {
      const { url } = await startSeoGeoGoogleOAuth();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start Google connect');
      setConnectBusy(false);
    }
  };

  const onDisconnectGoogle = async () => {
    setConnectBusy(true);
    try {
      await disconnectSeoGeoGoogle();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Disconnect failed');
    } finally {
      setConnectBusy(false);
    }
  };

  const onReAudit = async () => {
    setAuditing(true);
    setError(null);
    try {
      await runSeoGeoAudit();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Audit failed');
    } finally {
      setAuditing(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('seoGeoConnected') === '1') {
      params.delete('seoGeoConnected');
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
      window.history.replaceState(null, '', next);
      void onReAudit();
    }
    const oauthErr = params.get('seoGeoError');
    if (oauthErr) {
      setError(`Google connect failed: ${oauthErr}`);
      params.delete('seoGeoError');
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const onDraft = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await proposeSeoGeoFix({ recommendationId: id, issueType: 'generic' });
      setPlatformTab('advanced');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not draft a fix');
    } finally {
      setBusyId(null);
    }
  };

  const onStatus = async (id: string, next: RecommendationStatus) => {
    setBusyId(id);
    try {
      await patchSeoGeoRecommendation(id, next);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  const card = isLight
    ? 'rounded-xl border border-slate-200 bg-white shadow-2xs'
    : 'rounded-xl border border-[rgba(169,191,165,0.18)] bg-[#071C1A]';
  const muted = isLight ? 'text-slate-500' : 'text-[#A9BFA5]';
  const title = isLight ? 'text-slate-900' : 'text-white';

  return (
    <section className={`${card} p-4 sm:p-5 space-y-4 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Globe2 className={`w-4 h-4 ${isLight ? 'text-teal-600' : 'text-teal-400'}`} />
            <h2 className={`text-base font-bold ${title}`}>Get found online</h2>
          </div>
          <p className={`text-xs ${muted}`}>
            Show up when people search on Google (SEO) and when they ask AI tools like ChatGPT and Gemini (GEO).
          </p>
          {data?.summary && (
            <p className={`text-[11px] ${muted}`}>
              {data.summary.open + data.summary.inProgress === 0
                ? 'Nothing to fix right now.'
                : `${data.summary.open + data.summary.inProgress} things to fix${data.summary.byPriority.P0 ? `, ${data.summary.byPriority.P0} to fix first` : ''}.`}
              {data.crawlSummary?.origin ? ` Checked ${new Date(data.runAt).toLocaleDateString()}.` : ' Add your website in Brand settings so we can check it.'}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {(onNavigate || onLegacyAdmin) && (
            <button
              type="button"
              onClick={() => (onNavigate ? onNavigate('settings', 'brand') : onLegacyAdmin?.())}
              className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg border ${
                isLight ? 'border-slate-200 text-slate-700 hover:bg-slate-50' : 'border-[rgba(169,191,165,0.2)] text-[#A9BFA5]'
              }`}
            >
              Business details
            </button>
          )}
          <button
            type="button"
            onClick={() => void onReAudit()}
            disabled={auditing}
            className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg ${
              isLight ? 'bg-teal-600 text-white hover:bg-teal-700' : 'bg-teal-500/30 text-teal-100'
            } disabled:opacity-50`}
          >
            {auditing ? 'Checking…' : 'Check my website again'}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className={`p-2 rounded-lg border ${isLight ? 'border-slate-200 text-slate-600' : 'border-[rgba(169,191,165,0.2)] text-[#A9BFA5]'}`}
            aria-label="Refresh"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b pb-2">
        {PLATFORM_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setPlatformTab(t.id)}
            className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg ${
              platformTab === t.id
                ? isLight
                  ? 'bg-teal-600 text-white'
                  : 'bg-teal-500/30 text-teal-100'
                : isLight
                  ? 'text-slate-600 hover:bg-slate-100'
                  : 'text-[#A9BFA5] hover:bg-[#0D2D2A]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {data && data.crawlSummary?.origin && (
        <div className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-[rgba(169,191,165,0.15)] bg-[#061816]'}`}>
          <span className={`text-3xl font-bold tabular-nums ${scoreBand(healthScore(data.recommendations)).tone}`}>
            {healthScore(data.recommendations)}
            <span className={`text-sm font-semibold ${muted}`}>/100</span>
          </span>
          <span className="text-xs">
            <span className={`block font-semibold ${title}`}>Website health: {scoreBand(healthScore(data.recommendations)).label}</span>
            <span className={muted}>
              Goes up as you fix things. Fix-first items count most. Based on the checks we run on your site; it is not a Google score.
            </span>
          </span>
        </div>
      )}

      <p className={`text-xs ${muted}`}>{TAB_HELP[platformTab]}</p>

      {platformTab !== 'audit' && (
        <SeoGeoToolTabPanel tab={platformTab} isLight={isLight} onError={setError} />
      )}

      {platformTab === 'audit' && data?.integrations && (
        <div className={`flex flex-wrap items-center gap-2 text-[10px] ${muted}`}>
          <span className={`px-2 py-1 rounded-md border ${isLight ? 'border-slate-200' : 'border-[rgba(169,191,165,0.15)]'}`}>
            Google Search data:{' '}
            {data.integrations.googleSearchConsole.connected
              ? data.integrations.googleSearchConsole.siteUrl || 'Connected'
              : 'Not connected'}
          </span>
          <span className={`px-2 py-1 rounded-md border ${isLight ? 'border-slate-200' : 'border-[rgba(169,191,165,0.15)]'}`}>
            Google Business:{' '}
            {data.integrations.googleBusinessProfile.connected
              ? data.integrations.googleBusinessProfile.locationTitle || 'Connected'
              : 'Not connected'}
          </span>
          {data.integrations.oauthConfigured ? (
            data.integrations.connected ? (
              <button
                type="button"
                disabled={connectBusy}
                onClick={() => void onDisconnectGoogle()}
                className={`px-2 py-1 rounded-md border font-semibold ${isLight ? 'border-slate-200' : 'border-[rgba(169,191,165,0.2)]'}`}
              >
                Disconnect Google
              </button>
            ) : (
              <button
                type="button"
                disabled={connectBusy}
                onClick={() => void onConnectGoogle()}
                className={`px-2 py-1 rounded-md font-semibold ${isLight ? 'bg-teal-600 text-white' : 'bg-teal-500/30 text-teal-100'}`}
              >
                Connect Google
              </button>
            )
          ) : (
            <span className="italic">Connecting Google is not set up on this server yet.</span>
          )}
        </div>
      )}

      {platformTab === 'audit' && (
      <div className="flex flex-wrap gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as SeoGeoCategory | 'all')}
          className={`text-[11px] rounded-lg border px-2 py-1.5 ${isLight ? 'border-slate-200 bg-white' : 'border-[rgba(169,191,165,0.2)] bg-[#061816] text-[#E8E9D8]'}`}
        >
          {ALL_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c === 'all' ? 'All topics' : categoryLabel(c as SeoGeoCategory)}
            </option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as SeoGeoPriority | 'all')}
          className={`text-[11px] rounded-lg border px-2 py-1.5 ${isLight ? 'border-slate-200 bg-white' : 'border-[rgba(169,191,165,0.2)] bg-[#061816] text-[#E8E9D8]'}`}
        >
          {ALL_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p === 'all' ? 'Everything' : PRIORITY_LABEL[p]}
            </option>
          ))}
        </select>
        <label className={`text-[11px] flex items-center gap-1.5 ${muted}`}>
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
          Show done and ignored
        </label>
      </div>
      )}

      {error && (
        <p className={`text-xs rounded-lg px-3 py-2 ${isLight ? 'bg-rose-50 text-rose-800' : 'bg-rose-500/10 text-rose-200'}`}>
          {error}
        </p>
      )}

      {platformTab === 'audit' &&
        (loading && !data ? (
          <p className={`text-xs ${muted}`}>Checking your website…</p>
        ) : filtered.length === 0 ? (
          <p className={`text-xs ${muted}`}>
            {data?.recommendations.length
              ? 'Nothing matches this filter. Nothing left to fix here.'
              : 'No problems found. Click "Check my website again" after you change your site.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((rec) => (
              <RecommendationCard
                key={rec.id}
                rec={rec}
                isLight={isLight}
                busy={busyId === rec.id}
                onStatus={onStatus}
                onDraft={onDraft}
              />
            ))}
          </ul>
        ))}

      {platformTab === 'audit' && variant === 'overview' && data?.summary && (
        <p className={`text-[10px] ${muted} border-t pt-2 ${isLight ? 'border-slate-200' : 'border-[rgba(169,191,165,0.15)]'}`}>
          {data.summary.verified} done · {data.summary.dismissed} ignored
        </p>
      )}
    </section>
  );
}
