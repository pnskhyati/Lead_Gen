import React, { useEffect, useState } from 'react';
import { getWhatsAppStatus, sendWhatsAppMessage, type WhatsAppStatus } from '../services/whatsappService';

const WhatsAppConnect: React.FC = () => {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [to, setTo] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [sentNote, setSentNote] = useState<string | null>(null);

  const refresh = async () => {
    setError(null);
    try {
      setStatus(await getWhatsAppStatus());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status failed');
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const onSend = async () => {
    if (!to.trim() || !text.trim()) {
      setError('Phone number and message are required');
      return;
    }
    setBusy(true);
    setError(null);
    setSentNote(null);
    try {
      await sendWhatsAppMessage(to.trim(), text.trim());
      setSentNote('Message queued via WhatsApp Cloud API');
      setText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[rgba(148,163,184,0.25)] bg-[rgba(13,20,32,0.72)] p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-[#F8FAFC]">WhatsApp Cloud API</h3>
          <p className="text-xs text-[#94A3B8] mt-1">
            Inbound webhooks + outbound send. Configure token / phone number ID in backend env.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="text-[11px] font-semibold px-3 py-1.5 rounded-full border border-[rgba(148,163,184,0.3)] text-[#CBD5E1] hover:bg-white/5"
        >
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span
          className={`px-2.5 py-1 rounded-full font-semibold ${
            status?.configured
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              : 'bg-amber-500/15 text-amber-200 border border-amber-500/30'
          }`}
        >
          {status?.configured ? 'Configured' : 'Not configured'}
        </span>
        {status?.phoneNumberId && (
          <span className="px-2.5 py-1 rounded-full bg-white/5 text-[#CBD5E1] border border-white/10">
            Phone ID {status.phoneNumberId}
          </span>
        )}
        {status?.businessAccountId && (
          <span className="px-2.5 py-1 rounded-full bg-white/5 text-[#CBD5E1] border border-white/10">
            WABA {status.businessAccountId}
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-[#94A3B8]">
          To (E.164 / digits)
          <input
            className="mt-1 w-full rounded-xl border border-[rgba(148,163,184,0.3)] bg-[#070B14] px-3 py-2 text-sm text-[#F8FAFC]"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="9198xxxxxxxx"
          />
        </label>
        <label className="block text-xs text-[#94A3B8] sm:col-span-2">
          Message
          <textarea
            className="mt-1 w-full rounded-xl border border-[rgba(148,163,184,0.3)] bg-[#070B14] px-3 py-2 text-sm text-[#F8FAFC] min-h-[88px]"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Test WhatsApp outbound…"
          />
        </label>
      </div>

      <button
        type="button"
        disabled={busy || !status?.configured}
        onClick={() => void onSend()}
        className="px-4 py-2 text-xs font-semibold rounded-full bg-cyan-400 text-[#070B14] disabled:opacity-40"
      >
        {busy ? 'Sending…' : 'Send test message'}
      </button>

      {error && <p className="text-xs text-rose-300">{error}</p>}
      {sentNote && <p className="text-xs text-emerald-300">{sentNote}</p>}
    </div>
  );
};

export default WhatsAppConnect;
