import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Mail, TriangleAlert } from 'lucide-react';
import {
  connectEmailAccount,
  disconnectEmailAccount,
  getEmailAccount,
  getEmailProviders,
  sendEmailAccountTest,
  setEmailAutoReply,
  type EmailAccountView,
  type EmailProviderOption,
  type EmailProviders,
} from '../../legacy/services/emailService';
import { usePlannerStyles } from './planner/plannerUi';

interface Props {
  /** Called after the connection changes so the parent can refresh its status. */
  onChanged?: () => void;
}

const ago = (iso?: string | null) => {
  if (!iso) return 'not yet';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  return mins < 1 ? 'just now' : mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)} h ago`;
};

/** Connect the mailbox the assistant writes from, and reads new customer emails from. */
export default function EmailConnect({ onChanged }: Props) {
  const s = usePlannerStyles();
  const [account, setAccount] = useState<EmailAccountView | null>(null);
  const [providers, setProviders] = useState<EmailProviderOption[]>([]);
  const [signIn, setSignIn] = useState<EmailProviders['signIn']>({ google: false, microsoft: false });
  const [usePassword, setUsePassword] = useState(false);
  const [provider, setProvider] = useState('gmail');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fromName, setFromName] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('465');
  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState('993');
  const [busy, setBusy] = useState<null | 'connect' | 'test' | 'disconnect' | 'auto'>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [a, p] = await Promise.all([getEmailAccount(), getEmailProviders()]);
      setAccount(a);
      setProviders(p.presets);
      setSignIn(p.signIn);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the email connection');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // The sign-in popup reports back with a message.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'EMAIL_AUTH_SUCCESS') {
        setError(null);
        setNote('Connected. The assistant will answer new emails that arrive from now on. Your existing inbox is not touched.');
        void load();
        onChanged?.();
      } else if (e.data?.type === 'EMAIL_AUTH_ERROR') {
        setError(String(e.data.error || 'The sign-in did not complete.'));
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [load, onChanged]);

  function openSignIn(provider: 'google' | 'microsoft') {
    setError(null);
    setNote(null);
    const w = 520;
    const h = 700;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    const popup = window.open(`${import.meta.env.VITE_API_URL || ''}/auth/email/${provider}`, 'Email sign-in', `width=${w},height=${h},left=${left},top=${top}`);
    if (!popup) setError('Your browser blocked the sign-in window. Allow pop-ups for this site and try again.');
  }

  const chosen = providers.find((p) => p.id === provider);
  const showForm = !account?.connected;
  const showPasswordForm = usePassword || !(signIn.google || signIn.microsoft);

  async function run(kind: NonNullable<typeof busy>, fn: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    setNote(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  }

  const connect = () =>
    run('connect', async () => {
      const a = await connectEmailAccount({
        provider,
        email: email.trim(),
        password,
        fromName: fromName.trim() || undefined,
        ...(chosen?.custom ? { smtp: { host: smtpHost.trim(), port: Number(smtpPort) }, imap: { host: imapHost.trim(), port: Number(imapPort) } } : {}),
      });
      setAccount(a);
      setPassword('');
      setNote('Connected. The assistant will answer new emails that arrive from now on. Your existing inbox is not touched.');
      onChanged?.();
    });

  return (
    <div className={`rounded-lg border p-4 mb-4 space-y-3 ${s.border} ${s.soft}`}>
      <div className="flex items-center gap-2">
        <Mail className={`w-4 h-4 ${s.muted}`} />
        <p className={`text-sm font-bold ${s.title}`}>Your business email</p>
        {account?.connected && (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500">
            <CheckCircle2 className="w-3.5 h-3.5" /> Connected
          </span>
        )}
      </div>

      {account?.needsReconnect && (
        <div className="flex gap-2 text-xs text-amber-500">
          <TriangleAlert className="w-4 h-4 shrink-0" />
          <span>{account.lastError || 'The email login stopped working.'} Enter the password again to reconnect {account.email}.</span>
        </div>
      )}

      {!showForm && account ? (
        <>
          <p className={`text-xs ${s.muted}`}>
            The assistant writes as <strong className={s.title}>{account.fromName ? `${account.fromName} <${account.email}>` : account.email}</strong> and answers customers who email that address.{account.authType === 'oauth' ? ' Connected with a secure sign-in, so no password is stored.' : ''}
          </p>
          <p className={`text-[11px] ${s.muted}`}>
            Last checked {ago(account.lastPollAt)} · {account.repliesLast24h ?? 0} replies in the last 24 hours
            {account.lastError ? ` · last problem: ${account.lastError}` : ''}
          </p>
          <label className={`flex items-center gap-2 text-xs font-semibold ${s.title}`}>
            <input
              type="checkbox"
              checked={account.autoReply !== false}
              disabled={busy !== null}
              onChange={(e) => void run('auto', async () => setAccount(await setEmailAutoReply(e.target.checked)))}
            />
            Answer customer emails automatically
          </label>
          <p className={`text-[11px] ${s.muted}`}>Newsletters, auto-replies and no-reply senders are never answered, and each customer gets at most 3 replies a day. When off, emails are still saved as leads.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void run('test', async () => setNote(`Test email sent to ${(await sendEmailAccountTest()).sentTo}. Check that inbox.`))}
              className={`px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50 ${s.secondary}`}
            >
              {busy === 'test' ? 'Sending…' : 'Send me a test email'}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => {
                if (window.confirm(`Disconnect ${account.email}? The assistant will stop answering emails.`)) {
                  void run('disconnect', async () => {
                    setAccount(await disconnectEmailAccount());
                    onChanged?.();
                  });
                }
              }}
              className={`px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50 ${s.ghost}`}
            >
              Disconnect
            </button>
          </div>
        </>
      ) : (
        <>
          <p className={`text-xs ${s.muted}`}>Connect the address customers email. The assistant will reply from it and read new messages sent to it.</p>
          {(signIn.google || signIn.microsoft) && (
            <div className="flex flex-wrap gap-2">
              {signIn.google && (
                <button type="button" onClick={() => openSignIn('google')} className={`px-4 py-2 rounded-lg text-xs font-bold ${s.primary}`}>
                  Sign in with Google
                </button>
              )}
              {signIn.microsoft && (
                <button type="button" onClick={() => openSignIn('microsoft')} className={`px-4 py-2 rounded-lg text-xs font-bold ${s.primary}`}>
                  Sign in with Microsoft
                </button>
              )}
              {!usePassword && (
                <button type="button" onClick={() => setUsePassword(true)} className={`px-3 py-2 rounded-lg text-xs font-semibold ${s.ghost}`}>
                  Use an app password instead
                </button>
              )}
            </div>
          )}
          {!signIn.google && !signIn.microsoft && (
            <p className={`text-[11px] ${s.muted}`}>One-click Google and Microsoft sign-in is not set up on this server yet, so use an app password.</p>
          )}
          {showPasswordForm && (
          <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={`block text-xs font-semibold ${s.muted}`}>
              Email provider
              <select value={provider} onChange={(e) => setProvider(e.target.value)} className={s.input}>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={`block text-xs font-semibold ${s.muted}`}>
              Sender name (optional)
              <input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Tecavy" maxLength={80} className={s.input} />
            </label>
            <label className={`block text-xs font-semibold ${s.muted}`}>
              Email address
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="info@yourcompany.com" autoComplete="off" className={s.input} />
            </label>
            <label className={`block text-xs font-semibold ${s.muted}`}>
              App password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className={s.input} />
            </label>
            {chosen?.custom && (
              <>
                <label className={`block text-xs font-semibold ${s.muted}`}>
                  Sending server (SMTP) and port
                  <span className="flex gap-2">
                    <input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.example.com" className={s.input} />
                    <input value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} className={`${s.input} !w-20`} inputMode="numeric" />
                  </span>
                </label>
                <label className={`block text-xs font-semibold ${s.muted}`}>
                  Receiving server (IMAP) and port
                  <span className="flex gap-2">
                    <input value={imapHost} onChange={(e) => setImapHost(e.target.value)} placeholder="imap.example.com" className={s.input} />
                    <input value={imapPort} onChange={(e) => setImapPort(e.target.value)} className={`${s.input} !w-20`} inputMode="numeric" />
                  </span>
                </label>
              </>
            )}
          </div>
          {chosen && <p className={`text-[11px] ${s.muted}`}>{chosen.help}</p>}
          <p className={`text-[11px] ${s.muted}`}>Your password is stored encrypted and is never shown again. Use an app password, not your normal one.</p>
          <button
            type="button"
            disabled={busy !== null || !email.trim() || !password}
            onClick={() => void connect()}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 disabled:opacity-50 ${s.primary}`}
          >
            {busy === 'connect' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {busy === 'connect' ? 'Checking your login…' : account?.needsReconnect ? 'Reconnect' : 'Connect email'}
          </button>
          </>
          )}
        </>
      )}

      {error && <p className="text-xs font-medium text-rose-500">{error}</p>}
      {note && <p className="text-xs font-medium text-emerald-500">{note}</p>}
    </div>
  );
}
