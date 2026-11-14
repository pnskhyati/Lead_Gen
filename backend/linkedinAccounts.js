/**
 * LinkedIn account storage that works without MongoDB.
 *
 * Mongo stays the primary store when it is connected. Every write is also kept in a local file, and reads fall back to
 * it when Mongo is down, so connecting LinkedIn and publishing do not depend on running a database.
 * Exposes the small part of the Mongoose model API that server.js uses.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'data', 'linkedin-accounts.json');

function load() {
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return Array.isArray(parsed.accounts) ? parsed.accounts : [];
  } catch {
    return [];
  }
}

function save(accounts) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  const body = JSON.stringify({ accounts }, null, 2);
  fs.writeFileSync(tmp, body);
  try {
    fs.renameSync(tmp, FILE);
  } catch {
    fs.writeFileSync(FILE, body); // Windows can refuse to rename over a file that is briefly locked
    fs.rmSync(tmp, { force: true });
  }
}

/** @param {import('mongoose').Model} Mongo @param {() => boolean} mongoUp */
function createAccountStore(Mongo, mongoUp) {
  const fromFile = (rec) =>
    rec && {
      ...rec,
      async save() {
        const all = load();
        const i = all.findIndex((a) => a.urn === this.urn);
        const { save: _s, ...plain } = this;
        if (i >= 0) all[i] = plain;
        else all.push(plain);
        save(all);
        if (mongoUp()) await Mongo.updateOne({ urn: this.urn }, { isActive: this.isActive }).catch(() => undefined);
        return this;
      },
    };

  return {
    async findOne({ urn }) {
      if (mongoUp()) {
        const doc = await Mongo.findOne({ urn });
        if (doc) return doc;
      }
      return fromFile(load().find((a) => a.urn === urn) || null);
    },

    async find({ urn }) {
      if (mongoUp()) {
        const docs = await Mongo.find({ urn });
        if (docs.length) return docs;
      }
      return load().filter((a) => a.urn === urn);
    },

    async exists({ urn }) {
      if (mongoUp() && (await Mongo.exists({ urn }))) return true;
      return load().some((a) => a.urn === urn);
    },

    async findOneAndUpdate({ urn }, set) {
      const all = load();
      const i = all.findIndex((a) => a.urn === urn);
      const next = { ...(i >= 0 ? all[i] : {}), urn, ...set };
      if (i >= 0) all[i] = next;
      else all.push(next);
      save(all);
      if (mongoUp()) await Mongo.findOneAndUpdate({ urn }, set, { upsert: true, new: true }).catch(() => undefined);
      return fromFile(next);
    },

    async updateMany(_filter, set) {
      save(load().map((a) => ({ ...a, ...set })));
      if (mongoUp()) await Mongo.updateMany({}, set).catch(() => undefined);
    },
  };
}

module.exports = { createAccountStore };
