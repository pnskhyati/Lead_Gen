const path = require('path');
const { createWorkspaceStore } = require('./wsStore');

// The sign-in made with the LinkedIn app that has the Community Management API (read comments, reply, analytics).
// It is kept apart from the posting sign-in, which uses a different LinkedIn app.
const store = createWorkspaceStore(path.join(__dirname, 'data', 'linkedin-cm.json'), { account: null });

const getAccount = () => store.read().account;
const setAccount = (account) => {
  store.update((s) => {
    s.account = account;
  });
  return account;
};
const clearAccount = () => setAccount(null);
const workspaceIds = () => store.entries().filter(([, s]) => s.account).map(([id]) => id);

module.exports = { getAccount, setAccount, clearAccount, workspaceIds };
