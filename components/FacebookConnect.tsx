import React, { useCallback, useEffect, useState } from 'react';
import Card from './common/Card';
import Spinner from './common/Spinner';
import {
  disconnectFacebook,
  getFacebookStatus,
  openFacebookConnect,
  syncFacebookLeads,
  type FacebookStatus,
} from '../services/facebookService';

interface FacebookConnectProps {
  compact?: boolean;
  onSynced?: (added: number) => void;
}

const FacebookConnect: React.FC<FacebookConnectProps> = ({ compact = false, onSynced }) => {
  const [status, setStatus] = useState<FacebookStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await getFacebookStatus();
      setStatus(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load Facebook status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ok = params.get('facebook');
    const fbError = params.get('facebook_error');
    if (!ok && !fbError) return;
    params.delete('facebook');
    params.delete('facebook_error');
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', next);
    if (ok === 'connected') {
      setMessage('Facebook Page connected.');
      void refresh();
    } else if (fbError) {
      setError(fbError);
    }
  }, [refresh]);

  const handleConnect = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await openFacebookConnect();
      await refresh();
      setMessage('Facebook Page connected. You can publish and sync comment leads.');
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
      const result = await syncFacebookLeads();
      const { fetchLeads, mergeLeads } = await import('../services/leadStore');
      const added = mergeLeads(result.leads || []);
      await fetchLeads();
      onSynced?.(added);
      setMessage(
        added > 0
          ? `Synced ${added} new Facebook lead${added === 1 ? '' : 's'}.`
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
      await disconnectFacebook();
      await refresh();
      setMessage('Facebook disconnected.');
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
          <Spinner /> Checking Facebook…
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
            {status?.connected ? `Facebook · ${status.account?.pageName}` : 'Connect Facebook'}
          </h3>
          <p className="text-sm text-ink-muted mt-1">
            {status?.connected
              ? `Page ready for publish + comment sync${
                  status.account?.igUsername ? ` · IG @${status.account.igUsername} linked` : ''
                }.`
              : status?.configured
                ? 'Connect a Facebook Page you admin to publish and pull comment leads.'
                : 'Add META_APP_ID / META_APP_SECRET, enable Facebook Login, then restart.'}
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
              {busy ? 'Connecting…' : 'Connect Facebook'}
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

export default FacebookConnect;
