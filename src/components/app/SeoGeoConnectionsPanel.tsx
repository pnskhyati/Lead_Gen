import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import {
  disconnectSeoGeoGoogle,
  getSeoGeoIntegrations,
  getSeoGeoVertexStatus,
  startSeoGeoGoogleOAuth,
  type SeoGeoIntegrationsStatus,
} from '../../legacy/services/seoGeoService';

export default function SeoGeoConnectionsPanel() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [integrations, setIntegrations] = useState<SeoGeoIntegrationsStatus | null>(null);
  const [vertex, setVertex] = useState<Awaited<ReturnType<typeof getSeoGeoVertexStatus>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [i, v] = await Promise.all([getSeoGeoIntegrations(), getSeoGeoVertexStatus()]);
      setIntegrations(i);
      setVertex(v);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'SEO/GEO status failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const muted = isLight ? 'text-slate-500' : 'text-[#A9BFA5]';
  const card = isLight ? 'border-slate-200 bg-white' : 'border-[rgba(169,191,165,0.18)] bg-[#071C1A]';

  if (loading) {
    return (
      <p className={`text-xs flex items-center gap-2 ${muted}`}>
        <Loader2 className="w-4 h-4 animate-spin" /> Loading SEO / GEO connections…
      </p>
    );
  }

  return (
    <div className={`rounded-lg border p-4 space-y-3 ${card}`}>
      <div>
        <h3 className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>SEO / GEO (Google + AI)</h3>
        <p className={`text-xs mt-1 ${muted}`}>
          Search Console & Business Profile for audit evidence. Vertex powers AI visibility tests (same as copilot).
        </p>
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex flex-wrap gap-2 text-[10px]">
        <span className={`px-2 py-1 rounded-md border ${isLight ? 'border-slate-200' : 'border-[rgba(169,191,165,0.15)]'}`}>
          GSC: {integrations?.googleSearchConsole.connected ? integrations.googleSearchConsole.siteUrl || 'Connected' : 'Not connected'}
        </span>
        <span className={`px-2 py-1 rounded-md border ${isLight ? 'border-slate-200' : 'border-[rgba(169,191,165,0.15)]'}`}>
          GBP: {integrations?.googleBusinessProfile.connected ? integrations.googleBusinessProfile.locationTitle || 'Connected' : 'Not connected'}
        </span>
        <span className={`px-2 py-1 rounded-md border ${isLight ? 'border-slate-200' : 'border-[rgba(169,191,165,0.15)]'}`}>
          Vertex: {vertex?.configured ? `${vertex.project} (${vertex.mode})` : 'Not configured'}
        </span>
      </div>
      {vertex?.authHint && <p className={`text-[10px] ${muted}`}>{vertex.authHint}</p>}
      <div className="flex flex-wrap gap-2">
        {integrations?.oauthConfigured ? (
          integrations.connected ? (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await disconnectSeoGeoGoogle();
                  await load();
                } finally {
                  setBusy(false);
                }
              }}
              className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg border ${isLight ? 'border-slate-200' : 'border-[rgba(169,191,165,0.2)]'}`}
            >
              Disconnect Google (SEO)
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const { url } = await startSeoGeoGoogleOAuth();
                  window.location.href = url;
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'OAuth failed');
                  setBusy(false);
                }
              }}
              className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg ${isLight ? 'bg-teal-600 text-white' : 'bg-teal-500/30 text-teal-100'}`}
            >
              Connect Google (GSC + GBP)
            </button>
          )
        ) : (
          <p className={`text-[11px] ${muted}`}>Set GOOGLE_SEO_CLIENT_ID / SECRET on server for Google connect.</p>
        )}
      </div>
    </div>
  );
}
