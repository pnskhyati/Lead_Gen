/* Run: node tenancy.test.js — verifies tenant isolation. Backs up and restores the data files it touches. */
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

process.env.META_APP_SECRET = 'test-secret';
const ctx = require('./workspaceContext');
const leadsCrm = require('./leadsCrm');
const igStore = require('./instagramStore');
const fbStore = require('./facebookStore');
const audit = require('./agentAudit');
const oauthState = require('./oauthState');
const { verifyMetaSignature } = require('./metaWebhook');
const wsData = require('./workspaceData');

const A = `ws-test-a-${Date.now()}`;
const B = `ws-test-b-${Date.now()}`;
const DATA = path.join(__dirname, 'data');
const TOUCHED = ['leads-crm.json', 'instagram.json', 'facebook.json', 'whatsapp.json', 'agent-audit.jsonl'];
const backups = new Map();
let failures = 0;

for (const f of TOUCHED) {
  const p = path.join(DATA, f);
  backups.set(f, fs.existsSync(p) ? fs.readFileSync(p) : null);
}
function restore() {
  for (const [f, buf] of backups) {
    const p = path.join(DATA, f);
    if (buf === null) fs.rmSync(p, { force: true });
    else fs.writeFileSync(p, buf);
  }
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`  FAIL ${name}\n       ${err.stack.split('\n').slice(0, 3).join('\n       ')}`);
  }
}

const inA = (fn) => ctx.run(A, fn);
const inB = (fn) => ctx.run(B, fn);

(async () => {
  console.log('tenancy');

  await test('workspace context survives awaits and timers', async () => {
    await inA(async () => {
      await new Promise((r) => setTimeout(r, 5));
      assert.strictEqual(ctx.current(), A);
      await Promise.resolve();
      assert.strictEqual(ctx.current(), A);
    });
    assert.strictEqual(ctx.current(), 'default');
  });

  await test('concurrent workspaces never bleed into each other', async () => {
    const seen = await Promise.all(
      [A, B, A, B].map((ws) => ctx.run(ws, async () => {
        await new Promise((r) => setTimeout(r, Math.random() * 10));
        return ctx.current();
      }))
    );
    assert.deepStrictEqual(seen, [A, B, A, B]);
  });

  await test('invalid workspace ids are rejected', () => {
    assert.throws(() => ctx.run('../x', () => 1), /Invalid workspace/);
  });

  let leadA;
  await test('leads are invisible across workspaces', async () => {
    leadA = await inA(() => leadsCrm.upsertLead({ channel: 'web', externalId: 'ext-1', author: 'Alice', customerComment: 'secret A' }));
    await inA(() => leadsCrm.addMessage({ leadId: leadA.id, role: 'customer', text: 'hello from A' }));
    assert.strictEqual((await inA(() => leadsCrm.listLeads())).length, 1);
    assert.strictEqual((await inB(() => leadsCrm.listLeads())).filter((l) => l.id === leadA.id).length, 0);
    assert.strictEqual(await inB(() => leadsCrm.getLead(leadA.id)), null);
    assert.deepStrictEqual(await inB(() => leadsCrm.getMessages(leadA.id)), []);
    assert.strictEqual((await inA(() => leadsCrm.getMessages(leadA.id))).length, 1);
  });

  await test('other workspace cannot update, message or overwrite a lead', async () => {
    assert.strictEqual(await inB(() => leadsCrm.updateLead(leadA.id, { author: 'hacked' })), null);
    await assert.rejects(inB(() => leadsCrm.addMessage({ leadId: leadA.id, role: 'human', text: 'x' })), /Lead not found/);
    await assert.rejects(inB(() => leadsCrm.upsertLead({ id: leadA.id, author: 'hacked' })), /Lead not found/);
    assert.strictEqual((await inA(() => leadsCrm.getLead(leadA.id))).author, 'Alice');
  });

  await test('same externalId in two workspaces creates two separate leads', async () => {
    const b = await inB(() => leadsCrm.upsertLead({ channel: 'web', externalId: 'ext-1', author: 'Bob' }));
    assert.notStrictEqual(b.id, leadA.id);
    assert.strictEqual((await inB(() => leadsCrm.getLead(b.id))).author, 'Bob');
    assert.strictEqual((await inA(() => leadsCrm.getLead(leadA.id))).author, 'Alice');
  });

  await test('a patch cannot reassign ownership or identity', async () => {
    await inA(() => leadsCrm.updateLead(leadA.id, { workspaceId: B, id: 'stolen', author: 'Alice2' }));
    assert.strictEqual((await inA(() => leadsCrm.getLead(leadA.id))).author, 'Alice2');
    assert.strictEqual(await inB(() => leadsCrm.getLead(leadA.id)), null);
  });

  await test('counts only include the workspace own leads', async () => {
    assert.strictEqual((await inA(() => leadsCrm.getCounts())).total, 1);
    assert.strictEqual((await inB(() => leadsCrm.getCounts())).total, 1);
  });

  await test('listWorkspaceIds reports every tenant with leads', async () => {
    const ids = await leadsCrm.listWorkspaceIds();
    assert.ok(ids.includes(A) && ids.includes(B) && ids.includes('default'));
  });

  await test('channel accounts are per workspace and routed by account id', () => {
    inA(() => igStore.setAccount({ igUserId: 'IG-A', pageId: 'PG-A', accessToken: 'tokA' }));
    inB(() => igStore.setAccount({ igUserId: 'IG-B', accessToken: 'tokB' }));
    assert.strictEqual(inA(() => igStore.getAccount().accessToken), 'tokA');
    assert.strictEqual(inB(() => igStore.getAccount().accessToken), 'tokB');
    assert.strictEqual(igStore.findWorkspaceByAccountId('IG-A'), A);
    assert.strictEqual(igStore.findWorkspaceByAccountId('PG-A'), A);
    assert.strictEqual(igStore.findWorkspaceByAccountId('IG-B'), B);
    assert.strictEqual(igStore.findWorkspaceByAccountId('nope'), null);
    inA(() => igStore.clearAccount());
    assert.strictEqual(inA(() => igStore.getAccount()), null);
    assert.strictEqual(inB(() => igStore.getAccount().igUserId), 'IG-B');
  });

  await test('facebook store keeps seen comments per workspace', () => {
    inA(() => fbStore.markCommentsSeen(['c1']));
    assert.ok(inA(() => fbStore.getSeenCommentIds().has('c1')));
    assert.ok(!inB(() => fbStore.getSeenCommentIds().has('c1')));
  });

  await test('audit trail is filtered by workspace', () => {
    inA(() => audit.appendAudit({ action: 'a-only', event_id: 'evt-a' }));
    inB(() => audit.appendAudit({ action: 'b-only', event_id: 'evt-b' }));
    const a = inA(() => audit.recentAudits(500));
    const b = inB(() => audit.recentAudits(500));
    assert.ok(a.some((r) => r.event_id === 'evt-a') && !a.some((r) => r.event_id === 'evt-b'));
    assert.ok(b.some((r) => r.event_id === 'evt-b') && !b.some((r) => r.event_id === 'evt-a'));
  });

  await test('oauth state binds user, channel and expiry', () => {
    const userA = { id: 'u1', workspaceId: A };
    const state = oauthState.create({ channel: 'instagram', appUser: userA });
    assert.strictEqual(oauthState.verify(state, 'instagram', userA).workspaceId, A);
    assert.throws(() => oauthState.verify(state, 'facebook', userA), /oauth_state_invalid/);
    assert.throws(() => oauthState.verify(state, 'instagram', { id: 'attacker', workspaceId: B }), /oauth_user_mismatch/);
    assert.throws(() => oauthState.verify('garbage', 'instagram', userA), /oauth_session_expired/);
    assert.throws(() => oauthState.verify(state, 'instagram', null), /oauth_user_mismatch/);
  });

  await test('meta webhook signatures are enforced', () => {
    const body = Buffer.from('{"entry":[]}');
    const good = `sha256=${crypto.createHmac('sha256', 'test-secret').update(body).digest('hex')}`;
    const mk = (sig, raw = body) => ({ rawBody: raw, get: (h) => (h.toLowerCase() === 'x-hub-signature-256' ? sig : undefined) });
    assert.strictEqual(verifyMetaSignature(mk(good)), true);
    assert.strictEqual(verifyMetaSignature(mk('sha256=deadbeef')), false);
    assert.strictEqual(verifyMetaSignature(mk(undefined)), false);
    assert.strictEqual(verifyMetaSignature(mk(good, Buffer.from('{"entry":[1]}'))), false);
  });

  await test('whatsapp numbers route to the owning workspace only', async () => {
    const wa = require('./whatsapp');
    const store = require('./wsStore').createWorkspaceStore(path.join(DATA, 'whatsapp.json'), {});
    store.update((s) => ({ ...s, token: 't', phoneNumberId: '1234567890' }), A);
    assert.strictEqual(wa.findWorkspaceByPhoneNumberId('1234567890'), A);
    assert.strictEqual(wa.findWorkspaceByPhoneNumberId('999'), null);
    assert.strictEqual(inA(() => wa.getConfig().phoneNumberId), '1234567890');
    assert.strictEqual(inB(() => wa.getConfig().phoneNumberId), '');
  });

  await test('per-workspace data paths never escape the data folder', () => {
    const p = inA(() => wsData.companyPath('x.json'));
    assert.ok(p.includes(path.join('workspaces', A)));
    assert.ok(!wsData.companyPath('x.json', 'default').includes('workspaces'));
    assert.throws(() => wsData.companyPath('x.json', '../../etc'), /Invalid workspace/);
  });

  restore();
  for (const ws of [A, B]) fs.rmSync(path.join(DATA, 'company', 'workspaces', ws), { recursive: true, force: true });
  console.log(failures ? `\n${failures} failed` : '\nall passed');
  process.exit(failures ? 1 : 0);
})().catch((err) => {
  restore();
  console.error(err);
  process.exit(1);
});
