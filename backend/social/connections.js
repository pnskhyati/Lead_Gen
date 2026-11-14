/**
 * Which publishing channels are usable for the current workspace, and the LinkedIn <-> workspace link.
 *
 * LinkedIn authenticates by its own cookie/account (separate from the app login), so the scheduler needs a
 * stored link from a workspace to the LinkedIn person it may post as. The link is only created from a signed
 * OAuth state tied to the signed-in user, and a LinkedIn identity can belong to only one workspace.
 */
const path = require('path');
const { createWorkspaceStore } = require('../wsStore');
const workspaceContext = require('../workspaceContext');

const links = createWorkspaceStore(path.join(__dirname, '..', 'data', 'linkedin-links.json'), { urn: null, name: null, linkedAt: null });

function getLinkedInLink(ws) {
  const l = links.read(ws);
  return l.urn ? l : null;
}

/** Link a LinkedIn identity to a workspace. Refuses if another workspace already owns it. */
function linkLinkedIn(ws, { urn, name }) {
  const id = workspaceContext.resolve(ws);
  for (const [other, state] of links.entries()) {
    if (state.urn === urn && other !== id) throw new Error('That LinkedIn account is already connected to another workspace');
  }
  return links.update(() => ({ urn, name: name || null, linkedAt: new Date().toISOString() }), id);
}

function unlinkLinkedIn(ws) {
  return links.update(() => ({ urn: null, name: null, linkedAt: null }), ws);
}

/**
 * @param {{ linkedinAccountExists?: (urn: string) => Promise<boolean> }} deps
 * @returns {Promise<Record<'linkedin'|'instagram'|'facebook'|'x', { connected: boolean, detail?: string }>>}
 */
async function getConnections({ linkedinAccountExists = async () => false } = {}, ws) {
  const fbStore = require('../facebookStore');
  const igStore = require('../instagramStore');
  const fb = fbStore.getAccount();
  const ig = igStore.getAccount();

  const facebook = Boolean((fb?.pageId && fb?.pageAccessToken) || (ig?.pageId && ig?.pageAccessToken));
  const instagram = Boolean((fb?.igUserId && fb?.pageAccessToken) || (ig?.authMode === 'facebook_login' && ig?.igUserId && ig?.pageAccessToken) || (ig?.authMode === 'instagram_login' && ig?.igUserId && ig?.accessToken && (ig.scopes ? String(ig.scopes).includes('content_publish') : false)));

  let x = false;
  try {
    x = Boolean(require('../xStore').getAccount());
  } catch {
    x = false;
  }

  const link = getLinkedInLink(ws);
  let linkedin = false;
  let linkedinDetail;
  if (!link) linkedinDetail = 'Connect LinkedIn in Channels while signed in.';
  else {
    try {
      linkedin = await linkedinAccountExists(link.urn);
      if (linkedin) linkedinDetail = link.name || undefined;
      if (!linkedin) linkedinDetail = 'LinkedIn needs to be reconnected.';
    } catch {
      linkedinDetail = 'LinkedIn status could not be checked.';
    }
  }

  return {
    linkedin: { connected: linkedin, detail: linkedinDetail },
    instagram: {
      connected: instagram,
      detail: instagram ? undefined : 'Instagram posting needs a Facebook Page linked to the Instagram account.',
    },
    facebook: { connected: facebook },
    x: { connected: x },
  };
}

const connectedMap = (c) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v.connected]));

module.exports = { getConnections, connectedMap, getLinkedInLink, linkLinkedIn, unlinkLinkedIn };
