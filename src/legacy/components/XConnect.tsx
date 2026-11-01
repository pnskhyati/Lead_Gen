import React, { useCallback, useEffect, useState } from 'react';
import Card from './common/Card';
import Spinner from './common/Spinner';
import { disconnectX, getXStatus, openXConnect, syncXLeads, type XStatus } from '../services/xService';

interface XConnectProps {
  compact?: boolean;
  onSynced?: (added: number) => void;
}

const XConnect: React.FC<XConnectProps> = ({ compact = false, onSynced }) => {
  const [status, setStatus] = useState<XStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStatus(await getXStatus());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load X status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleConnect = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await openXConnect();
      await refresh();
      setMessage('X connected. You can publish posts and sync @mentions to leads.');
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
      const result = await syncXLeads();
      const { fetchLeads, mergeLeads } = await import('../services/leadStore');
      const added = mergeLeads(result.leads || []);
      await fetchLeads();
      onSynced?.(added);
      setMessage(
        added > 0 ? `Synced ${added} new X lead${added === 1 ? '' : 's'}.` : `Checked ${result.fetched} mentions — no new leads.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return compact ? <p className="text-xs text-slate-500">Loading X…</p> : <Spinner />;
  }

  const connected = Boolean(status?.connected);
  const configured = Boolean(status?.configured);

  if (compact) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-xs space-y-2">
        <p className="font-semibold text-slate-800">
          X {connected && status?.account?.username ? `@${status.account.username}` : ''}
        </p>
        {!configured && <p className="text-slate-500">Set X_CLIENT_ID on the server.</p>}
        {error && <p className="text-rose-600">{error}</p>}
        {message && <p className="text-teal-700">{message}</p>}
        {!connected ? (
          <button type="button" disabled={busy || !configured} onClick={() => void handleConnect()} className="text-teal-700 font-semibold underline disabled:opacity-50">
            Connect X
          </button>
        ) : (
          <button type="button" disabled={busy} onClick={() => void handleSync()} className="text-teal-700 font-semibold underline disabled:opacity-50">
            Sync @mentions
          </button>
        )}
      </div>
    );
  }

  return (
    <Card title="X (Twitter)" subtitle="OAuth · publish · @mentions → leads">
      {!configured && <p className="text-sm text-slate-500">Add X_CLIENT_ID and callback URL in backend env.</p>}
      {connected && status?.account && (
        <p className="text-sm">
          Connected as <strong>@{status.account.username}</strong>
        </p>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {message && <p className="text-sm text-teal-700">{message}</p>}
      <div className="flex flex-wrap gap-2 mt-3">
        {!connected ? (
          <button type="button" disabled={busy || !configured} onClick={() => void handleConnect()} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
            Connect X
          </button>
        ) : (
          <>
            <button type="button" disabled={busy} onClick={() => void handleSync()} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
              Sync mentions → leads
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void disconnectX().then(refresh)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold"
            >
              Disconnect
            </button>
          </>
        )}
      </div>
    </Card>
  );
};

export default XConnect;
