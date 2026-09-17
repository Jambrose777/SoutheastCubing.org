const { Pool } = require('pg');
const { DsqlSigner } = require('@aws-sdk/dsql-signer');

// Logger
const logger = require('../logger.js');
const { config } = require('../utils/config.js');

const DSQL_ENDPOINT = config.DSQL_ENDPOINT;
const DSQL_REGION = 'us-east-2';

// The non-admin database role the backend authenticates as.
const DSQL_DB_USER = 'app_dev';

// A freshly signed IAM token is used as the Postgres password. Passed as a
// function so pg re-signs it for every new physical connection, since tokens
// expire after ~15 minutes.
async function generateAuthToken() {
  // Credentials come from the default AWS credential chain (AWS_ACCESS_KEY_ID/
  // AWS_SECRET_ACCESS_KEY).
  const signer = new DsqlSigner({ hostname: DSQL_ENDPOINT, region: DSQL_REGION });
  return signer.getDbConnectAuthToken();
}

// Pooled connection to the dev Aurora DSQL cluster, reused across requests
// since signing an IAM token plus a TLS handshake per request would be slow.
const pool = new Pool({
  host: DSQL_ENDPOINT,
  port: 5432,
  database: 'postgres',
  user: DSQL_DB_USER,
  password: generateAuthToken,
  ssl: { rejectUnauthorized: true },
  // DSQL drops every connection after 1 hour; recycle well ahead of that cap.
  maxLifetimeSeconds: 3000,
});

pool.on('error', (err) => {
  logger.error('Unexpected error on an idle DSQL client: ', err);
});

// SQLSTATEs DSQL raises for optimistic-concurrency-control conflicts at
// commit (isolation is fixed at Repeatable Read).
const RETRYABLE_SQLSTATES = new Set([
  '40001', // serialization_failure
  '40P01', // deadlock_detected
]);

// Runs `work` with a checked-out client, retrying on DSQL's OCC conflicts.
// Writes should go through this instead of calling pool.query directly.
async function withRetry(work, { retries = 3 } = {}) {
  let attempt = 0;
  for (;;) {
    const client = await pool.connect();
    try {
      return await work(client);
    } catch (err) {
      attempt += 1;
      if (RETRYABLE_SQLSTATES.has(err.code) && attempt <= retries) {
        logger.warn(
          `DSQL write conflict (attempt ${attempt}/${retries}), retrying: ${err.message}`,
        );
        continue;
      }
      throw err;
    } finally {
      client.release();
    }
  }
}

// Confirms the pool can actually reach the cluster - used at boot to fail
// loudly (in the log) if the dev cluster is unreachable or misconfigured,
// without blocking the rest of the app from starting.
async function verifyConnection() {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
}

module.exports = { pool, withRetry, verifyConnection };
