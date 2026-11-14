import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, ImagePlus, Loader2, Plus } from 'lucide-react';
import {
  PLATFORM_LABEL,
  PlannerError,
  approveCampaign,
  createMissingImages,
  getCampaign,
  getPlanJob,
  listCampaigns,
  pollJob,
  uploadDayImage,
  type ApprovalProblem,
  type PlannerCampaign,
  type PlannerPost,
  type PostStatus,
} from '../../../legacy/services/plannerService';
import PostCard from './PostCard';
import { PLATFORM_COLOR, PLATFORM_SHORT, STATUS_CHIP, STATUS_LABEL, countdown, prettyDay, prettyTime, usePlannerStyles } from './plannerUi';

interface Props {
  campaignId: string | null;
  isAdmin: boolean;
  onSelectCampaign: (id: string | null) => void;
  onNewPlan: () => void;
  onOpenChannels: () => void;
  onNotify: (msg: string, kind?: 'ok' | 'error') => void;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const pad = (n: number) => String(n).padStart(2, '0');

function monthCells(year: number, month: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Monday first
  const length = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= length; d += 1) cells.push(`${year}-${pad(month + 1)}-${pad(d)}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}

export default function CalendarReview({ campaignId, isAdmin, onSelectCampaign, onNewPlan, onOpenChannels, onNotify }: Props) {
  const s = usePlannerStyles();
  const [campaigns, setCampaigns] = useState<PlannerCampaign[]>([]);
  const [campaign, setCampaign] = useState<PlannerCampaign | null>(null);
  const [posts, setPosts] = useState<PlannerPost[]>([]);
  const [connections, setConnections] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ y: number; m: number } | null>(null);
  const [problems, setProblems] = useState<{ message: string; list: ApprovalProblem[] } | null>(null);
  const [approving, setApproving] = useState(false);
  const [dayBusy, setDayBusy] = useState(false);
  const [fillingImages, setFillingImages] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const dayFile = useRef<HTMLInputElement>(null);
  const picked = useRef(false);

  const tz = campaign?.timezone || 'UTC';

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const list = await listCampaigns();
        setCampaigns(list);
        const id = campaignId && list.some((c) => c.id === campaignId) ? campaignId : list[0]?.id || null;
        if (id && id !== campaignId) onSelectCampaign(id);
        if (!id) {
          setCampaign(null);
          setPosts([]);
          return;
        }
        const data = await getCampaign(id);
        setCampaign(data.campaign);
        setPosts(data.posts);
        setConnections(data.connections);
      } catch (err) {
        onNotify(err instanceof Error ? err.message : 'Could not load your calendar', 'error');
      } finally {
        setLoading(false);
      }
    },
    [campaignId, onSelectCampaign, onNotify]
  );

  useEffect(() => {
    picked.current = false;
    void load();
  }, [campaignId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep things fresh while images render or posts are going out; tick the countdown.
  const busyStates = posts.some((p) => p.imageStatus === 'pending' || p.status === 'publishing') || campaign?.status === 'generating';
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!busyStates) return undefined;
    const t = setInterval(() => void load(true), 4000);
    return () => clearInterval(t);
  }, [busyStates, load]);
  useEffect(() => {
    // Also pick up publish results while the owner is looking at the calendar.
    const t = setInterval(() => void load(true), 60_000);
    return () => clearInterval(t);
  }, [load]);

  const byDay = useMemo(() => {
    const m = new Map<string, PlannerPost[]>();
    for (const p of posts) m.set(p.dayKey, [...(m.get(p.dayKey) || []), p]);
    return m;
  }, [posts]);

  // First time a campaign opens: jump to the first day that needs a look and show its month.
  useEffect(() => {
    if (!posts.length || picked.current) return;
    picked.current = true;
    const days = [...byDay.keys()].sort();
    const needs = days.find((d) => byDay.get(d)!.some((p) => ['draft', 'failed', 'missed'].includes(p.status))) || days[0];
    setSelectedDay(needs);
    const [y, m] = needs.split('-').map(Number);
    setCursor({ y, m: m - 1 });
  }, [posts, byDay]);

  const counts = useMemo(() => {
    const c: Record<PostStatus, number> = { draft: 0, approved: 0, publishing: 0, published: 0, failed: 0, missed: 0, cancelled: 0 };
    for (const p of posts) c[p.status] += 1;
    return c;
  }, [posts]);
  const needsAttention = counts.failed + counts.missed;
  const reviewable = posts.filter((p) => ['draft', 'failed', 'missed'].includes(p.status));
  const imagesPending = posts.filter((p) => p.imageStatus === 'pending').length;
  const missingImages = posts.filter((p) => !p.image && p.imageStatus !== 'pending' && ['draft', 'failed', 'missed'].includes(p.status)).length;
  const next = posts.filter((p) => p.status === 'approved').sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];
  const dayPosts = selectedDay ? [...(byDay.get(selectedDay) || [])].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)) : [];

  const replacePost = (p: PlannerPost) => setPosts((cur) => cur.map((x) => (x.id === p.id ? p : x)));
  const removePost = (id: string) => setPosts((cur) => cur.filter((x) => x.id !== id));

  async function approveAll(onlyValid = false) {
    if (!campaign) return;
    setApproving(true);
    try {
      const r = await approveCampaign(campaign.id, onlyValid);
      setProblems(null);
      onNotify(`${r.approved.length} post${r.approved.length === 1 ? '' : 's'} approved and scheduled.${r.skipped.length ? ` ${r.skipped.length} still need attention.` : ''}`, 'ok');
      await load(true);
    } catch (err) {
      if (err instanceof PlannerError && err.problems) setProblems({ message: err.message, list: err.problems });
      else onNotify(err instanceof Error ? err.message : 'Could not approve', 'error');
    } finally {
      setApproving(false);
    }
  }

  async function fillImages() {
    if (!campaign) return;
    setFillingImages('Starting…');
    try {
      const first = await createMissingImages(campaign.id);
      await pollJob(first, getPlanJob, (j) => setFillingImages(j.detail?.total ? `Creating images (${j.detail.done || 0} of ${j.detail.total})…` : 'Creating images…'));
      await load(true);
      onNotify('Images created.', 'ok');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not create the images', 'error');
      await load(true);
    } finally {
      setFillingImages(null);
    }
  }

  async function uploadForDay(file: File) {
    if (!campaign || !selectedDay) return;
    setDayBusy(true);
    try {
      const r = await uploadDayImage(campaign.id, file, { date: selectedDay });
      onNotify(`Your image will be used on ${r.updated.length} post${r.updated.length === 1 ? '' : 's'} on ${prettyDay(selectedDay)}.`, 'ok');
      await load(true);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setDayBusy(false);
    }
  }

  if (loading && !campaign) {
    return (
      <div className={`flex items-center justify-center gap-2 py-20 text-sm ${s.muted}`}>
        <Loader2 className="w-4 h-4 animate-spin" /> Loading your calendar…
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className={`${s.card} p-10 text-center space-y-3`}>
        <CalendarDays className={`w-8 h-8 mx-auto ${s.muted}`} />
        <p className={`text-base font-bold ${s.title}`}>No campaigns yet</p>
        <p className={`text-sm ${s.muted}`}>Write one prompt and we will build a full calendar for you to review.</p>
        <button type="button" onClick={onNewPlan} className={`px-4 py-2 rounded-lg text-sm font-bold ${s.primary}`}>
          Create your first plan
        </button>
      </div>
    );
  }

  const cur = cursor || { y: new Date().getFullYear(), m: new Date().getMonth() };
  const cells = monthCells(cur.y, cur.m);
  const shiftMonth = (d: number) => setCursor(({ y, m }) => ({ y: m + d < 0 ? y - 1 : m + d > 11 ? y + 1 : y, m: (m + d + 12) % 12 }) as { y: number; m: number });

  return (
    <div className="space-y-5">
      {/* header: campaign + approve */}
      <div className={`${s.card} p-4 sm:p-5 space-y-4`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={campaign.id}
                onChange={(e) => onSelectCampaign(e.target.value)}
                className={`text-base font-bold bg-transparent border-0 p-0 pr-6 focus:outline-none max-w-full ${s.title}`}
                aria-label="Choose campaign"
              >
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.theme || c.prompt.slice(0, 50)}
                  </option>
                ))}
              </select>
              {campaign.status === 'generating' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-500">Still building…</span>}
            </div>
            <p className={`text-xs mt-0.5 ${s.muted}`}>
              {campaign.summary || campaign.prompt.slice(0, 140)} · {campaign.days} days from {campaign.startDate} · {tz.replace(/_/g, ' ')}
            </p>
            {!!campaign.skipped?.length && (
              <p className="text-xs mt-1 text-amber-500">
                {campaign.skipped.map((k) => `${PLATFORM_LABEL[k.platform]} has no post: ${k.reason}`).join(' ')}
              </p>
            )}
          </div>
          <button type="button" onClick={onNewPlan} className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${s.secondary}`}>
            <Plus className="w-3.5 h-3.5" /> New plan
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { label: 'Needs review', value: counts.draft, tone: 'text-amber-500' },
            { label: 'Scheduled', value: counts.approved + counts.publishing, tone: 'text-sky-500' },
            { label: 'Published', value: counts.published, tone: 'text-emerald-500' },
            { label: 'Needs attention', value: needsAttention, tone: needsAttention ? 'text-rose-500' : s.muted },
          ].map((k) => (
            <div key={k.label} className={`rounded-lg px-3 py-2.5 ${s.soft}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${s.muted}`}>{k.label}</p>
              <p className={`text-2xl font-bold ${k.tone}`}>{k.value}</p>
            </div>
          ))}
        </div>

        {missingImages > 0 && imagesPending === 0 && (
          <div className={`rounded-lg px-3.5 py-3 flex flex-wrap items-center justify-between gap-3 ${s.isLight ? 'bg-amber-50 border border-amber-200' : 'bg-amber-950/25 border border-amber-800/40'}`}>
            <p className={`text-sm ${s.isLight ? 'text-amber-900' : 'text-amber-100'}`}>
              <span className="font-bold">{missingImages}</span> post{missingImages === 1 ? ' has' : 's have'} no image. The image service may have been busy.
            </p>
            <button type="button" disabled={Boolean(fillingImages)} onClick={() => void fillImages()} className={`px-3.5 py-2 rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-60 ${s.primary}`}>
              {fillingImages ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />} {fillingImages || 'Create the missing images'}
            </button>
          </div>
        )}

        {isAdmin && reviewable.length > 0 && (
          <div className={`rounded-lg px-3.5 py-3 flex flex-wrap items-center justify-between gap-3 ${s.isLight ? 'bg-teal-50 border border-teal-200' : 'bg-[#0D2D2A] border border-teal-500/30'}`}>
            <p className={`text-sm ${s.title}`}>
              <span className="font-bold">{reviewable.length}</span> post{reviewable.length === 1 ? '' : 's'} waiting for your approval. Nothing is posted until you approve.
              {imagesPending > 0 && <span className={`block text-[11px] ${s.muted}`}>{imagesPending} image{imagesPending === 1 ? ' is' : 's are'} still being created.</span>}
            </p>
            <button type="button" disabled={approving} onClick={() => void approveAll(false)} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-60 ${s.primary}`}>
              {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Approve all {reviewable.length}
            </button>
          </div>
        )}

        {problems && (
          <div className={`rounded-lg border px-3.5 py-3 space-y-2 ${s.isLight ? 'bg-amber-50 border-amber-200' : 'bg-amber-950/25 border-amber-800/40'}`}>
            <p className={`text-sm font-bold flex items-center gap-2 ${s.isLight ? 'text-amber-900' : 'text-amber-100'}`}>
              <AlertTriangle className="w-4 h-4" /> {problems.message}
            </p>
            <ul className="space-y-1 max-h-44 overflow-y-auto">
              {problems.list.map((p) => (
                <li key={p.postId} className={`text-xs ${s.isLight ? 'text-amber-900' : 'text-amber-100'}`}>
                  <button type="button" className="font-semibold underline" onClick={() => { setSelectedDay(p.dayKey); const [y, m] = p.dayKey.split('-').map(Number); setCursor({ y, m: m - 1 }); }}>
                    {PLATFORM_LABEL[p.platform]} · {prettyDay(p.dayKey)}
                  </button>
                  : {p.issues.map((i) => i.message).join(' ')}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              {problems.list.some((p) => p.issues.some((i) => i.code === 'not_connected')) && (
                <button type="button" onClick={onOpenChannels} className={`px-3 py-1.5 rounded-md text-xs font-semibold ${s.secondary}`}>
                  Open Channels
                </button>
              )}
              {reviewable.length > problems.list.length && (
                <button type="button" disabled={approving} onClick={() => void approveAll(true)} className={`px-3 py-1.5 rounded-md text-xs font-bold disabled:opacity-60 ${s.primary}`}>
                  Approve the {reviewable.length - problems.list.length} that are ready
                </button>
              )}
              <button type="button" onClick={() => setProblems(null)} className={`px-3 py-1.5 rounded-md text-xs font-semibold ${s.ghost}`}>
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* month grid */}
        <div className={`${s.card} p-4 xl:col-span-1 space-y-3 self-start`}>
          <div className="flex items-center justify-between">
            <button type="button" aria-label="Previous month" onClick={() => shiftMonth(-1)} className={`p-1.5 rounded-md ${s.ghost}`}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <p className={`text-sm font-bold ${s.title}`}>
              {MONTHS[cur.m]} {cur.y}
            </p>
            <button type="button" aria-label="Next month" onClick={() => shiftMonth(1)} className={`p-1.5 rounded-md ${s.ghost}`}>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((w) => (
              <span key={w} className={`text-[10px] font-bold uppercase ${s.muted}`}>
                {w}
              </span>
            ))}
            {cells.map((day, i) => {
              if (!day) return <span key={`e${i}`} />;
              const list = byDay.get(day) || [];
              const sel = day === selectedDay;
              const attention = list.some((p) => ['failed', 'missed'].includes(p.status));
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={`aspect-square rounded-md border text-[11px] flex flex-col items-center justify-between py-1 ${sel ? s.selected : list.length ? s.idle : 'border-transparent'} ${list.length ? s.title : s.muted} ${attention ? 'ring-1 ring-rose-500/60' : ''}`}
                  aria-label={`${prettyDay(day)}: ${list.length} post${list.length === 1 ? '' : 's'}`}
                >
                  <span className="font-semibold">{Number(day.slice(8))}</span>
                  <span className="flex flex-wrap justify-center gap-0.5 px-0.5">
                    {list.slice(0, 4).map((p) => (
                      <span key={p.id} className={`w-1.5 h-1.5 rounded-full ${STATUS_CHIP[p.status].dot}`} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
          <div className={`flex flex-wrap gap-x-3 gap-y-1 pt-1 text-[10px] ${s.muted}`}>
            {(['draft', 'approved', 'published', 'failed'] as PostStatus[]).map((st) => (
              <span key={st} className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CHIP[st].dot}`} /> {STATUS_LABEL[st]}
              </span>
            ))}
          </div>

          {next && (
            <div className={`rounded-lg px-3 py-2.5 ${s.soft} space-y-1`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${s.muted}`}>
                <Clock className="w-3 h-3" /> Next post goes out in
              </p>
              <p className={`text-xl font-bold ${s.title}`}>{countdown(next.scheduledAt, now)}</p>
              <p className={`text-[11px] ${s.muted}`}>
                <span className={`inline-block px-1.5 rounded text-[9px] font-bold mr-1 ${PLATFORM_COLOR[next.platform]}`}>{PLATFORM_SHORT[next.platform]}</span>
                {prettyTime(next.scheduledAt, tz)}
              </p>
            </div>
          )}
        </div>

        {/* day panel */}
        <div className="xl:col-span-2 space-y-3">
          {selectedDay ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className={`text-lg font-bold ${s.title}`}>{prettyDay(selectedDay)}</h3>
                {dayPosts.length > 0 && !dayPosts.every((p) => ['published', 'publishing'].includes(p.status)) && (
                  <>
                    <button type="button" disabled={dayBusy} onClick={() => dayFile.current?.click()} className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60 ${s.secondary}`}>
                      {dayBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />} Use my own image for this day
                    </button>
                    <input
                      ref={dayFile}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (f) void uploadForDay(f);
                      }}
                    />
                  </>
                )}
              </div>
              {dayPosts.length === 0 ? (
                <div className={`${s.card} p-8 text-center text-sm ${s.muted}`}>Nothing is planned for this day.</div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {dayPosts.map((p) => (
                    <PostCard key={p.id} post={p} timezone={tz} isAdmin={isAdmin} onChange={replacePost} onRemoved={removePost} onMessage={onNotify} />
                  ))}
                </div>
              )}
              {dayPosts.some((p) => !connections[p.platform]) && (
                <p className="text-[11px] text-amber-500">
                  Some platforms on this day aren't connected.{' '}
                  <button type="button" onClick={onOpenChannels} className="underline font-semibold">
                    Connect them in Channels
                  </button>{' '}
                  before approving.
                </p>
              )}
            </>
          ) : (
            <div className={`${s.card} p-8 text-center text-sm ${s.muted}`}>Choose a day on the calendar.</div>
          )}
        </div>
      </div>
    </div>
  );
}
