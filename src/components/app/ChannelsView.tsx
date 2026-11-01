import React, { useCallback, useEffect, useState } from 'react';
import { Link2, Loader2, RefreshCw } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import {
  disconnectInstagram,
  getInstagramStatus,
  openInstagramConnect,
  subscribeInstagramMessaging,
  syncInstagramLeads,
  type InstagramStatus,
} from '../../legacy/services/instagramService';
import {
  disconnectFacebook,
  getFacebookStatus,
  openFacebookConnect,
  syncFacebookLeads,
  type FacebookStatus,
} from '../../legacy/services/facebookService';
import {
  disconnectX,
  getXStatus,
  openXConnect,
  syncXLeads,
  type XStatus,
} from '../../legacy/services/xService';
import {
  getWhatsAppStatus,
  sendWhatsAppMessage,
  type WhatsAppStatus,
} from '../../legacy/services/whatsappService';
import {
  getEmailStatus,
  sendEmailMessage,
  simulateInboundEmail,
  type EmailStatus,
} from '../../legacy/services/emailService';
import {
  buildAdsLandingUrl,
  getAdsLandingConfig,
  getGoogleAdsStatus,
  getGoogleSheetsStatus,
  simulateGoogleAdsLead,
  syncGoogleAdsLeads,
  testGoogleSheetsAppend,
  type AdsLandingConfig,
  type GoogleAdsStatus,
  type GoogleSheetsStatus,
} from '../../legacy/services/googleIntegrationService';
import { getConnectionsHealth, type ConnectionsHealth } from '../../legacy/services/connectionsService';
import { getSeoGeoIntegrations, type SeoGeoIntegrationsStatus } from '../../legacy/services/seoGeoService';
import type { NavCategory, SubCategory } from '../../types';
import ConnectionsOverview, { type ConnectionsTab } from './ConnectionsOverview';
import SeoGeoConnectionsPanel from './SeoGeoConnectionsPanel';

const CONN_TABS: { id: ConnectionsTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'social', label: 'Social' },
  { id: 'messaging', label: 'Messaging' },
  { id: 'google', label: 'Google & ads' },
  { id: 'seo', label: 'SEO / GEO & AI' },
];

interface ChannelsViewProps {
  onNavigate?: (category: NavCategory, sub?: SubCategory) => void;
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  return (
    <span
      className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border shrink-0 ${
        ok
          ? isLight
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40'
          : isLight
            ? 'bg-slate-100 text-slate-600 border-slate-200'
            : 'bg-[#0D2D2A] text-[#A9BFA5] border-[rgba(169,191,165,0.25)]'
      }`}
    >
      {label}
    </span>
  );
}

function ChannelCard({
  title,
  subtitle,
  badgeOk,
  badgeLabel,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  badgeOk: boolean;
  badgeLabel: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  return (
    <div
      className={`rounded-lg border transition-colors ${
        isLight
          ? 'bg-white border-slate-200 shadow-2xs'
          : 'bg-[#071C1A] border-[rgba(169,191,165,0.18)]'
      }`}
    >
      <div
        className={`px-4 sm:px-5 py-4 border-b flex items-start justify-between gap-3 ${
          isLight ? 'border-slate-100' : 'border-[rgba(169,191,165,0.14)]'
        }`}
      >
        <div className="min-w-0">
          <h3 className={`text-base font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {title}
          </h3>
          <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-[#A9BFA5]'}`}>{subtitle}</p>
        </div>
        <StatusBadge ok={badgeOk} label={badgeLabel} />
      </div>
      <div className="px-4 sm:px-5 py-4 space-y-3">{children}</div>
      {footer && (
        <div
          className={`px-4 sm:px-5 py-3 border-t flex flex-wrap gap-2 ${
            isLight ? 'border-slate-100 bg-slate-50/80' : 'border-[rgba(169,191,165,0.12)] bg-[#061816]/60'
          }`}
        >
          {footer}
        </div>
      )}
    </div>
  );
}

export default function ChannelsView({ onNavigate }: ChannelsViewProps = {}) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [ig, setIg] = useState<InstagramStatus | null>(null);
  const [fb, setFb] = useState<FacebookStatus | null>(null);
  const [xSt, setXSt] = useState<XStatus | null>(null);
  const [wa, setWa] = useState<WhatsAppStatus | null>(null);
  const [em, setEm] = useState<EmailStatus | null>(null);
  const [gads, setGads] = useState<GoogleAdsStatus | null>(null);
  const [sheets, setSheets] = useState<GoogleSheetsStatus | null>(null);
  const [adsLanding, setAdsLanding] = useState<AdsLandingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [waTo, setWaTo] = useState('');
  const [waText, setWaText] = useState('');
  const [emFrom, setEmFrom] = useState('');
  const [emSubject, setEmSubject] = useState('Product inquiry');
  const [emText, setEmText] = useState('');
  const [emTo, setEmTo] = useState('');
  const [emOutText, setEmOutText] = useState('');
  const [gadsEmail, setGadsEmail] = useState('ads-lead@example.com');
  const [gadsName, setGadsName] = useState('Google Ads test lead');
  const [gadsMessage, setGadsMessage] = useState('Interested from a lead form — please follow up.');
  const [landingCampaign, setLandingCampaign] = useState('spring-promo');
  const [connTab, setConnTab] = useState<ConnectionsTab>('overview');
  const [health, setHealth] = useState<ConnectionsHealth | null>(null);
  const [seoInt, setSeoInt] = useState<SeoGeoIntegrationsStatus | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [i, f, x, w, e, ga, sh, al, h, seo] = await Promise.all([
        getInstagramStatus().catch(() => null),
        getFacebookStatus().catch(() => null),
        getXStatus().catch(() => null),
        getWhatsAppStatus().catch(() => null),
        getEmailStatus().catch(() => null),
        getGoogleAdsStatus().catch(() => null),
        getGoogleSheetsStatus().catch(() => null),
        getAdsLandingConfig().catch(() => null),
        getConnectionsHealth().catch(() => null),
        getSeoGeoIntegrations().catch(() => null),
      ]);
      setIg(i);
      setFb(f);
      setXSt(x);
      setWa(w);
      setEm(e);
      setGads(ga);
      setSheets(sh);
      setAdsLanding(al);
      setHealth(h);
      setSeoInt(seo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load channels');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const igOk = params.get('instagram');
    const igErr = params.get('instagram_error');
    const fbOk = params.get('facebook');
    const fbErr = params.get('facebook_error');
    const xOk = params.get('x');
    const xErr = params.get('x_error');
    if (!igOk && !igErr && !fbOk && !fbErr && !xOk && !xErr) return;
    params.delete('instagram');
    params.delete('instagram_error');
    params.delete('facebook');
    params.delete('facebook_error');
    params.delete('x');
    params.delete('x_error');
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', next);
    if (igOk === 'connected') setNote('Instagram connected.');
    if (fbOk === 'connected') setNote('Facebook Page connected.');
    if (xOk === 'connected') setNote('X connected.');
    if (igErr) setError(igErr);
    if (fbErr) setError(fbErr);
    if (xErr) setError(xErr);
    void refresh();
  }, [refresh]);

  const btnPrimary = isLight
    ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-xs'
    : 'bg-[#E8E9D8] hover:bg-white text-[#071C1A]';
  const btnSecondary = isLight
    ? 'bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200'
    : 'bg-[#0D2D2A] hover:bg-[#133F3B] text-teal-200 border border-teal-500/30';
  const btnGhost = isLight
    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
    : 'bg-[#0D2D2A]/80 hover:bg-[#133F3B] text-[#A9BFA5] border border-[rgba(169,191,165,0.2)]';
  const inputClass = isLight
    ? 'mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/25'
    : 'mt-1 w-full rounded-lg border border-[rgba(169,191,165,0.25)] bg-[#061816] px-3 py-2 text-sm text-[#E8E9D8] focus:outline-none focus:border-teal-500/40';

  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-sm py-16 justify-center ${isLight ? 'text-slate-500' : 'text-[#A9BFA5]'}`}>
        <Loader2 className="w-4 h-4 animate-spin" /> Loading channels…
      </div>
    );
  }

  return (
    <div className={`space-y-6 pb-12 animate-fadeIn select-text ${isLight ? 'text-slate-900 font-sans' : 'text-[#E8E9D8] font-sans'}`}>
      <div className={`border-b pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3 ${
        isLight ? 'border-slate-200/90' : 'border-[rgba(169,191,165,0.18)]'
      }`}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link2 className={`w-4 h-4 ${isLight ? 'text-teal-600' : 'text-teal-400'}`} />
            <p className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? 'text-teal-700' : 'text-teal-400'}`}>
              Connect
            </p>
          </div>
          <h1 className={`text-2xl sm:text-3xl font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
            Application connections
          </h1>
          <p className={`text-xs mt-1 max-w-3xl ${isLight ? 'text-slate-500' : 'text-[#A9BFA5]'}`}>
            One place for social, messaging, Google, SEO/GEO, and AI — connect, test, and sync into inbox & CRM.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer ${btnGhost}`}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh status
        </button>
      </div>

      {(note || error) && (
        <div
          className={`rounded-lg border px-4 py-3 text-xs font-medium ${
            error
              ? isLight
                ? 'bg-rose-50 border-rose-200 text-rose-700'
                : 'bg-rose-950/30 border-rose-800/40 text-rose-300'
              : isLight
                ? 'bg-teal-50 border-teal-200 text-teal-800'
                : 'bg-teal-950/30 border-teal-800/40 text-teal-200'
          }`}
        >
          {error || note}
        </div>
      )}

      <div className="flex flex-wrap gap-1 border-b pb-2">
        {CONN_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setConnTab(t.id)}
            className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg ${
              connTab === t.id
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

      {connTab === 'overview' && (
        <ConnectionsOverview health={health} seo={seoInt} isLight={isLight} onGoToTab={setConnTab} />
      )}

      {connTab === 'seo' && <SeoGeoConnectionsPanel />}

      {connTab === 'social' && (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Instagram */}
        <ChannelCard
          title={ig?.connected ? `Instagram · @${ig.account?.username}` : 'Instagram'}
          subtitle="Login · messaging subscribe · comment sync → leads"
          badgeOk={Boolean(ig?.connected)}
          badgeLabel={ig?.connected ? 'Connected' : 'Not connected'}
          footer={
            !ig?.connected ? (
              <button
                type="button"
                disabled={busy !== null || !ig?.configured}
                onClick={async () => {
                  setBusy('ig');
                  setError(null);
                  setNote(null);
                  try {
                    await openInstagramConnect();
                    try {
                      await subscribeInstagramMessaging();
                    } catch {
                      /* optional */
                    }
                    await refresh();
                    setNote('Instagram connected. DM auto-reply uses Admin auto-chat setting.');
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Connect failed');
                  } finally {
                    setBusy(null);
                  }
                }}
                className={`px-4 py-2 text-xs font-semibold rounded-lg disabled:opacity-45 cursor-pointer ${btnPrimary}`}
              >
                {busy === 'ig' ? 'Connecting…' : 'Connect Instagram'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={async () => {
                    setBusy('ig-sync');
                    setError(null);
                    setNote(null);
                    try {
                      const result = await syncInstagramLeads();
                      const { fetchLeads, mergeLeads } = await import('../../legacy/services/leadStore');
                      const added = mergeLeads(result.leads || []);
                      await fetchLeads();
                      setNote(
                        added > 0
                          ? `Synced ${added} new Instagram lead${added === 1 ? '' : 's'}.`
                          : `Checked ${result.fetched} comments — no new leads.`
                      );
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Sync failed');
                    } finally {
                      setBusy(null);
                    }
                  }}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg disabled:opacity-45 cursor-pointer ${btnPrimary}`}
                >
                  {busy === 'ig-sync' ? 'Syncing…' : 'Sync comments → leads'}
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={async () => {
                    setBusy('ig-sub');
                    setError(null);
                    try {
                      await subscribeInstagramMessaging();
                      setNote('Instagram DM webhooks re-enabled.');
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Subscribe failed');
                    } finally {
                      setBusy(null);
                    }
                  }}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg disabled:opacity-45 cursor-pointer ${btnSecondary}`}
                >
                  Enable DM auto-chat
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={async () => {
                    setBusy('ig-off');
                    try {
                      await disconnectInstagram();
                      await refresh();
                      setNote('Instagram disconnected.');
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Disconnect failed');
                    } finally {
                      setBusy(null);
                    }
                  }}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg disabled:opacity-45 cursor-pointer ${btnGhost}`}
                >
                  Disconnect
                </button>
              </>
            )
          }
        >
          <p className={`text-xs leading-relaxed ${isLight ? 'text-slate-600' : 'text-[#A9BFA5]'}`}>
            {ig?.connected
              ? ig.dmAutoReply !== false
                ? `${ig.botName || 'Your bot'} can auto-reply in DMs. Sync comments into Lead Inbox anytime.`
                : 'Connected. DM auto-chat is off — enable below or in Admin.'
              : ig?.configured
                ? 'After Instagram login, allow access — you should return here automatically.'
                : 'Add META_APP_ID / META_APP_SECRET to backend env, then restart.'}
          </p>
        </ChannelCard>

        {/* Facebook */}
        <ChannelCard
          title={fb?.connected ? `Facebook · ${fb.account?.pageName || 'Page'}` : 'Facebook'}
          subtitle="Page connect · comment sync → leads"
          badgeOk={Boolean(fb?.connected)}
          badgeLabel={fb?.connected ? 'Connected' : 'Not connected'}
          footer={
            !fb?.connected ? (
              <button
                type="button"
                disabled={busy !== null || !fb?.configured}
                onClick={async () => {
                  setBusy('fb');
                  setError(null);
                  setNote(null);
                  try {
                    await openFacebookConnect();
                    await refresh();
                    setNote('Facebook Page connected.');
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Connect failed');
                  } finally {
                    setBusy(null);
                  }
                }}
                className={`px-4 py-2 text-xs font-semibold rounded-lg disabled:opacity-45 cursor-pointer ${btnPrimary}`}
              >
                {busy === 'fb' ? 'Connecting…' : 'Connect Facebook'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={async () => {
                    setBusy('fb-sync');
                    setError(null);
                    setNote(null);
                    try {
                      const result = await syncFacebookLeads();
                      const { fetchLeads, mergeLeads } = await import('../../legacy/services/leadStore');
                      const added = mergeLeads(result.leads || []);
                      await fetchLeads();
                      setNote(
                        added > 0
                          ? `Synced ${added} new Facebook lead${added === 1 ? '' : 's'}.`
                          : `Checked ${result.fetched} comments — no new leads.`
                      );
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Sync failed');
                    } finally {
                      setBusy(null);
                    }
                  }}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg disabled:opacity-45 cursor-pointer ${btnPrimary}`}
                >
                  {busy === 'fb-sync' ? 'Syncing…' : 'Sync comments → leads'}
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={async () => {
                    setBusy('fb-off');
                    try {
                      await disconnectFacebook();
                      await refresh();
                      setNote('Facebook disconnected.');
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Disconnect failed');
                    } finally {
                      setBusy(null);
                    }
                  }}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg disabled:opacity-45 cursor-pointer ${btnGhost}`}
                >
                  Disconnect
                </button>
              </>
            )
          }
        >
          <p className={`text-xs leading-relaxed ${isLight ? 'text-slate-600' : 'text-[#A9BFA5]'}`}>
            {fb?.connected
              ? 'Page connected. Sync comment leads into the inbox or publish from Social Hub.'
              : fb?.configured
                ? 'Connect a Facebook Page to sync comments and publish.'
                : 'Configure Meta Facebook app credentials in backend env.'}
          </p>
        </ChannelCard>

        {/* X (Twitter) */}
        <ChannelCard
          title={xSt?.connected ? `X · @${xSt.account?.username || 'connected'}` : 'X (Twitter)'}
          subtitle="OAuth 2 · publish posts · @mentions → leads"
          badgeOk={Boolean(xSt?.connected)}
          badgeLabel={xSt?.connected ? 'Connected' : 'Not connected'}
          footer={
            !xSt?.connected ? (
              <button
                type="button"
                disabled={busy !== null || !xSt?.configured}
                onClick={async () => {
                  setBusy('x');
                  setError(null);
                  setNote(null);
                  try {
                    await openXConnect();
                    await refresh();
                    setNote('X connected.');
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Connect failed');
                  } finally {
                    setBusy(null);
                  }
                }}
                className={`px-4 py-2 text-xs font-semibold rounded-lg disabled:opacity-45 cursor-pointer ${btnPrimary}`}
              >
                {busy === 'x' ? 'Connecting…' : 'Connect X'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={async () => {
                    setBusy('x-sync');
                    setError(null);
                    setNote(null);
                    try {
                      const result = await syncXLeads();
                      const { fetchLeads, mergeLeads } = await import('../../legacy/services/leadStore');
                      const added = mergeLeads(result.leads || []);
                      await fetchLeads();
                      setNote(
                        added > 0
                          ? `Synced ${added} new X lead${added === 1 ? '' : 's'}.`
                          : `Checked ${result.fetched} mentions — no new leads.`
                      );
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Sync failed');
                    } finally {
                      setBusy(null);
                    }
                  }}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg disabled:opacity-45 cursor-pointer ${btnPrimary}`}
                >
                  {busy === 'x-sync' ? 'Syncing…' : 'Sync @mentions → leads'}
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={async () => {
                    setBusy('x-off');
                    try {
                      await disconnectX();
                      await refresh();
                      setNote('X disconnected.');
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Disconnect failed');
                    } finally {
                      setBusy(null);
                    }
                  }}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg disabled:opacity-45 cursor-pointer ${btnGhost}`}
                >
                  Disconnect
                </button>
              </>
            )
          }
        >
          <p className={`text-xs leading-relaxed ${isLight ? 'text-slate-600' : 'text-[#A9BFA5]'}`}>
            {xSt?.connected
              ? 'Publish from Social Hub (text, 280 chars). Sync @mentions into Lead Inbox.'
              : xSt?.configured
                ? 'Create an X app with OAuth 2 PKCE and add X_CLIENT_ID to backend env.'
                : 'Set X_CLIENT_ID and callback https://127.0.0.1:3000/auth/x/callback'}
          </p>
        </ChannelCard>

        <ChannelCard
          title="LinkedIn"
          subtitle="Publish & schedule from Social Hub"
          badgeOk={Boolean(health?.linkedin?.configured)}
          badgeLabel={health?.linkedin?.configured ? 'App configured' : 'Not configured'}
          footer={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  const w = 600;
                  const h = 700;
                  const left = window.screenX + (window.outerWidth - w) / 2;
                  const top = window.screenY + (window.outerHeight - h) / 2;
                  window.open(
                    `${import.meta.env.VITE_API_URL || ''}/auth/linkedin`,
                    'LinkedIn Auth',
                    `width=${w},height=${h},left=${left},top=${top}`
                  );
                }}
                className={`px-4 py-2 text-xs font-semibold rounded-lg cursor-pointer ${btnPrimary}`}
              >
                Connect LinkedIn
              </button>
              {onNavigate ? (
                <button
                  type="button"
                  onClick={() => onNavigate('content', 'linkedin-studio')}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg cursor-pointer ${btnGhost}`}
                >
                  Open Social Hub
                </button>
              ) : null}
            </div>
          }
        >
          <p className={`text-xs leading-relaxed ${isLight ? 'text-slate-600' : 'text-[#A9BFA5]'}`}>
            Connect here once, then create and schedule in Social Hub with Instagram, Facebook, and X.
          </p>
        </ChannelCard>
      </div>
      )}

      {connTab === 'messaging' && (
      <>
      {/* WhatsApp */}
      <ChannelCard
        title="WhatsApp Cloud API"
        subtitle="Webhook inbound · outbound send · CRM reply path"
        badgeOk={Boolean(wa?.configured)}
        badgeLabel={wa?.configured ? 'Configured' : 'Not configured'}
        footer={
          <button
            type="button"
            disabled={busy !== null || !wa?.configured}
            onClick={async () => {
              if (!waTo.trim() || !waText.trim()) {
                setError('Phone number and message are required');
                return;
              }
              setBusy('wa');
              setError(null);
              setNote(null);
              try {
                await sendWhatsAppMessage(waTo.trim(), waText.trim());
                setNote('Message queued via WhatsApp Cloud API.');
                setWaText('');
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Send failed');
              } finally {
                setBusy(null);
              }
            }}
            className={`px-4 py-2 text-xs font-semibold rounded-lg disabled:opacity-45 cursor-pointer ${btnPrimary}`}
          >
            {busy === 'wa' ? 'Sending…' : 'Send test message'}
          </button>
        }
      >
        <div className="flex flex-wrap gap-2 text-xs mb-3">
          {wa?.phoneNumberId && (
            <span
              className={`px-2.5 py-1 rounded-full border ${
                isLight ? 'bg-slate-50 text-slate-700 border-slate-200' : 'bg-[#061816] text-[#CBD5E1] border-[rgba(169,191,165,0.2)]'
              }`}
            >
              Phone ID {wa.phoneNumberId}
            </span>
          )}
          {wa?.businessAccountId && (
            <span
              className={`px-2.5 py-1 rounded-full border ${
                isLight ? 'bg-slate-50 text-slate-700 border-slate-200' : 'bg-[#061816] text-[#CBD5E1] border-[rgba(169,191,165,0.2)]'
              }`}
            >
              WABA {wa.businessAccountId}
            </span>
          )}
        </div>
        <p className={`text-xs mb-3 ${isLight ? 'text-slate-600' : 'text-[#A9BFA5]'}`}>
          {wa?.configured
            ? 'Cloud API ready. Inbound webhooks land in Lead Inbox; use the form to test outbound.'
            : 'Set WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID in backend env.'}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={`block text-xs font-semibold ${isLight ? 'text-slate-600' : 'text-[#A9BFA5]'}`}>
            To (E.164 / digits)
            <input
              className={inputClass}
              value={waTo}
              onChange={(e) => setWaTo(e.target.value)}
              placeholder="9198xxxxxxxx"
            />
          </label>
          <label className={`block text-xs font-semibold sm:col-span-2 ${isLight ? 'text-slate-600' : 'text-[#A9BFA5]'}`}>
            Message
            <textarea
              className={`${inputClass} min-h-[88px]`}
              value={waText}
              onChange={(e) => setWaText(e.target.value)}
              placeholder="Test WhatsApp outbound…"
            />
          </label>
        </div>
      </ChannelCard>

      <ChannelCard
        title="Email"
        subtitle="SMTP outbound · inbound webhook · lead agent auto-reply"
        badgeOk={Boolean(em?.configured)}
        badgeLabel={em?.configured ? 'SMTP ready' : 'Configure SMTP'}
        footer={
          <>
            <button
              type="button"
              disabled={busy !== null}
              onClick={async () => {
                if (!emFrom.trim() || !emText.trim()) {
                  setError('Simulate-from and message are required');
                  return;
                }
                setBusy('em-in');
                setError(null);
                setNote(null);
                try {
                  const { fetchLeads } = await import('../../legacy/services/leadStore');
                  await simulateInboundEmail(emFrom.trim(), emText.trim(), emSubject.trim());
                  await fetchLeads();
                  setNote('Inbound email processed → lead created/updated in CRM.');
                  setEmText('');
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Simulate failed');
                } finally {
                  setBusy(null);
                }
              }}
              className={`px-4 py-2 text-xs font-semibold rounded-lg disabled:opacity-45 cursor-pointer ${btnPrimary}`}
            >
              {busy === 'em-in' ? 'Processing…' : 'Simulate inbound email'}
            </button>
            <button
              type="button"
              disabled={busy !== null || !em?.configured}
              onClick={async () => {
                if (!emTo.trim() || !emOutText.trim()) {
                  setError('Recipient and message are required');
                  return;
                }
                setBusy('em-out');
                setError(null);
                try {
                  await sendEmailMessage(emTo.trim(), emOutText.trim(), emSubject.trim());
                  setNote('Email sent via SMTP.');
                  setEmOutText('');
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Send failed');
                } finally {
                  setBusy(null);
                }
              }}
              className={`px-4 py-2 text-xs font-semibold rounded-lg disabled:opacity-45 cursor-pointer ${btnSecondary}`}
            >
              {busy === 'em-out' ? 'Sending…' : 'Send test email'}
            </button>
          </>
        }
      >
        <p className={`text-xs mb-3 ${isLight ? 'text-slate-600' : 'text-[#A9BFA5]'}`}>
          {em?.configured
            ? `Sending as ${em.from}. Forward provider inbound mail to the webhook below.`
            : 'Set SMTP_HOST, SMTP_USER, SMTP_PASS, and EMAIL_FROM in backend .env. You can still simulate inbound without SMTP.'}
        </p>
        {em?.publicInboundUrl ? (
          <p className={`text-[11px] font-mono break-all mb-3 ${isLight ? 'text-slate-500' : 'text-[#A9BFA5]/80'}`}>
            Webhook: {em.publicInboundUrl}
          </p>
        ) : (
          <p className={`text-[11px] mb-3 ${isLight ? 'text-slate-500' : 'text-[#A9BFA5]/80'}`}>
            Inbound POST: <code className="font-mono">/api/email/inbound</code> (JSON: from, subject, text)
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={`block text-xs font-semibold sm:col-span-2 ${isLight ? 'text-slate-600' : 'text-[#A9BFA5]'}`}>
            Simulate inbound — From
            <input className={inputClass} value={emFrom} onChange={(e) => setEmFrom(e.target.value)} placeholder="customer@company.com" />
          </label>
          <label className={`block text-xs font-semibold sm:col-span-2 ${isLight ? 'text-slate-600' : 'text-[#A9BFA5]'}`}>
            Subject
            <input className={inputClass} value={emSubject} onChange={(e) => setEmSubject(e.target.value)} />
          </label>
          <label className={`block text-xs font-semibold sm:col-span-2 ${isLight ? 'text-slate-600' : 'text-[#A9BFA5]'}`}>
            Inbound body (triggers capture → qualify → follow-up)
            <textarea className={`${inputClass} min-h-[72px]`} value={emText} onChange={(e) => setEmText(e.target.value)} placeholder="Hi, I want pricing for…" />
          </label>
          <label className={`block text-xs font-semibold ${isLight ? 'text-slate-600' : 'text-[#A9BFA5]'}`}>
            Test send — To
            <input className={inputClass} value={emTo} onChange={(e) => setEmTo(e.target.value)} placeholder="you@company.com" disabled={!em?.configured} />
          </label>
          <label className={`block text-xs font-semibold sm:col-span-2 ${isLight ? 'text-slate-600' : 'text-[#A9BFA5]'}`}>
            Outbound body
            <textarea className={`${inputClass} min-h-[72px]`} value={emOutText} onChange={(e) => setEmOutText(e.target.value)} disabled={!em?.configured} />
          </label>
        </div>
      </ChannelCard>
      </>
      )}

      {connTab === 'google' && (
      <>
      <ChannelCard
        title="Google Ads — lead forms"
        subtitle="Webhook or API sync → CRM · auto-qualify via Lead Agent"
        badgeOk={Boolean(gads?.webhookReady)}
        badgeLabel={gads?.apiSyncReady ? 'Webhook + API' : 'Webhook ready'}
        footer={
          <>
            <button
              type="button"
              disabled={busy !== null}
              onClick={async () => {
                setBusy('gads-sim');
                setError(null);
                setNote(null);
                try {
                  const { fetchLeads } = await import('../../legacy/services/leadStore');
                  await simulateGoogleAdsLead({
                    name: gadsName.trim(),
                    email: gadsEmail.trim(),
                    message: gadsMessage.trim(),
                    campaignId: landingCampaign.trim(),
                    gclid: 'demo-gclid',
                  });
                  await fetchLeads();
                  setNote('Simulated Google Ads lead form → CRM (channel: google_ads).');
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Simulate failed');
                } finally {
                  setBusy(null);
                }
              }}
              className={`px-4 py-2 text-xs font-semibold rounded-lg disabled:opacity-45 cursor-pointer ${btnPrimary}`}
            >
              {busy === 'gads-sim' ? 'Ingesting…' : 'Simulate lead form'}
            </button>
            <button
              type="button"
              disabled={busy !== null || !gads?.apiSyncReady}
              onClick={async () => {
                setBusy('gads-sync');
                setError(null);
                try {
                  const { fetchLeads } = await import('../../legacy/services/leadStore');
                  const data = (await syncGoogleAdsLeads()) as { synced?: number };
                  await fetchLeads();
                  setNote(`Google Ads API sync: ${data?.synced ?? 0} lead(s) ingested.`);
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Sync failed');
                } finally {
                  setBusy(null);
                }
              }}
              className={`px-4 py-2 text-xs font-semibold rounded-lg disabled:opacity-45 cursor-pointer ${btnSecondary}`}
            >
              {busy === 'gads-sync' ? 'Syncing…' : 'Sync last 7 days (API)'}
            </button>
          </>
        }
      >
        <p className={`text-xs mb-3 ${isLight ? 'text-slate-600' : 'text-[#A9BFA5]'}`}>
          Point Google Ads lead form delivery to{' '}
          <code className="font-mono">{gads?.webhookPath || '/api/google-ads/webhook'}</code>
          {process.env.NODE_ENV === 'development' ? '' : ''}. Optional header{' '}
          <code className="font-mono">X-Google-Ads-Webhook-Secret</code> when{' '}
          <code className="font-mono">GOOGLE_ADS_WEBHOOK_SECRET</code> is set.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={`block text-xs font-semibold ${isLight ? 'text-slate-600' : 'text-[#A9BFA5]'}`}>
            Name
            <input className={inputClass} value={gadsName} onChange={(e) => setGadsName(e.target.value)} />
          </label>
          <label className={`block text-xs font-semibold ${isLight ? 'text-slate-600' : 'text-[#A9BFA5]'}`}>
            Email
            <input className={inputClass} value={gadsEmail} onChange={(e) => setGadsEmail(e.target.value)} />
          </label>
          <label className={`block text-xs font-semibold sm:col-span-2 ${isLight ? 'text-slate-600' : 'text-[#A9BFA5]'}`}>
            Message
            <textarea className={`${inputClass} min-h-[72px]`} value={gadsMessage} onChange={(e) => setGadsMessage(e.target.value)} />
          </label>
        </div>
      </ChannelCard>

      <ChannelCard
        title="Google Ads — landing & UTM"
        subtitle="Click-to-chat with utm_* + gclid preserved for Lead Agent"
        badgeOk={Boolean(adsLanding?.landingPath)}
        badgeLabel="Landing ready"
        footer={
          <a
            href={buildAdsLandingUrl(import.meta.env.VITE_API_URL || '', {
              utm_campaign: landingCampaign,
              gclid: 'demo-gclid',
            })}
            target="_blank"
            rel="noreferrer"
            className={`px-4 py-2 text-xs font-semibold rounded-lg cursor-pointer inline-flex items-center gap-2 ${btnPrimary}`}
          >
            <Link2 className="w-3.5 h-3.5" />
            Open ads landing (test)
          </a>
        }
      >
        <p className={`text-xs mb-3 ${isLight ? 'text-slate-600' : 'text-[#A9BFA5]'}`}>
          Use this URL as the Final URL in Google Ads (or link from your site). Visitors land in chat with attribution
          stored for CRM.
        </p>
        <label className={`block text-xs font-semibold mb-2 ${isLight ? 'text-slate-600' : 'text-[#A9BFA5]'}`}>
          utm_campaign
          <input className={inputClass} value={landingCampaign} onChange={(e) => setLandingCampaign(e.target.value)} />
        </label>
        <p className={`text-[11px] font-mono break-all ${isLight ? 'text-slate-500' : 'text-[#A9BFA5]/80'}`}>
          {buildAdsLandingUrl(import.meta.env.VITE_API_URL || '', {
            utm_campaign: landingCampaign,
            utm_source: 'google',
            utm_medium: 'cpc',
          })}
        </p>
        {adsLanding?.chatDeepLink ? (
          <p className={`text-[11px] mt-2 ${isLight ? 'text-slate-500' : 'text-[#A9BFA5]/80'}`}>
            Chat deep link pattern: {adsLanding.chatDeepLink}
          </p>
        ) : null}
      </ChannelCard>

      <ChannelCard
        title="Google Sheets export"
        subtitle="Append each new CRM lead to a spreadsheet row"
        badgeOk={Boolean(sheets?.configured)}
        badgeLabel={sheets?.configured ? 'Connected' : 'Set credentials'}
        footer={
          <button
            type="button"
            disabled={busy !== null || !sheets?.configured}
            onClick={async () => {
              setBusy('sheets-test');
              setError(null);
              try {
                await testGoogleSheetsAppend();
                setNote('Test row appended to Google Sheet.');
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Sheets test failed');
              } finally {
                setBusy(null);
              }
            }}
            className={`px-4 py-2 text-xs font-semibold rounded-lg disabled:opacity-45 cursor-pointer ${btnSecondary}`}
          >
            {busy === 'sheets-test' ? 'Writing…' : 'Append test row'}
          </button>
        }
      >
        <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-[#A9BFA5]'}`}>
          {sheets?.configured
            ? `Spreadsheet ${sheets.spreadsheetId} · tab “${sheets.sheetTab}”. New leads (any channel) append automatically.`
            : 'Set GOOGLE_SHEETS_SPREADSHEET_ID and GOOGLE_APPLICATION_CREDENTIALS (service account with edit access).'}
        </p>
      </ChannelCard>
      </>
      )}
    </div>
  );
}
