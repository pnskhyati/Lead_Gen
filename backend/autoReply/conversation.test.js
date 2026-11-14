/* Run: node autoReply/conversation.test.js — a chat with a person: answers, collects contact details, becomes a lead. */
const assert = require('assert');
const { handleDirectMessage, extractContact } = require('./conversation');

let failures = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`  FAIL ${name}\n       ${err.stack.split('\n').slice(0, 4).join('\n       ')}`);
  }
}

function fakes() {
  const leadsById = {};
  const messages = [];
  const upserts = [];
  return {
    messages,
    upserts,
    leads: {
      async upsertLead(p) {
        const id = p.id || 'L1';
        leadsById[id] = { ...(leadsById[id] || { id, status: 'new' }), ...Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined)), id };
        upserts.push({ ...p });
        return leadsById[id];
      },
      async addMessage(m) {
        messages.push(m);
      },
      async getMessages() {
        return messages;
      },
    },
  };
}
const agent = (over = {}) => ({ chat: async () => ({ reply: 'We connect your systems with AI. What are you trying to solve?', leadTemperature: 'warm', leadScore: 40, scoreBand: 'B', intent: 'GENERAL_QUERY', intentConfidence: 0.8, needsHandoff: false, captureLead: false, ...over }) });

(async () => {
  await test('contact details are found in a message', () => {
    assert.deepStrictEqual(extractContact('mail me at ravi@acme.io or call +91 98765 43210'), { email: 'ravi@acme.io', phone: '+91 98765 43210' });
    assert.deepStrictEqual(extractContact('hello there'), { email: null, phone: null });
    assert.strictEqual(extractContact('order 12345').phone, null, 'a short number is not a phone');
  });

  await test('first message: the agent introduces itself, replies, and a lead is created', async () => {
    const f = fakes();
    const sent = [];
    const r = await handleDirectMessage({ vertex: {}, leadAgent: agent(), leads: f.leads, profile: { companyName: 'Tecavy' }, channel: 'facebook', platformLabel: 'Facebook Messenger', idPrefix: 'fbdm', senderId: '9', senderName: 'Ravi', text: 'What do you do?', messageId: 'm1', send: async (t) => sent.push(t), botName: 'Alex' });
    assert.strictEqual(r.sent, true);
    assert.match(sent[0], /^Hi, I'm Alex from Tecavy\./);
    assert.strictEqual(f.upserts[0].externalId, 'fbdm:9');
    assert.deepStrictEqual(f.messages.map((m) => m.role), ['customer', 'agent']);
  });

  await test('when the person shares an email, it is saved on the lead and the lead becomes qualified', async () => {
    const f = fakes();
    await handleDirectMessage({ vertex: {}, leadAgent: agent(), leads: f.leads, profile: {}, channel: 'facebook', platformLabel: 'Facebook Messenger', idPrefix: 'fbdm', senderId: '9', senderName: 'Ravi', text: "I'm Ravi, ravi@acme.io", messageId: 'm2', send: async () => {}, botName: 'Alex' });
    const last = f.upserts.at(-1);
    assert.strictEqual(last.email, 'ravi@acme.io');
    assert.strictEqual(last.status, 'qualified');
    assert.match(last.nextBestAction, /follow up personally/);
  });

  await test('a complaint is handed to a person and the agent stops answering that chat', async () => {
    const f = fakes();
    const r = await handleDirectMessage({ vertex: {}, leadAgent: agent({ needsHandoff: true, handoffReason: 'complaint' }), leads: f.leads, profile: {}, channel: 'facebook', platformLabel: 'Facebook Messenger', idPrefix: 'fbdm', senderId: '9', senderName: 'Ravi', text: 'This is terrible', messageId: 'm3', send: async () => {}, botName: 'Alex' });
    assert.strictEqual(f.upserts.at(-1).status, 'handed_off');
    const again = await handleDirectMessage({ vertex: {}, leadAgent: agent(), leads: f.leads, profile: {}, channel: 'facebook', platformLabel: 'Facebook Messenger', idPrefix: 'fbdm', senderId: '9', senderName: 'Ravi', text: 'hello?', messageId: 'm4', send: async () => assert.fail('must not send'), botName: 'Alex' });
    assert.strictEqual(again.skipped, true);
    assert.strictEqual(r.sent, true);
  });

  await test('a failed send is reported, not hidden', async () => {
    const f = fakes();
    const r = await handleDirectMessage({ vertex: {}, leadAgent: agent(), leads: f.leads, profile: {}, channel: 'facebook', platformLabel: 'Facebook Messenger', idPrefix: 'fbdm', senderId: '9', senderName: 'Ravi', text: 'hi', messageId: 'm5', send: async () => { throw Object.assign(new Error('x'), { response: { data: { error: { message: '(#200) Requires pages_messaging' } } } }); }, botName: 'Alex' });
    assert.strictEqual(r.sent, false);
    assert.match(r.sendError, /pages_messaging/);
  });

  await test('auto-reply switched off in business settings: the lead is kept, nothing is sent', async () => {
    const f = fakes();
    const r = await handleDirectMessage({ vertex: {}, leadAgent: agent(), leads: f.leads, profile: {}, channel: 'facebook', platformLabel: 'Facebook Messenger', idPrefix: 'fbdm', senderId: '9', senderName: 'Ravi', text: 'hi', messageId: 'm6', send: async () => assert.fail('must not send'), autoReplyEnabled: false });
    assert.strictEqual(r.reason, 'auto_reply_disabled');
    assert.strictEqual(f.messages.length, 1);
  });

  console.log(failures ? `\n${failures} failed` : '\nall passed');
  process.exit(failures ? 1 : 0);
})();
