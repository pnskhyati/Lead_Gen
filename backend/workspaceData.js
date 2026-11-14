/**
 * Per-workspace file locations and iteration helpers.
 * The "default" workspace keeps the legacy flat layout in data/company so existing data stays put.
 */
const fs = require('fs');
const path = require('path');
const workspaceContext = require('./workspaceContext');

const COMPANY_DIR = path.join(__dirname, 'data', 'company');

function companyDir(ws) {
  const id = workspaceContext.resolve(ws);
  return id === workspaceContext.DEFAULT_WORKSPACE ? COMPANY_DIR : path.join(COMPANY_DIR, 'workspaces', id);
}

/** Absolute path of a file inside the current (or given) workspace folder. Does not create anything. */
function companyPath(file, ws) {
  return path.join(companyDir(ws), file);
}

function ensureCompanyDir(ws) {
  const dir = companyDir(ws);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Workspaces that have data on disk (always includes "default"). */
function listWorkspaceIds() {
  const ids = new Set([workspaceContext.DEFAULT_WORKSPACE]);
  try {
    for (const entry of fs.readdirSync(path.join(COMPANY_DIR, 'workspaces'), { withFileTypes: true })) {
      if (entry.isDirectory() && /^[A-Za-z0-9_-]{1,64}$/.test(entry.name)) ids.add(entry.name);
    }
  } catch {
    /* no tenant folders yet */
  }
  return [...ids];
}

/** Run an async job once per workspace, isolating failures so one tenant cannot block the rest. */
async function forEachWorkspace(fn, ids = listWorkspaceIds()) {
  const results = [];
  for (const ws of ids) {
    try {
      results.push({ ws, ok: true, value: await workspaceContext.run(ws, () => fn(ws)) });
    } catch (err) {
      console.warn(`[workspace:${ws}]`, err.message);
      results.push({ ws, ok: false, error: err.message });
    }
  }
  return results;
}

module.exports = { companyDir, companyPath, ensureCompanyDir, listWorkspaceIds, forEachWorkspace };
