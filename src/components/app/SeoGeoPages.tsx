import React, { useCallback, useEffect, useState } from 'react';
import { deleteSeoGeoPage, listSeoGeoPages, writeSeoGeoPage, type SeoGeoPage } from '../../legacy/services/seoGeoService';

interface Common {
  isLight: boolean;
}

const btn = (isLight: boolean, primary = false) =>
  primary
    ? `text-[11px] font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50 ${isLight ? 'bg-teal-600 text-white hover:bg-teal-700' : 'bg-teal-500/30 text-teal-100'}`
    : `text-[11px] font-semibold px-3 py-1.5 rounded-lg border disabled:opacity-50 ${isLight ? 'border-slate-200 text-slate-700' : 'border-[rgba(169,191,165,0.2)] text-[#A9BFA5]'}`;

/** Writes an answer page for one phrase or question and hands the draft back. */
export function WritePageButton({
  topic,
  kind,
  isLight,
  onError,
  onDone,
}: Common & {
  topic: string;
  kind: 'keyword' | 'question';
  onError: (msg: string | null) => void;
  onDone: (page: SeoGeoPage) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        onError(null);
        writeSeoGeoPage(topic, kind)
          .then(onDone)
          .catch((err) => onError(err instanceof Error ? err.message : 'Could not write the page'))
          .finally(() => setBusy(false));
      }}
      className={btn(isLight, true)}
    >
      {busy ? 'Writing…' : 'Write this page'}
    </button>
  );
}

function CopyButton({ label, text, isLight }: Common & { label: string; text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={btn(isLight)}
      onClick={() => {
        void navigator.clipboard
          .writeText(text)
          .then(() => {
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          })
          .catch(() => undefined);
      }}
    >
      {done ? 'Copied' : label}
    </button>
  );
}

/** One drafted page, with everything needed to put it on the website. */
export function PageDraftCard({ page, isLight, onClose }: Common & { page: SeoGeoPage; onClose?: () => void }) {
  const muted = isLight ? 'text-slate-500' : 'text-[#A9BFA5]';
  const strong = isLight ? 'text-slate-800' : 'text-white';
  const [preview, setPreview] = useState(false);
  return (
    <div className={`rounded-lg border p-3 space-y-3 ${isLight ? 'border-teal-300 bg-white' : 'border-teal-500/40 bg-[#061816]'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-[11px] ${muted}`}>Draft page for "{page.topic}"</p>
          <p className={`text-sm font-bold ${strong}`}>{page.title}</p>
          <p className={`text-xs ${muted}`}>{page.metaDescription}</p>
          <p className={`text-[11px] ${muted}`}>
            Suggested address ending: <span className="font-mono">/{page.slug}</span>
          </p>
        </div>
        {onClose && (
          <button type="button" className={`text-[11px] underline ${muted}`} onClick={onClose}>
            Close
          </button>
        )}
      </div>

      <div className={`text-xs rounded-lg px-3 py-2 ${isLight ? 'bg-slate-50' : 'bg-[#0D2D2A]'}`}>
        <p className={`font-semibold ${strong}`}>The short answer an AI is likely to quote</p>
        <p className={muted}>{page.directAnswer}</p>
      </div>

      {page.checkNumbers.length > 0 && (
        <p className={`text-xs rounded-lg px-3 py-2 ${isLight ? 'bg-amber-50 text-amber-900' : 'bg-amber-500/10 text-amber-200'}`}>
          Check these numbers before you publish, they are not in your business details: {page.checkNumbers.join(', ')}. Remove them if they are not true.
        </p>
      )}
      {page.needsInput.length > 0 && (
        <div className="text-xs">
          <p className={`font-semibold ${strong}`}>Add these to make it stronger (we do not make them up):</p>
          <ul className={`list-disc pl-4 ${muted}`}>
            {page.needsInput.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <CopyButton isLight={isLight} label="Copy page text (HTML)" text={page.html} />
        <CopyButton isLight={isLight} label="Copy as Markdown" text={page.markdown} />
        <CopyButton isLight={isLight} label="Copy search-engine code" text={page.schema} />
        <CopyButton isLight={isLight} label="Copy title and description" text={`${page.title}\n${page.metaDescription}`} />
        <button type="button" className={btn(isLight)} onClick={() => setPreview((v) => !v)}>
          {preview ? 'Hide preview' : 'Preview'}
        </button>
      </div>
      {preview && (
        <div
          className={`text-xs space-y-2 rounded-lg border p-3 max-h-96 overflow-auto [&_h1]:text-base [&_h1]:font-bold [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-3 [&_h3]:font-semibold [&_h3]:mt-2 ${isLight ? 'border-slate-200' : 'border-[rgba(169,191,165,0.15)]'}`}
          // The HTML is generated by our server with every piece of text escaped.
          dangerouslySetInnerHTML={{ __html: page.html }}
        />
      )}
      <p className={`text-[10px] ${muted}`}>
        How to use it: add the page to your website (a new page or blog post) using the copied text, paste the search-engine code into the page's head or footer, and link to it from your menu or another page. Then use "Check now" on the AI answers tab after a few weeks.
      </p>
    </div>
  );
}

/** Pages written earlier, so a draft is never lost. */
export function SavedPages({ isLight, onError }: Common & { onError: (msg: string | null) => void }) {
  const muted = isLight ? 'text-slate-500' : 'text-[#A9BFA5]';
  const [pages, setPages] = useState<SeoGeoPage[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPages(await listSeoGeoPages());
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not load pages');
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!pages.length) return <p className={`text-xs ${muted}`}>No pages yet. Write one from the Google ranking or AI answers tab.</p>;
  return (
    <ul className="space-y-2">
      {pages.map((p) => (
        <li key={p.id} className="space-y-2">
          <div className={`flex items-center justify-between gap-2 text-xs rounded-lg border px-3 py-2 ${isLight ? 'border-slate-200' : 'border-[rgba(169,191,165,0.15)]'}`}>
            <button type="button" className="text-left min-w-0" onClick={() => setOpen(open === p.id ? null : p.id)}>
              <span className="font-semibold block truncate">{p.title}</span>
              <span className={`text-[11px] ${muted}`}>
                For "{p.topic}" · {new Date(p.createdAt).toLocaleDateString()}
              </span>
            </button>
            <button type="button" className={`text-[11px] underline shrink-0 ${muted}`} onClick={() => void deleteSeoGeoPage(p.id).then(load)}>
              Delete
            </button>
          </div>
          {open === p.id && <PageDraftCard page={p} isLight={isLight} onClose={() => setOpen(null)} />}
        </li>
      ))}
    </ul>
  );
}
