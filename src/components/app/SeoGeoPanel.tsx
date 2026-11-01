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
import { PLATFORM_TABS, SeoGeoToolTabPanel, type SeoGeoPlatformTab } from './SeoGeoToolTabs';

interface SeoGeoPanelProps {
  variant?: 'overview' | 'legacy';
  onNavigate?: (category: NavCategory, subCategory?: SubCategory) => void;
  onLegacyAdmin?: () => void;
  isLight?: boolean;
  className?: string;
}

const ALL_CATEGORIES: Array<SeoGeoCategory | 'all'> = ['all', 'technical_seo', 'local_seo', 'geo'];
const ALL_PRIORITIES: Array<SeoGeoPriority | 'all'> = ['all', 'P0', 'P1', 'P2', 'P3'];
const ALL_STATUSES: Array<RecommendationStatus | 'all'> = [
  'all',
  'open',
  'needs_verification',
  'in_progress',
  'verified',
  'dismissed',
];

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
    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${tone}`}>{priority}</span>
  );
}

function RecommendationCard({
  rec,
  isLight,
  busy,
  onStatus,
}: {
  rec: SeoGeoRecommendation;
  isLight: boolean;
  busy: boolean;
  onStatus: (id: string, status: RecommendationStatus) => void | Promise<void>;
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
            <span className={`text-[10px] font-semibold uppercase ${muted}`}>{categoryLabel(rec.category)}</span>
            <span className={`text-[10px] ${muted}`}>Score {rec.score}</span>
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
        <span className="font-semibold">Fix: </span>
        {rec.recommendedAction}
      </p>
      <p className={`text-xs ${muted}`}>
        <span className="font-semibold">Verify: </span>
        {rec.verificationMethod}
      </p>

      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className={`flex items-center gap-1 text-[11px] font-semibold ${isLight ? 'text-teal-700' : 'text-teal-400'}`}
      >
        Evidence ({rec.evidence.length})
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
          <li>Evidence type: {confirmationLabel(rec.confirmationLevel as ConfirmationLevel)} · Effort: {rec.effort}</li>
        </ul>
      )}

      <div className="flex flex-wrap gap-1.5 pt-1">
        {(['open', 'in_progress', 'needs_verification', 'verified', 'dismissed'] as RecommendationStatus[]).map(
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
              {statusLabel(s)}
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
  const [status, setStatus] = useState<RecommendationStatus | 'all'>('all');

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
      if (status !== 'all' && r.status !== status) return false;
      return true;
    });
  }, [data, category, priority, status]);

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
            <h2 className={`text-base font-bold ${title}`}>Attract · SEO / GEO</h2>
          </div>
          <p className={`text-xs ${muted}`}>
            Evidence-based audit — not a ranking guarantee
            {data?.summary
              ? ` · ${data.summary.open + data.summary.inProgress} active · ${data.summary.byPriority.P0 || 0} P0`
              : ''}
          </p>
          {data?.crawlSummary && (
            <p className={`text-[11px] ${muted}`}>
              Last audit {new Date(data.runAt).toLocaleString()}
              {data.crawlSummary.origin
                ? ` · ${data.crawlSummary.homepageOk ? 'Site crawled' : 'Crawl issues'}${
                    data.crawlSummary.pagesCrawled ? ` · ${data.crawlSummary.pagesCrawled} pages` : ''
                  }`
                : ' · No website URL'}
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
              Brand & NAP
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
            {auditing ? 'Auditing…' : 'Re-audit'}
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

      {platformTab !== 'audit' && (
        <SeoGeoToolTabPanel tab={platformTab} isLight={isLight} onError={setError} />
      )}

      {platformTab === 'audit' && data?.integrations && (
        <div className={`flex flex-wrap items-center gap-2 text-[10px] ${muted}`}>
          <span className={`px-2 py-1 rounded-md border ${isLight ? 'border-slate-200' : 'border-[rgba(169,191,165,0.15)]'}`}>
            GSC:{' '}
            {data.integrations.googleSearchConsole.connected
              ? data.integrations.googleSearchConsole.siteUrl || 'Synced'
              : 'Not connected'}
          </span>
          <span className={`px-2 py-1 rounded-md border ${isLight ? 'border-slate-200' : 'border-[rgba(169,191,165,0.15)]'}`}>
            GBP:{' '}
            {data.integrations.googleBusinessProfile.connected
              ? data.integrations.googleBusinessProfile.locationTitle || 'Synced'
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
            <span className="italic">Add GOOGLE_SEO_CLIENT_ID on server to enable connect.</span>
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
              {c === 'all' ? 'All categories' : categoryLabel(c as SeoGeoCategory)}
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
              {p === 'all' ? 'All priorities' : p}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as RecommendationStatus | 'all')}
          className={`text-[11px] rounded-lg border px-2 py-1.5 ${isLight ? 'border-slate-200 bg-white' : 'border-[rgba(169,191,165,0.2)] bg-[#061816] text-[#E8E9D8]'}`}
        >
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === 'all' ? 'All statuses' : statusLabel(s as RecommendationStatus)}
            </option>
          ))}
        </select>
      </div>
      )}

      {error && (
        <p className={`text-xs rounded-lg px-3 py-2 ${isLight ? 'bg-rose-50 text-rose-800' : 'bg-rose-500/10 text-rose-200'}`}>
          {error}
        </p>
      )}

      {platformTab === 'audit' &&
        (loading && !data ? (
          <p className={`text-xs ${muted}`}>Running discoverability audit…</p>
        ) : filtered.length === 0 ? (
          <p className={`text-xs ${muted}`}>
            {data?.recommendations.length
              ? 'No recommendations match these filters.'
              : 'No open issues detected — re-audit after site or knowledge changes.'}
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
              />
            ))}
          </ul>
        ))}

      {platformTab === 'audit' && variant === 'overview' && data?.summary && (
        <p className={`text-[10px] ${muted} border-t pt-2 ${isLight ? 'border-slate-200' : 'border-[rgba(169,191,165,0.15)]'}`}>
          {data.summary.verified} verified · {data.summary.dismissed} dismissed · Audit ID {data.auditId.slice(0, 12)}…
        </p>
      )}
    </section>
  );
}
