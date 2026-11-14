import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, ImageOff, Loader2, RefreshCw, Send, Sparkles, Trash2, Undo2, Upload } from 'lucide-react';
import {
  PLATFORM_LABEL,
  approvePost,
  deletePost,
  editPost,
  publishPostNow,
  regeneratePost,
  unapprovePost,
  uploadPostImage,
  type PlannerPost,
} from '../../../legacy/services/plannerService';
import { PLATFORM_COLOR, PLATFORM_SHORT, STATUS_CHIP, STATUS_LABEL, localDay, localTime, usePlannerStyles } from './plannerUi';

interface Props {
  /** Accepted so lists can key cards (this project's typings do not add it for function components). */
  key?: React.Key;
  post: PlannerPost;
  timezone: string;
  isAdmin: boolean;
  onChange: (post: PlannerPost) => void;
  onRemoved: (id: string) => void;
  onMessage: (msg: string, kind?: 'ok' | 'error') => void;
}

const tagsToText = (tags: string[]) => tags.map((t) => `#${t}`).join(' ');
const textToTags = (text: string) =>
  text
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#+/, '').trim())
    .filter(Boolean);

export default function PostCard({ post, timezone, isAdmin, onChange, onRemoved, onMessage }: Props) {
  const s = usePlannerStyles();
  const [text, setText] = useState(post.text);
  const [tags, setTags] = useState(tagsToText(post.hashtags));
  const [date, setDate] = useState(localDay(post.scheduledAt, timezone));
  const [time, setTime] = useState(localTime(post.scheduledAt, timezone));
  const [busy, setBusy] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [instruction, setInstruction] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const serverText = post.text;
  const serverTags = tagsToText(post.hashtags);
  const serverDate = localDay(post.scheduledAt, timezone);
  const serverTime = localTime(post.scheduledAt, timezone);
  const dirty = text !== serverText || tags !== serverTags || date !== serverDate || time !== serverTime;

  // Take in changes made elsewhere (regenerate, another tab) unless the owner is mid-edit.
  useEffect(() => {
    setText(serverText);
    setTags(serverTags);
    setDate(serverDate);
    setTime(serverTime);
  }, [post.id, serverText, serverTags, serverDate, serverTime]);

  const locked = post.status === 'publishing' || post.status === 'published';
  const errors = post.issues.filter((i) => i.severity === 'error');
  const warnings = post.issues.filter((i) => i.severity === 'warning');
  const liveLength = text.length + (textToTags(tags).length ? tagsToText(textToTags(tags)).length + 2 : 0);
  const over = post.maxLength !== null && liveLength > post.maxLength;

  async function run<T>(label: string, fn: () => Promise<T>, okMsg?: string): Promise<T | null> {
    setBusy(label);
    try {
      const out = await fn();
      if (okMsg) onMessage(okMsg, 'ok');
      return out;
    } catch (err) {
      onMessage(err instanceof Error ? err.message : 'Something went wrong', 'error');
      return null;
    } finally {
      setBusy(null);
    }
  }

  const save = () =>
    run('save', async () => {
      const updated = await editPost(post.id, { text, hashtags: textToTags(tags), date, time });
      onChange(updated);
      return updated;
    }, post.status === 'approved' ? 'Saved. This post needs approving again.' : 'Saved.');

  const regenerateText = () =>
    run('text', async () => {
      const updated = await regeneratePost(post.id, { scope: 'text', instruction: instruction.trim() || undefined });
      onChange(updated);
      setAsking(false);
      setInstruction('');
    }, 'Rewritten.');

  const regenerateImage = () =>
    run('image', async () => onChange(await regeneratePost(post.id, { scope: 'image' })), 'New image ready.');

  const upload = (file: File) => run('upload', async () => onChange(await uploadPostImage(post.id, file)), 'Image uploaded.');

  const approve = () =>
    run('approve', async () => {
      if (dirty) await save();
      const r = await approvePost(post.id);
      if (r.skipped.length) throw new Error(r.skipped[0].issues[0]?.message || 'This post cannot be approved yet.');
      onChange({ ...post, status: 'approved' });
    }, 'Approved and scheduled.');

  const unapprove = () => run('unapprove', async () => onChange(await unapprovePost(post.id)), 'Back to review.');

  const publishNow = () =>
    run('publish', async () => {
      const r = await publishPostNow(post.id);
      onChange(r.post);
      if (r.post.status === 'published') onMessage('Published.', 'ok');
      else onMessage(r.post.lastError || 'It could not be published.', 'error');
    });

  const remove = () => {
    if (!confirm('Delete this post?')) return;
    void run('delete', async () => {
      await deletePost(post.id);
      onRemoved(post.id);
    });
  };

  const chip = STATUS_CHIP[post.status];

  return (
    <article className={`${s.card} overflow-hidden flex flex-col ${post.status === 'failed' || post.status === 'missed' ? (s.isLight ? 'border-rose-300' : 'border-rose-700/60') : ''}`}>
      <header className={`px-3.5 py-2.5 flex items-center justify-between gap-2 border-b ${s.border}`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold ${PLATFORM_COLOR[post.platform]}`}>{PLATFORM_SHORT[post.platform]}</span>
          <div className="min-w-0">
            <p className={`text-sm font-bold ${s.title}`}>{PLATFORM_LABEL[post.platform]}</p>
            <p className={`text-[11px] truncate ${s.muted}`} title={post.rationale || post.topic}>
              {post.topic}
            </p>
          </div>
        </div>
        <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${s.isLight ? chip.light : chip.dark}`}>{STATUS_LABEL[post.status]}</span>
      </header>

      {/* image */}
      <div className={`relative aspect-video ${s.soft} group`}>
        {post.previewUrl ? (
          <img src={post.previewUrl} alt="" className="w-full h-full object-cover" />
        ) : post.imageStatus === 'pending' ? (
          <div className={`w-full h-full flex flex-col items-center justify-center gap-2 text-xs ${s.muted}`}>
            <Loader2 className="w-5 h-5 animate-spin" /> Creating image…
          </div>
        ) : (
          <div className={`w-full h-full flex flex-col items-center justify-center gap-1.5 px-6 text-center text-xs ${post.imageStatus === 'failed' ? 'text-rose-500' : s.muted}`}>
            <ImageOff className="w-5 h-5" />
            {post.imageStatus === 'failed' ? `Image could not be created${post.imageError ? ` (${post.imageError})` : ''}.` : 'No image.'}
            <span>Create one or upload your own.</span>
          </div>
        )}
        {post.image?.source === 'uploaded' && <span className="absolute top-2 left-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/60 text-white">Your image</span>}
        {!locked && (
          <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/70 to-transparent flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <button type="button" disabled={Boolean(busy)} onClick={() => void regenerateImage()} className="flex-1 bg-white/90 hover:bg-white text-slate-900 rounded-md px-2 py-1.5 text-[11px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-60">
              {busy === 'image' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} New AI image
            </button>
            <button type="button" disabled={Boolean(busy)} onClick={() => fileRef.current?.click()} className="flex-1 bg-white/90 hover:bg-white text-slate-900 rounded-md px-2 py-1.5 text-[11px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-60">
              {busy === 'upload' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} Upload
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void upload(f);
              }}
            />
          </div>
        )}
      </div>

      <div className="p-3.5 space-y-3 flex-1">
        <label className={`block text-[11px] font-semibold ${s.muted}`}>
          <span className="flex items-center justify-between">
            <span>Post text</span>
            <span className={over ? 'text-rose-500 font-bold' : ''}>
              {liveLength}
              {post.maxLength ? ` / ${post.maxLength}` : ''}
            </span>
          </span>
          <textarea value={text} disabled={locked} onChange={(e) => setText(e.target.value)} rows={post.platform === 'x' ? 4 : 7} className={`${s.input} resize-y leading-relaxed`} />
        </label>
        <label className={`block text-[11px] font-semibold ${s.muted}`}>
          Hashtags
          <input value={tags} disabled={locked} onChange={(e) => setTags(e.target.value)} placeholder="#yoga #pune" className={s.input} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className={`block text-[11px] font-semibold ${s.muted}`}>
            Day
            <input type="date" value={date} disabled={locked} onChange={(e) => setDate(e.target.value)} className={s.input} />
          </label>
          <label className={`block text-[11px] font-semibold ${s.muted}`}>
            Time
            <input type="time" value={time} disabled={locked} onChange={(e) => setTime(e.target.value)} className={s.input} />
          </label>
        </div>

        {post.rationale && <p className={`text-[11px] italic ${s.muted}`}>Why this post: {post.rationale}</p>}

        {(errors.length > 0 || warnings.length > 0) && (
          <ul className="space-y-1">
            {errors.map((i) => (
              <li key={i.code} className="flex gap-1.5 text-[11px] text-rose-500">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" /> {i.message}
              </li>
            ))}
            {warnings.map((i) => (
              <li key={i.code} className="flex gap-1.5 text-[11px] text-amber-500">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" /> {i.message}
              </li>
            ))}
          </ul>
        )}

        {(post.status === 'failed' || post.status === 'missed') && post.lastError && (
          <div className={`rounded-md px-2.5 py-2 text-[11px] space-y-1 ${s.isLight ? 'bg-rose-50 text-rose-800' : 'bg-rose-950/30 text-rose-200'}`}>
            <p className="font-semibold">{post.status === 'missed' ? 'This was not posted in time.' : 'This could not be posted.'}</p>
            <p>{post.lastError}</p>
            {post.errorKind === 'unknown' && <p className="font-semibold">Check the platform first. If it is not there, retry.</p>}
          </div>
        )}

        {post.status === 'published' && post.publishedAt && (
          <p className="text-[11px] text-emerald-500 font-semibold">
            Published {new Intl.DateTimeFormat(undefined, { timeZone: timezone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(post.publishedAt))}
            {post.publishedUrl && (
              <>
                {' · '}
                <a href={post.publishedUrl} target="_blank" rel="noreferrer" className="underline">
                  View post
                </a>
              </>
            )}
          </p>
        )}

        {asking && (
          <div className="space-y-2">
            <input autoFocus value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Optional: shorter, more playful, mention the free class…" className={s.input} />
            <div className="flex gap-2">
              <button type="button" disabled={Boolean(busy)} onClick={() => void regenerateText()} className={`px-3 py-1.5 rounded-md text-[11px] font-semibold flex items-center gap-1.5 disabled:opacity-60 ${s.secondary}`}>
                {busy === 'text' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Rewrite
              </button>
              <button type="button" onClick={() => setAsking(false)} className={`px-3 py-1.5 rounded-md text-[11px] font-semibold ${s.ghost}`}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {!locked && (
        <footer className={`px-3.5 py-2.5 border-t ${s.border} flex flex-wrap items-center gap-2`}>
          {dirty && (
            <button type="button" disabled={Boolean(busy)} onClick={() => void save()} className={`px-3 py-1.5 rounded-md text-[11px] font-bold flex items-center gap-1.5 disabled:opacity-60 ${s.primary}`}>
              {busy === 'save' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save changes
            </button>
          )}
          {!asking && (
            <button type="button" disabled={Boolean(busy)} onClick={() => setAsking(true)} className={`px-3 py-1.5 rounded-md text-[11px] font-semibold flex items-center gap-1.5 ${s.ghost}`}>
              <RefreshCw className="w-3 h-3" /> Rewrite
            </button>
          )}
          {isAdmin && post.status === 'approved' && (
            <button type="button" disabled={Boolean(busy)} onClick={() => void unapprove()} className={`px-3 py-1.5 rounded-md text-[11px] font-semibold flex items-center gap-1.5 ${s.ghost}`}>
              <Undo2 className="w-3 h-3" /> Back to review
            </button>
          )}
          {isAdmin && ['draft', 'failed', 'missed'].includes(post.status) && (
            <button type="button" disabled={Boolean(busy) || errors.length > 0} title={errors[0]?.message} onClick={() => void approve()} className={`px-3 py-1.5 rounded-md text-[11px] font-bold flex items-center gap-1.5 disabled:opacity-50 ${s.secondary}`}>
              {busy === 'approve' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Approve
            </button>
          )}
          {isAdmin && ['approved', 'failed', 'missed'].includes(post.status) && (
            <button type="button" disabled={Boolean(busy)} onClick={() => void publishNow()} className={`px-3 py-1.5 rounded-md text-[11px] font-semibold flex items-center gap-1.5 ${s.ghost}`}>
              {busy === 'publish' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} {post.status === 'approved' ? 'Post now' : 'Retry now'}
            </button>
          )}
          <button type="button" disabled={Boolean(busy)} onClick={remove} className={`ml-auto px-2 py-1.5 rounded-md text-[11px] font-semibold flex items-center gap-1 ${s.danger}`} aria-label="Delete post">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </footer>
      )}
    </article>
  );
}
