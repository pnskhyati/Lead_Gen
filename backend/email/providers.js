/**
 * Mail server presets, so an owner only types their address and an app password.
 * "custom" lets them enter the servers themselves (checked against private networks before any connection).
 */
const PRESETS = {
  gmail: {
    label: 'Gmail / Google Workspace',
    smtp: { host: 'smtp.gmail.com', port: 465, secure: true },
    imap: { host: 'imap.gmail.com', port: 993, secure: true },
    help: 'Turn on 2-Step Verification, then create an App Password at myaccount.google.com/apppasswords. Google Workspace admins must allow app passwords.',
  },
  outlook: {
    label: 'Outlook / Microsoft 365',
    smtp: { host: 'smtp-mail.outlook.com', port: 587, secure: false },
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
    help: 'Personal Outlook.com accounts can use an app password. Many Microsoft 365 work accounts block this sign-in method; if so, ask your admin or pick another provider.',
  },
  zoho: {
    label: 'Zoho Mail',
    smtp: { host: 'smtp.zoho.com', port: 465, secure: true },
    imap: { host: 'imap.zoho.com', port: 993, secure: true },
    help: 'Create an application-specific password in Zoho Accounts, under Security. Turn on IMAP in Mail settings.',
  },
  zoho_in: {
    label: 'Zoho Mail (India)',
    smtp: { host: 'smtp.zoho.in', port: 465, secure: true },
    imap: { host: 'imap.zoho.in', port: 993, secure: true },
    help: 'Create an application-specific password in Zoho Accounts, under Security. Turn on IMAP in Mail settings.',
  },
  yahoo: {
    label: 'Yahoo Mail',
    smtp: { host: 'smtp.mail.yahoo.com', port: 465, secure: true },
    imap: { host: 'imap.mail.yahoo.com', port: 993, secure: true },
    help: 'Create an app password in Yahoo Account Security.',
  },
  custom: {
    label: 'Other (enter servers)',
    smtp: { host: '', port: 465, secure: true },
    imap: { host: '', port: 993, secure: true },
    help: 'Enter the SMTP (sending) and IMAP (receiving) servers from your email provider.',
  },
};

const SMTP_PORTS = new Set([465, 587, 2525]);
const IMAP_PORTS = new Set([993, 143]);
const HOST_RE = /^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

function publicPresets() {
  return Object.entries(PRESETS).map(([id, p]) => ({ id, label: p.label, help: p.help, custom: id === 'custom' }));
}

/** Merge a preset with owner-entered servers (custom only). Throws a readable error for anything unusable. */
function resolveServers(provider, input = {}) {
  const preset = PRESETS[provider];
  if (!preset) throw new Error('Choose an email provider.');
  const pick = (kind, ports) => {
    const base = preset[kind];
    if (provider !== 'custom') return { ...base };
    const host = String(input[kind]?.host || '').trim().toLowerCase();
    const port = Number(input[kind]?.port || base.port);
    if (!HOST_RE.test(host)) throw new Error(`Enter a valid ${kind.toUpperCase()} server name (for example ${kind}.yourprovider.com).`);
    if (!ports.has(port)) throw new Error(`${kind.toUpperCase()} port must be one of ${[...ports].join(', ')}.`);
    return { host, port, secure: input[kind]?.secure === undefined ? port !== 587 && port !== 143 : Boolean(input[kind].secure) };
  };
  return { smtp: pick('smtp', SMTP_PORTS), imap: pick('imap', IMAP_PORTS) };
}

module.exports = { PRESETS, publicPresets, resolveServers };
