/**
 * Small JSON store that keeps one state object per workspace.
 *
 * File shape: { "workspaces": { "<id>": { ...state } } }.
 * A legacy single-tenant file (state fields at the top level) is read as the "default" workspace.
 */
const fs = require('fs');
const path = require('path');
const workspaceContext = require('./workspaceContext');

function createWorkspaceStore(file, defaults) {
  const fresh = () => JSON.parse(JSON.stringify(defaults));

  function readAll() {
    let raw = null;
    try {
      raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      /* missing or corrupt: start empty */
    }
    if (raw && raw.workspaces && typeof raw.workspaces === 'object') return raw;
    // Legacy layout -> default workspace
    return { workspaces: raw && typeof raw === 'object' ? { [workspaceContext.DEFAULT_WORKSPACE]: raw } : {} };
  }

  function writeAll(data) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  }

  /** State for a workspace (current context by default). Never null. */
  function read(ws) {
    const id = workspaceContext.resolve(ws);
    return { ...fresh(), ...(readAll().workspaces[id] || {}) };
  }

  /** Apply `fn(state)` (mutating or returning a new state) and persist it. Returns the new state. */
  function update(fn, ws) {
    const id = workspaceContext.resolve(ws);
    const all = readAll();
    const current = { ...fresh(), ...(all.workspaces[id] || {}) };
    const next = fn(current) || current;
    all.workspaces[id] = next;
    writeAll(all);
    return next;
  }

  /** Every workspace that has stored state, as [id, state] pairs. */
  function entries() {
    return Object.entries(readAll().workspaces).map(([id, state]) => [id, { ...fresh(), ...state }]);
  }

  return { read, update, entries };
}

module.exports = { createWorkspaceStore };
