/**
 * In-memory background jobs for slow work (plan generation, competitor research) that the UI polls.
 * One job of a kind runs per workspace at a time; a second request joins the running one.
 * Jobs are lost on restart; anything important is persisted by the work itself (campaigns are saved as they are built).
 */
const crypto = require('crypto');

const TTL_MS = 60 * 60_000;
const jobs = new Map();

function prune() {
  const now = Date.now();
  for (const [id, j] of jobs) if (j.finishedAt && now - j.finishedAt > TTL_MS) jobs.delete(id);
}

const publicJob = (j) => ({
  id: j.id,
  kind: j.kind,
  status: j.status,
  stage: j.stage,
  detail: j.detail,
  result: j.status === 'done' ? j.result : undefined,
  error: j.status === 'error' ? j.error : undefined,
  startedAt: j.startedAt,
});

/**
 * @param {string} ws workspace
 * @param {string} kind
 * @param {(setProgress: (stage: string, detail?: object) => void) => Promise<any>} work
 */
function start(ws, kind, work) {
  prune();
  for (const j of jobs.values()) if (j.ws === ws && j.kind === kind && j.status === 'running') return { job: publicJob(j), joined: true };
  const job = { id: `job-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`, ws, kind, status: 'running', stage: 'queued', detail: null, startedAt: Date.now() };
  jobs.set(job.id, job);
  Promise.resolve()
    .then(() =>
      work((stage, detail) => {
        job.stage = stage;
        job.detail = detail || null;
      })
    )
    .then((result) => {
      job.status = 'done';
      job.stage = 'done';
      job.result = result;
    })
    .catch((err) => {
      console.warn(`[Social] job ${kind} failed:`, err.message);
      job.status = 'error';
      job.error = err.message;
    })
    .finally(() => {
      job.finishedAt = Date.now();
    });
  return { job: publicJob(job), joined: false };
}

function get(id, ws) {
  const j = jobs.get(String(id));
  return j && j.ws === ws ? publicJob(j) : null;
}

module.exports = { start, get };
