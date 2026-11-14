import React, { useMemo, useRef, useState } from 'react';
import { AlertTriangle, Download, FileSpreadsheet, Loader2, Trash2, Upload } from 'lucide-react';
import {
  PLATFORM_LABEL,
  downloadImportTemplate,
  previewImport,
  type Connections,
  type ImportPreview,
  type ImportRow,
  type PlannerPlatform,
} from '../../../legacy/services/plannerService';
import { PLATFORM_COLOR, PLATFORM_SHORT, browserTimeZone, timeZones, usePlannerStyles } from './plannerUi';

const PLATFORMS: PlannerPlatform[] = ['linkedin', 'instagram', 'facebook', 'x'];
const tomorrow = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

interface Props {
  connections: Connections | null;
  defaultTimezone: string;
  busy: boolean;
  error: string | null;
  onSubmit: (req: { rows: ImportRow[]; platforms: PlannerPlatform[]; startDate: string; timezone: string; filename: string }) => void;
}

/** Upload a spreadsheet of posts. Text written by the owner is posted exactly as written. */
export default function ImportCalendar({ defaultTimezone, busy, error, onSubmit }: Props) {
  const s = usePlannerStyles();
  const input = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [platforms, setPlatforms] = useState<PlannerPlatform[]>(['linkedin', 'instagram']);
  const [startDate, setStartDate] = useState(tomorrow());
  const [timezone, setTimezone] = useState(defaultTimezone || browserTimeZone());
  const zones = useMemo(() => timeZones(), []);

  async function pick(file: File | undefined) {
    if (!file) return;
    setReadError(null);
    setReading(true);
    try {
      const p = await previewImport(file);
      setPreview(p);
      setRows(p.rows);
      setFilename(file.name);
    } catch (err) {
      setPreview(null);
      setRows([]);
      setReadError(err instanceof Error ? err.message : 'Could not read that file');
    } finally {
      setReading(false);
      if (input.current) input.current.value = '';
    }
  }

  const toggle = (p: PlannerPlatform) => setPlatforms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  const broken = rows.filter((r) => r.errors.length);
  const needsDefaults = rows.some((r) => !r.platforms.length);
  const canSubmit = rows.length > 0 && broken.length === 0 && !busy && (!needsDefaults || platforms.length > 0);
  const alert = (msg: string) => (
    <div className={`rounded-lg border px-4 py-3 text-xs font-medium ${s.isLight ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-rose-950/30 border-rose-800/40 text-rose-300'}`}>{msg}</div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="text-center space-y-1">
        <h2 className={`text-2xl font-bold ${s.title}`}>Upload your content calendar</h2>
        <p className={`text-sm ${s.muted}`}>
          One row per post in Excel or CSV. Text you write is posted exactly as written. Rows with only a topic get AI copy in your brand voice. Images are made for every post, and you review everything before anything is posted.
        </p>
      </div>

      <div className={`${s.card} p-4 sm:p-5 space-y-4`}>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void downloadImportTemplate('xlsx').catch((e) => setReadError(e.message))} className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 ${s.secondary}`}>
            <Download className="w-3.5 h-3.5" /> Excel template
          </button>
          <button type="button" onClick={() => void downloadImportTemplate('csv').catch((e) => setReadError(e.message))} className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 ${s.secondary}`}>
            <Download className="w-3.5 h-3.5" /> CSV template
          </button>
          <span className={`text-[11px] ${s.muted}`}>Columns: Topic, Content, Date, Time, Platforms, Hashtags. Only Topic or Content is required.</span>
        </div>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void pick(e.dataTransfer.files?.[0]);
          }}
          className={`rounded-lg border-2 border-dashed px-4 py-8 text-center ${s.border}`}
        >
          <input ref={input} type="file" accept=".xlsx,.csv,.txt" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
          {reading ? (
            <Loader2 className={`w-6 h-6 mx-auto animate-spin ${s.muted}`} />
          ) : (
            <>
              <FileSpreadsheet className={`w-7 h-7 mx-auto ${s.muted}`} />
              <button type="button" onClick={() => input.current?.click()} className={`mt-2 px-4 py-2 rounded-lg text-sm font-bold inline-flex items-center gap-2 ${s.primary}`}>
                <Upload className="w-4 h-4" /> {preview ? 'Choose a different file' : 'Choose a file'}
              </button>
              <p className={`text-[11px] mt-2 ${s.muted}`}>or drop it here. .xlsx or .csv, up to 2MB and 200 rows.</p>
            </>
          )}
        </div>
        {readError && alert(readError)}
      </div>

      {preview && (
        <>
          <div className={`${s.card} p-4 sm:p-5 space-y-3`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className={`text-sm font-bold ${s.title}`}>
                {filename}: {rows.length} {rows.length === 1 ? 'row' : 'rows'}
                {broken.length > 0 && <span className="text-rose-500 font-semibold"> · {broken.length} need fixing</span>}
              </p>
              {preview.ignored.length > 0 && <p className={`text-[11px] ${s.muted}`}>Ignored columns: {preview.ignored.join(', ')}</p>}
            </div>
            {preview.truncated && <p className="text-[11px] text-amber-500">Only the first 200 rows were read.</p>}
            {broken.length > 0 && <p className={`text-[11px] ${s.muted}`}>Fix the highlighted rows in your file and upload it again, or remove them here.</p>}

            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-xs min-w-[640px]">
                <thead>
                  <tr className={`text-left ${s.muted}`}>
                    <th className="px-1 py-1.5 font-semibold">Row</th>
                    <th className="px-1 py-1.5 font-semibold">Topic / text</th>
                    <th className="px-1 py-1.5 font-semibold">When</th>
                    <th className="px-1 py-1.5 font-semibold">Platforms</th>
                    <th className="px-1 py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.row} className={`border-t align-top ${s.border} ${r.errors.length ? (s.isLight ? 'bg-rose-50' : 'bg-rose-950/20') : ''}`}>
                      <td className={`px-1 py-2 ${s.muted}`}>{r.row}</td>
                      <td className="px-1 py-2 max-w-[320px]">
                        <p className={`font-semibold ${s.title} break-words`}>{r.topic || '(no topic)'}</p>
                        <p className={`${s.muted} break-words`}>{r.content ? `${r.content.slice(0, 140)}${r.content.length > 140 ? '…' : ''}` : 'AI will write this'}</p>
                        {r.errors.map((e) => (
                          <p key={e} className="text-rose-500 font-medium mt-0.5">{e}</p>
                        ))}
                        {r.warnings.map((w) => (
                          <p key={w} className="text-amber-500 mt-0.5 flex gap-1"><AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />{w}</p>
                        ))}
                      </td>
                      <td className={`px-1 py-2 whitespace-nowrap ${s.title}`}>
                        {r.date || <span className={s.muted}>next free day</span>}
                        <br />
                        <span className={s.muted}>{r.time || 'best time'}</span>
                      </td>
                      <td className="px-1 py-2">
                        {r.platforms.length ? (
                          <span className="flex gap-1 flex-wrap">
                            {r.platforms.map((p) => (
                              <span key={p} title={PLATFORM_LABEL[p]} className={`inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold ${PLATFORM_COLOR[p]}`}>{PLATFORM_SHORT[p]}</span>
                            ))}
                          </span>
                        ) : (
                          <span className={s.muted}>defaults</span>
                        )}
                      </td>
                      <td className="px-1 py-2 text-right">
                        <button type="button" aria-label={`Remove row ${r.row}`} onClick={() => setRows((cur) => cur.filter((x) => x.row !== r.row))} className={`p-1.5 rounded ${s.danger}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={`${s.card} p-4 sm:p-5 space-y-4`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <label className={`block text-xs font-semibold ${s.muted}`}>
                Start date (for rows without a date)
                <input type="date" value={startDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setStartDate(e.target.value)} className={s.input} />
              </label>
              <label className={`block text-xs font-semibold ${s.muted}`}>
                Your time zone
                <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={s.input}>
                  {(zones.includes(timezone) ? zones : [timezone, ...zones]).map((z) => (
                    <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </label>
            </div>
            {needsDefaults && (
              <div>
                <p className={`text-xs font-semibold ${s.muted}`}>Post rows without a platform to:</p>
                <div className="mt-1 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PLATFORMS.map((p) => (
                    <button key={p} type="button" onClick={() => toggle(p)} className={`rounded-lg border px-3 py-2 text-sm font-semibold flex items-center gap-2 ${platforms.includes(p) ? s.selected : s.idle} ${s.title}`}>
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold ${PLATFORM_COLOR[p]}`}>{PLATFORM_SHORT[p]}</span>
                      {PLATFORM_LABEL[p]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && alert(error)}

          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => onSubmit({ rows, platforms, startDate, timezone, filename })}
            className={`w-full py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 ${s.primary}`}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            {busy ? 'Starting…' : 'Build my calendar'}
          </button>
        </>
      )}
      {!preview && error && alert(error)}
    </div>
  );
}
