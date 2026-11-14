import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Palette, Trash2, Upload } from 'lucide-react';
import {
  analyzeBrandStyle,
  getBrandStyle,
  removeBrandImage,
  setBrandStyleOptions,
  uploadBrandImages,
  type BrandStyle,
} from '../../../legacy/services/plannerService';
import { usePlannerStyles } from './plannerUi';

interface Props {
  isAdmin: boolean;
  onNotify: (msg: string, kind?: 'ok' | 'error') => void;
}

/** Upload previous posts; the assistant learns the look and new images follow it. */
export default function BrandStylePanel({ isAdmin, onNotify }: Props) {
  const s = usePlannerStyles();
  const [style, setStyle] = useState<BrandStyle | null>(null);
  const [busy, setBusy] = useState<null | 'upload' | 'analyze' | 'toggle'>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setStyle(await getBrandStyle());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your brand style');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(kind: NonNullable<typeof busy>, fn: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  }

  const onPick = (files: FileList | null) => {
    const list = Array.from(files || []);
    if (input.current) input.current.value = '';
    if (!list.length) return;
    void run('upload', async () => {
      const r = await uploadBrandImages(list);
      setStyle(r);
      if (r.rejected || r.skipped) onNotify(`${r.added} added. ${r.rejected ? `${r.rejected} were not images. ` : ''}${r.skipped ? `${r.skipped} did not fit (limit ${r.limits.maxImages}).` : ''}`);
    });
  };

  const count = style?.images.length ?? 0;
  const min = style?.limits.minToAnalyze ?? 3;
  const max = style?.limits.maxImages ?? 12;
  const g = style?.guide;

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <div className="flex items-center gap-2">
          <Palette className={`w-4 h-4 ${s.muted}`} />
          <h3 className={`text-base font-bold ${s.title}`}>Make images look like your brand</h3>
        </div>
        <p className={`text-xs mt-1 ${s.muted}`}>
          Upload {min}–{max} of your previous posts (the ones that look the way you want). The assistant studies their colors, layout and mood, then uses that and a few of your originals as a reference every time it creates an image. New images are made from scratch, never copied from your posts.
        </p>
      </div>

      <div className={`rounded-lg border p-4 space-y-3 ${s.border} ${s.soft}`}>
        <div className="flex items-center justify-between gap-2">
          <p className={`text-sm font-bold ${s.title}`}>
            Your example posts <span className={`font-normal ${s.muted}`}>({count}/{max})</span>
          </p>
          {isAdmin && (
            <>
              <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => onPick(e.target.files)} />
              <button type="button" disabled={busy !== null || count >= max} onClick={() => input.current?.click()} className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 disabled:opacity-50 ${s.secondary}`}>
                {busy === 'upload' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {busy === 'upload' ? 'Uploading…' : 'Upload posts'}
              </button>
            </>
          )}
        </div>

        {count === 0 ? (
          <p className={`text-xs ${s.muted}`}>No examples yet. PNG, JPG or WebP, up to 5MB each. Screenshots of your best posts work well.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {style!.images.map((img) => (
              <div key={img.id} className="relative group aspect-square rounded-md overflow-hidden">
                <img src={img.url} alt="Example post" className="w-full h-full object-cover" />
                {isAdmin && (
                  <button
                    type="button"
                    aria-label="Remove this example"
                    disabled={busy !== null}
                    onClick={() => void run('toggle', async () => setStyle(await removeBrandImage(img.id)))}
                    className="absolute top-1 right-1 p-1.5 rounded-md bg-black/60 text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {isAdmin && (
          <button
            type="button"
            disabled={busy !== null || count < min}
            onClick={() =>
              void run('analyze', async () => {
                setStyle(await analyzeBrandStyle());
                onNotify('Your brand style is ready. New images will follow it.');
              })
            }
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 disabled:opacity-50 ${s.primary}`}
          >
            {busy === 'analyze' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {busy === 'analyze' ? 'Studying your posts…' : g ? 'Study my posts again' : 'Learn my style'}
          </button>
        )}
        {count < min && <p className={`text-[11px] ${s.muted}`}>Add at least {min} posts so the style is clear.</p>}
        {style?.stale && <p className="text-xs font-medium text-amber-500">You changed the examples since the style was learned. Study them again to update it.</p>}
      </div>

      {g && (
        <div className={`rounded-lg border p-4 space-y-3 ${s.border}`}>
          <div className="flex items-center justify-between gap-2">
            <p className={`text-sm font-bold ${s.title}`}>What the assistant sees in your posts</p>
            <label className={`flex items-center gap-2 text-xs font-semibold ${s.title}`}>
              <input type="checkbox" checked={style!.enabled} disabled={!isAdmin || busy !== null} onChange={(e) => void run('toggle', async () => setStyle(await setBrandStyleOptions({ enabled: e.target.checked })))} />
              Use it for new images
            </label>
          </div>
          <p className={`text-xs ${s.title}`}>{g.summary}</p>
          {g.palette.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {g.palette.map((c) => (
                <div key={c.hex} className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md border border-black/10" style={{ background: c.hex }} />
                  <span className={`text-[11px] ${s.muted}`}>{c.hex.toUpperCase()} · {c.role}</span>
                </div>
              ))}
            </div>
          )}
          <dl className="grid gap-2 sm:grid-cols-2 text-xs">
            {([['Look', g.look], ['Composition', g.composition], ['Usually shows', g.subjects], ['Lighting', g.lighting], ['Text on images', g.typography]] as const).map(([k, v]) => (
              <div key={k}>
                <dt className={`font-semibold ${s.muted}`}>{k}</dt>
                <dd className={s.title}>{v}</dd>
              </div>
            ))}
            {g.recurringElements.length > 0 && (
              <div>
                <dt className={`font-semibold ${s.muted}`}>Repeated details</dt>
                <dd className={s.title}>{g.recurringElements.join(' · ')}</dd>
              </div>
            )}
            {g.avoid.length > 0 && (
              <div>
                <dt className={`font-semibold ${s.muted}`}>Kept out</dt>
                <dd className={s.title}>{g.avoid.join(' · ')}</dd>
              </div>
            )}
          </dl>
          <label className={`flex items-center gap-2 text-xs font-semibold ${s.title}`}>
            <input type="checkbox" checked={style!.overlay} disabled={!isAdmin || busy !== null} onChange={(e) => void run('toggle', async () => setStyle(await setBrandStyleOptions({ overlay: e.target.checked })))} />
            Add a short headline to each image
          </label>
          <p className={`text-[11px] ${s.muted}`}>The headline and one-line benefit are written from the post itself, then added to the picture in your brand colors with your website address, so they are always spelled correctly. The headline is saved on the post and kept when you regenerate only the image. Rewriting the post writes a new one.</p>
        </div>
      )}

      {error && <p className="text-xs font-medium text-rose-500">{error}</p>}
    </div>
  );
}
