const { AsyncLocalStorage } = require('node:async_hooks');

// Carries the current request's correlation id through every downstream
// async call (controllers -> services -> integrations -> database)
// logger.util.js reads it automatically from whatever request is currently
// in flight.
const asyncLocalStorage = new AsyncLocalStorage();

// Runs `callback` with `requestId` available to getRequestId() for the
// entire async chain spawned from it.
function run(requestId, callback) {
  return asyncLocalStorage.run({ requestId }, callback);
}

// Returns the current request's id, or undefined outside of a request (e.g.
// the boot-time fetch/cron job, which have no caller to correlate against).
function getRequestId() {
  return asyncLocalStorage.getStore()?.requestId;
}

module.exports = { run, getRequestId };
