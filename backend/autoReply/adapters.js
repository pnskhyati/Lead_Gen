/**
 * One adapter per channel: how to see new messages and how to answer them.
 * Everything here asks the platform for new activity on a timer, so it works without a public webhook address.
 * A normalised message looks like { externalId, text, author, authorId, timestamp, context, permalink }.
 */
const clip = (v, n) => String(v ?? '').slice(0, n);

function createAdapters({ instagram, facebook, x, linkedin, igStore, fbStore, xStore, liStore }) {
  const igReady = () => {
    const a = igStore.getAccount();
    return Boolean(a?.igUserId && (a.accessToken || a.pageAccessToken));
  };

  return {
    instagram_comments: {
      workspaceIds: () => igStore.workspaceIds(),
      connected: igReady,
      async fetch() {
        const own = String(igStore.getAccount()?.username || '').toLowerCase();
        const list = await instagram.fetchRecentComments(8);
        return list
          .filter((c) => !own || String(c.username || '').toLowerCase() !== own)
          .map((c) => ({
            externalId: String(c.id),
            text: c.text,
            author: c.username,
            authorId: null,
            timestamp: c.timestamp,
            context: c.mediaCaption,
            permalink: c.mediaPermalink,
          }));
      },
      send: (msg, text) => instagram.replyToComment(msg.externalId, text),
    },

    instagram_dms: {
      workspaceIds: () => igStore.workspaceIds(),
      connected: igReady,
      async fetch() {
        const list = await instagram.fetchRecentDms();
        return list.map((m) => ({ externalId: String(m.id), text: m.text, author: m.username || m.senderId, authorId: m.senderId, timestamp: m.timestamp }));
      },
      // Direct messages go through the existing conversation agent, which also writes the lead and sends the reply.
      handleDm: (vertex, leadAgent, msg) =>
        instagram.handleIncomingDm(vertex, leadAgent, { senderId: msg.authorId, text: msg.text, messageId: msg.externalId, isEcho: false }),
    },

    facebook_comments: {
      workspaceIds: () => fbStore.workspaceIds(),
      connected: () => {
        const a = fbStore.getAccount();
        return Boolean(a?.pageId && a?.pageAccessToken);
      },
      async fetch() {
        const pageId = String(fbStore.getAccount()?.pageId || '');
        const list = await facebook.fetchRecentComments(10);
        return list
          .filter((c) => !pageId || String(c.fromId || '') !== pageId)
          .map((c) => ({
            externalId: String(c.id),
            text: c.text,
            author: c.username,
            authorId: c.fromId,
            timestamp: c.timestamp,
            context: c.postMessage,
            permalink: c.postPermalink,
          }));
      },
      send: (msg, text) => facebook.replyToComment(msg.externalId, text),
    },

    linkedin_comments: {
      workspaceIds: () => liStore.workspaceIds(),
      connected: () => {
        const a = liStore.getAccount();
        return Boolean(a?.accessToken);
      },
      async fetch() {
        const list = await linkedin.fetchRecentComments();
        return list.map((c) => ({ externalId: String(c.id), text: c.text, author: c.username, authorId: c.fromId, timestamp: c.timestamp, context: c.postMessage, permalink: c.postPermalink }));
      },
      send: (msg, text) => linkedin.replyToComment(msg.externalId, text),
    },

    facebook_messenger: {
      workspaceIds: () => fbStore.workspaceIds(),
      connected: () => {
        const a = fbStore.getAccount();
        return Boolean(a?.pageId && a?.pageAccessToken);
      },
      async fetch() {
        const list = await facebook.fetchRecentMessages();
        return list.map((m) => ({ externalId: String(m.id), text: m.text, author: m.username || m.senderId, authorId: m.senderId, timestamp: m.timestamp }));
      },
      // A live chat: the agent answers for the company, keeps talking, and works toward the person's contact details.
      handleDm: (vertex, leadAgent, msg) => {
        const ck = require('../companyKnowledge');
        return require('./conversation').handleDirectMessage({
          vertex,
          leadAgent,
          leads: require('../leadsCrm'),
          profile: ck.getProfile(),
          channel: 'facebook',
          platformLabel: 'Facebook Messenger',
          idPrefix: 'fbdm',
          senderId: msg.authorId,
          senderName: msg.author,
          text: msg.text,
          messageId: msg.externalId,
          botName: ck.getBotName?.() || 'Alex',
          autoReplyEnabled: ck.isChannelAutoReplyEnabled('facebook'),
          send: (text) => facebook.sendMessengerMessage(msg.authorId, text),
        });
      },
    },

    x_mentions: {
      workspaceIds: () => xStore.workspaceIds(),
      connected: () => {
        const a = xStore.getAccount();
        return Boolean(a?.userId && a?.accessToken);
      },
      async fetch() {
        const own = String(xStore.getAccount()?.username || '').toLowerCase();
        const list = (await x.fetchRecentMentions()).filter((m) => !own || String(m.username || '').toLowerCase() !== own);
        return list.map((m) => ({ externalId: String(m.id), text: m.text, author: m.username, authorId: null, timestamp: m.timestamp, context: '', permalink: m.permalink }));
      },
      // A reply on X has to name the person it answers.
      send: (msg, text) => x.replyToTweet(msg.externalId, clip(`@${msg.author} ${text}`, 280)),
    },
  };
}

/** The platform's own explanation, with a plain hint for the most common cause. */
function explainError(err) {
  const api = err?.response?.data;
  const raw = api?.error?.message || api?.detail || api?.title || api?.error_description || (typeof api?.error === 'string' ? api.error : '') || err?.message || 'Unknown error';
  const code = api?.error?.code;
  const status = err?.response?.status;
  let hint = '';
  if (code === 190 || status === 401) hint = ' Reconnect this account in Connections: the sign-in has expired.';
  else if (code === 10 || code === 200 || /permission/i.test(raw)) hint = ' The permission for this is missing. Reconnect the account and allow access to comments and messages (the Meta app may also need that permission approved).';
  else if (status === 403 && api?.title) hint = ' Your X plan may not include reading mentions or replying.';
  else if (status === 429 || code === 4 || code === 17) hint = ' The platform is rate-limiting us; it will retry on the next check.';
  return `${String(raw).slice(0, 300)}${hint}`;
}

module.exports = { createAdapters, explainError };
