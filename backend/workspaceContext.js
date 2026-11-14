/**
 * Request-scoped workspace (tenant) context.
 *
 * Signed-in requests run inside the user's workspace (set by appAuth). Webhooks resolve the
 * workspace from the connected account they were sent to, then call `run`. Background jobs
 * iterate workspaces explicitly. Code with no context falls back to the legacy "default"
 * workspace, which owns all data created before multi-tenancy.
 */
const { AsyncLocalStorage } = require('async_hooks');

const DEFAULT_WORKSPACE = 'default';
const storage = new AsyncLocalStorage();

function assertValid(ws) {
  const id = String(ws || '').trim();
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new Error('Invalid workspace');
  return id;
}

/** Workspace id for the current async context. */
function current() {
  return storage.getStore()?.workspaceId || DEFAULT_WORKSPACE;
}

/** Run `fn` (sync or async) inside a workspace. */
function run(workspaceId, fn) {
  return storage.run({ workspaceId: assertValid(workspaceId || DEFAULT_WORKSPACE) }, fn);
}

/** Resolve an explicit workspace argument, falling back to the current context. */
function resolve(ws) {
  return ws ? assertValid(ws) : current();
}

/** Mongo filter for a workspace; legacy documents without the field belong to "default". */
function mongoFilter(ws = current()) {
  return ws === DEFAULT_WORKSPACE
    ? { $or: [{ workspaceId: DEFAULT_WORKSPACE }, { workspaceId: { $exists: false } }] }
    : { workspaceId: ws };
}

/** True if a stored record (file store) belongs to the workspace. */
function owns(record, ws = current()) {
  return (record?.workspaceId || DEFAULT_WORKSPACE) === ws;
}

module.exports = { DEFAULT_WORKSPACE, current, run, resolve, mongoFilter, owns, assertValid };
