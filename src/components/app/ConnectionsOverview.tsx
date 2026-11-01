import React from 'react';
import type { ConnectionsHealth } from '../../legacy/services/connectionsService';
import type { SeoGeoIntegrationsStatus } from '../../legacy/services/seoGeoService';

export type ConnectionsTab = 'overview' | 'social' | 'messaging' | 'google' | 'seo';

interface Row {
  id: ConnectionsTab;
  name: string;
  detail: string;
  ok: boolean;
  label: string;
}

interface Props {
  health: ConnectionsHealth | null;
  seo?: SeoGeoIntegrationsStatus | null;
  isLight: boolean;
  onGoToTab: (tab: ConnectionsTab) => void;
}

function buildRows(health: ConnectionsHealth | null, seo: SeoGeoIntegrationsStatus | null | undefined): Row[] {
  const h = health || {};
  return [
    {
      id: 'social',
      name: 'Instagram',
      detail: h.instagram?.connected ? `@${h.instagram.account?.username || 'connected'}` : h.instagram?.configured ? 'Not connected' : 'Not configured',
      ok: Boolean(h.instagram?.connected),
      label: h.instagram?.connected ? 'Connected' : 'Setup',
    },
    {
      id: 'social',
      name: 'Facebook Page',
      detail: h.facebook?.connected ? h.facebook.account?.pageName || 'Connected' : 'Connect in Social tab',
      ok: Boolean(h.facebook?.connected),
      label: h.facebook?.connected ? 'Connected' : 'Setup',
    },
    {
      id: 'social',
      name: 'X (Twitter)',
      detail: h.x?.connected ? `@${h.x.account?.username}` : h.x?.configured ? 'Click Connect X' : 'Add X_CLIENT_ID',
      ok: Boolean(h.x?.connected),
      label: h.x?.connected ? 'Connected' : 'Setup',
    },
    {
      id: 'social',
      name: 'LinkedIn',
      detail: h.linkedin?.configured ? 'Log in via Content → Social Hub to publish' : 'Set LINKEDIN_CLIENT_ID',
      ok: Boolean(h.linkedin?.configured),
      label: h.linkedin?.configured ? 'App ready' : 'Setup',
    },
    {
      id: 'messaging',
      name: 'WhatsApp',
      detail: h.whatsapp?.configured ? 'Cloud API env set' : 'WHATSAPP_TOKEN missing',
      ok: Boolean(h.whatsapp?.configured),
      label: h.whatsapp?.configured ? 'Configured' : 'Setup',
    },
    {
      id: 'messaging',
      name: 'Email (SMTP)',
      detail: h.email?.configured ? 'Outbound + inbound webhook' : 'SMTP env missing',
      ok: Boolean(h.email?.configured),
      label: h.email?.configured ? 'Configured' : 'Setup',
    },
    {
      id: 'google',
      name: 'Google Ads',
      detail: h.googleAds?.apiSyncReady ? 'Webhook + API' : h.googleAds?.webhookReady ? 'Webhook ready' : 'Optional',
      ok: Boolean(h.googleAds?.webhookReady),
      label: h.googleAds?.webhookReady ? 'Ready' : 'Optional',
    },
    {
      id: 'google',
      name: 'Google Sheets',
      detail: h.googleSheets?.configured ? 'Lead export enabled' : 'Service account optional',
      ok: Boolean(h.googleSheets?.configured),
      label: h.googleSheets?.configured ? 'Connected' : 'Optional',
    },
    {
      id: 'seo',
      name: 'Google Search Console',
      detail: seo?.googleSearchConsole.connected ? seo.googleSearchConsole.siteUrl || 'Linked' : 'Connect in SEO tab',
      ok: Boolean(seo?.googleSearchConsole.connected),
      label: seo?.googleSearchConsole.connected ? 'Connected' : 'Setup',
    },
    {
      id: 'seo',
      name: 'Google Business Profile',
      detail: seo?.googleBusinessProfile.connected ? seo.googleBusinessProfile.locationTitle || 'Linked' : 'With Google SEO OAuth',
      ok: Boolean(seo?.googleBusinessProfile.connected),
      label: seo?.googleBusinessProfile.connected ? 'Connected' : 'Setup',
    },
    {
      id: 'seo',
      name: 'Vertex AI',
      detail: h.vertex?.configured ? `${h.vertex.project || 'project'} · ${h.vertex.mode}` : 'VERTEX_PROJECT_ID',
      ok: Boolean(h.vertex?.configured),
      label: h.vertex?.configured ? 'Configured' : 'Setup',
    },
    {
      id: 'overview',
      name: 'Database (MongoDB)',
      detail: h.mongo ? 'CRM & scheduled posts' : 'File-based fallback / login may fail',
      ok: Boolean(h.mongo),
      label: h.mongo ? 'Online' : 'Offline',
    },
  ];
}

export default function ConnectionsOverview({ health, seo, isLight, onGoToTab }: Props) {
  const rows = buildRows(health, seo);
  const connected = rows.filter((r) => r.ok).length;

  return (
    <div className="space-y-3">
      <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-[#A9BFA5]'}`}>
        {connected} of {rows.length} integrations ready · click a row to open that section
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
        {rows.map((row) => (
          <button
            key={row.name}
            type="button"
            onClick={() => onGoToTab(row.id === 'overview' ? 'social' : row.id)}
            className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${
              isLight
                ? 'border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/50'
                : 'border-[rgba(169,191,165,0.18)] bg-[#071C1A] hover:border-teal-500/40'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{row.name}</span>
              <span
                className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full shrink-0 ${
                  row.ok
                    ? isLight
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-emerald-500/20 text-emerald-300'
                    : isLight
                      ? 'bg-slate-100 text-slate-600'
                      : 'bg-[#0D2D2A] text-[#A9BFA5]'
                }`}
              >
                {row.label}
              </span>
            </div>
            <p className={`text-[10px] mt-1 leading-snug ${isLight ? 'text-slate-500' : 'text-[#A9BFA5]'}`}>{row.detail}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
