import React, { useCallback, useEffect, useState } from 'react';
import Card from './common/Card';
import Spinner from './common/Spinner';
import {
  disconnectInstagram,
  getInstagramStatus,
  openInstagramConnect,
  syncInstagramLeads,
  type InstagramStatus,
} from '../services/instagramService';
import { mergeLeads } from '../services/leadStore';

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

  const handleConnect = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await openInstagramConnect();
      await refresh();
      setMessage('Instagram connected. Sync comments to score leads.');
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
      const added = mergeLeads(result.leads || []);
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
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-soft-azure">Instagram Graph API</p>
          <h3 className="text-lg font-bold text-ink mt-1">
            {status?.connected ? `@${status.account?.username}` : 'Connect Instagram'}
          </h3>
          <p className="text-sm text-ink-muted mt-1">
            {status?.connected
              ? `Pull comments from ${status.account?.pageName || 'your Page'} and score Hot / Warm / Cold leads.`
              : status?.configured
                ? 'Connect a Business/Creator account linked to a Facebook Page.'
                : 'Add META_APP_ID and META_APP_SECRET in .env.local, then restart the API.'}
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
