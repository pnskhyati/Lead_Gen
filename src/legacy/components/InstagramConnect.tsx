import React, { useCallback, useEffect, useState } from 'react';
import Card from './common/Card';
import Spinner from './common/Spinner';
import {
  disconnectInstagram,
  getInstagramStatus,
  openInstagramConnect,
  subscribeInstagramMessaging,
  syncInstagramLeads,
  type InstagramStatus,
} from '../services/instagramService';

interface InstagramConnectProps {
  compact?: boolean;
  onSynced?: (added: number) => void;
}

const InstagramConnect: React.FC<InstagramConnectProps> = ({ compact = false, onSynced }) => {
  const [status, setStatus] = useState<InstagramStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await getInstagramStatus();
      setStatus(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load Instagram status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ok = params.get('instagram');
    const igError = params.get('instagram_error');
    if (!ok && !igError) return;
    params.delete('instagram');
    params.delete('instagram_error');
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', next);
    if (ok === 'connected') {
      setMessage('Instagram connected.');
      void refresh();
    } else if (igError) {
      setError(igError);
    }
  }, [refresh]);

  const handleConnect = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await openInstagramConnect();
      try {
        await subscribeInstagramMessaging();
      } catch (subErr) {
        console.warn('Messaging subscribe:', subErr);
      }
      await refresh();
      setMessage(
        'Instagram connected. DMs auto-reply in Instagram when someone messages you (keep Auto-chat ON in Admin).'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connect failed');
    } finally {
      setBusy(false);
    }
  };

  const handleSync = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await syncInstagramLeads();
      const { fetchLeads, mergeLeads } = await import('../services/leadStore');
      const added = mergeLeads(result.leads || []);
      await fetchLeads();
      onSynced?.(added);
      setMessage(
        added > 0
          ? `Synced ${added} new Instagram lead${added === 1 ? '' : 's'} (Hot / Warm / Cold).`
          : `Checked ${result.fetched} comments — no new leads.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    setError(null);
    try {
      await disconnectInstagram();
      await refresh();
      setMessage('Instagram disconnected.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Disconnect failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Card className={compact ? '!p-4' : ''}>
        <div className="flex items-center gap-2 text-ink-muted text-sm">
          <Spinner /> Checking Instagram…
        </div>
      </Card>
    );
  }

  return (
    <Card className={compact ? '!p-4' : ''}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-soft-azure">Channel health</p>
          <h3 className="text-lg font-bold text-ink mt-1">
            {status?.connected ? `Instagram · @${status.account?.username}` : 'Connect Instagram'}
          </h3>
          <p className="text-sm text-ink-muted mt-1">
            {status?.connected
              ? status.dmAutoReply !== false
                ? `${status.botName || 'Your bot'} can auto-reply in DMs. Sync comments into Lead Inbox anytime.`
                : `Connected to ${status.account?.pageName || 'your Page'}. DM auto-chat is off — enable below or in Admin.`
              : status?.configured
                ? 'After Instagram login, click Allow (and Not now if asked to save login). You should return here automatically.'
                : 'Finish Meta app setup, then add META_APP_ID and META_APP_SECRET to .env.local and restart.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          {!status?.connected ? (
            <button
              type="button"
              disabled={busy || !status?.configured}
              onClick={handleConnect}
              className="nexora-btn-primary px-4 py-2.5 text-xs disabled:opacity-50"
            >
              {busy ? 'Connecting…' : 'Connect Instagram'}
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={handleSync}
                className="nexora-btn-primary px-4 py-2.5 text-xs"
              >
                {busy ? 'Syncing…' : 'Sync comments → leads'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    await subscribeInstagramMessaging();
                    setMessage('Instagram DM webhooks re-enabled for this Page.');
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Subscribe failed');
                  } finally {
                    setBusy(false);
                  }
                }}
                className="px-4 py-2.5 text-xs font-semibold rounded-full bg-soft-mint text-soft-deep"
              >
                Enable DM auto-chat
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleDisconnect}
                className="px-4 py-2.5 text-xs font-semibold rounded-full bg-soft-bg text-ink-muted hover:bg-white"
              >
                Disconnect
              </button>
            </>
          )}
        </div>
      </div>

      {message && <p className="text-sm text-soft-deep mt-3 font-medium">{message}</p>}
      {error && <p className="text-sm text-soft-coral mt-3 font-medium">{error}</p>}
    </Card>
  );
};

export default InstagramConnect;
