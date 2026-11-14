import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PLATFORM_LABEL, getPostAnalytics, refreshPostAnalytics, type PostAnalytics } from '../../legacy/services/plannerService';

const fmt = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString());

function ago(iso: string | null | undefined): string {
  if (!iso) return 'not yet';
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return 'just now';
  return mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)} h ago`;
}

/** How the posts we published are doing, read from each platform. A dash means the platform did not share that number. */
export default function PostPerformance() {
  const [data, setData] = useState<PostAnalytics | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await getPostAnalytics());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load post performance');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await refreshPostAnalytics(true);
      setData(r);
      const failed = Object.entries(r.errors || {});
      if (failed.length) setError(failed.map(([p, m]) => `${PLATFORM_LABEL[p as keyof typeof PLATFORM_LABEL] || p}: ${m}`).join(' '));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the numbers');
    } finally {
      setBusy(false);
    }
  };

  const platforms = data ? (Object.entries(data.platforms) as [string, PostAnalytics['platforms'][string]][]) : [];

  return (
    <div className="space-y-4 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[#A9BFA5] max-w-2xl normal-case">
          Real numbers read from each platform for the posts we published for you. A dash means that platform does not share that number, which is not the same as zero.
        </p>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[#A9BFA5]/80">Updated {ago(data?.lastRefreshedAt)}</span>
          <button type="button" onClick={() => void refresh()} disabled={busy} className="px-3 py-1.5 rounded-[2px] bg-[#E8E9D8] text-[#071C1A] font-semibold uppercase tracking-wider disabled:opacity-50 flex items-center gap-2">
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Refresh numbers
          </button>
        </div>
      </div>

      {error && <p className="p-3 rounded bg-rose-500/10 text-rose-200 border border-rose-500/30 normal-case">{error}</p>}

      {data && data.posts.length === 0 && (
        <p className="p-5 bg-[#061816] border border-[rgba(169,191,165,0.2)] rounded text-[#A9BFA5] normal-case">
          Nothing published yet. When posts from the Content Planner go live, their performance shows here.
        </p>
      )}

      {platforms.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {platforms.map(([p, t]) => (
            <div key={p} className="p-4 bg-[#061816] border border-[rgba(169,191,165,0.2)] rounded space-y-1">
              <span className="uppercase text-[#A9BFA5]/80 font-semibold">{PLATFORM_LABEL[p as keyof typeof PLATFORM_LABEL] || p}</span>
              <p className="text-white text-lg font-bold">{t.posts} post{t.posts === 1 ? '' : 's'}</p>
              {t.unavailable ? (
                <p className="text-amber-300 normal-case">{t.unavailable}</p>
              ) : (
                <p className="text-[#A9BFA5] normal-case">
                  {t.hasViews ? `${fmt(t.views)} views · ` : ''}
                  {fmt(t.likes)} likes · {fmt(t.comments)} comments · {fmt(t.shares)} shares
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {data && data.posts.length > 0 && (
        <div className="bg-[#061816] border border-[rgba(169,191,165,0.2)] rounded divide-y divide-[rgba(169,191,165,0.1)]">
          {data.posts.map((p) => (
            <div key={p.id} className="p-4 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="uppercase font-semibold text-[#A9BFA5]">{PLATFORM_LABEL[p.platform]}</span>
                <span className="text-[#A9BFA5]/70">{new Date(p.publishedAt).toLocaleString()}</span>
                {p.url && (
                  <a href={p.url} target="_blank" rel="noreferrer" className="text-emerald-300 hover:underline">
                    View post
                  </a>
                )}
              </div>
              <p className="text-white normal-case line-clamp-2">{p.text}</p>
              {p.metrics?.unavailable ? (
                <p className="text-amber-300 normal-case">{p.metrics.unavailable}</p>
              ) : p.metrics ? (
                <p className="text-[#A9BFA5]">
                  Views {fmt(p.metrics.views)} · Likes {fmt(p.metrics.likes)} · Comments {fmt(p.metrics.comments)} · Shares {fmt(p.metrics.shares)}
                  {p.metrics.saves != null ? ` · Saves ${fmt(p.metrics.saves)}` : ''}
                  {p.metrics.note && <span className="block text-[#A9BFA5]/70 normal-case mt-0.5">{p.metrics.note}</span>}
                </p>
              ) : (
                <p className="text-[#A9BFA5]/70 normal-case">Not read yet. Click "Refresh numbers".</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
