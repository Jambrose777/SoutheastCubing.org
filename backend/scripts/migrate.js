#!/usr/bin/env node

// Applies any pending files under db/migrations/ to the dev Aurora DSQL cluster,
// in filename order, tracking what's already been applied in a
// schema_migrations table. Run manually (`pnpm --filter backend migrate`) -
// never invoked by the running backend, which only ever connects as the
// non-admin app_dev role (see ../db/pool.js).
//
// DSQL allows only one DDL statement per transaction, and never allows DDL
// and DML mixed in the same transaction - so every migration file must
// contain exactly one statement, and applying a migration (its own
// statement/implicit transaction) can't be committed atomically together
// with recording it in schema_migrations (a separate DML statement/
// transaction): if this script dies between applying a migration and recording 
// it, re-running it harmlessly re-applies rather than corrupting state.

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { DsqlSigner } = require('@aws-sdk/dsql-signer');

const log4js = require('log4js');
const logger = log4js.getLogger();
logger.level = 'debug';

const DSQL_ENDPOINT = process.env.DSQL_ENDPOINT;
const DSQL_REGION = 'us-east-2';
const MIGRATIONS_DIR = path.join(__dirname, '../db/migrations');

// SQLSTATE DSQL raises when a session's cached catalog version goes stale
// after a DDL statement elsewhere bumps it (OCC code OC001) - the same
// SQLSTATE db/pool.js already retries on for ordinary write conflicts.
const RETRYABLE_SQLSTATE = '40001';

// Runs a single statement against `client`, retrying on catalog-concurrency
// errors. Every migration statement (DDL, GRANT, or DML) can transiently see
// a stale catalog right after another statement bumps its version, not just
// statements touching the changed table - so every query here goes through
// this instead of calling client.query directly.
async function runWithRetry(client, sql, params, { retries = 3 } = {}) {
  let attempt = 0;
  for (;;) {
    try {
      return await client.query(sql, params);
    } catch (err) {
      attempt += 1;
      if (err.code === RETRYABLE_SQLSTATE && attempt <= retries) {
        logger.warn(
          `Retrying after a catalog concurrency error (attempt ${attempt}/${retries}): ${err.message}`,
        );
        continue;
      }
      throw err;
    }
  }
}

async function main() {
  if (!DSQL_ENDPOINT) {
    throw new Error('Set DSQL_ENDPOINT to the DSQL cluster endpoint to run migrations against.');
  }

  // Admin-scoped token - migrations run DDL/GRANT statements the non-admin
  // app_dev role can't run itself.
  const signer = new DsqlSigner({ hostname: DSQL_ENDPOINT, region: DSQL_REGION });
  const token = await signer.getDbConnectAdminAuthToken();

  const client = new Client({
    host: DSQL_ENDPOINT,
    port: 5432,
    database: 'postgres',
    user: 'admin',
    password: token,
    ssl: { rejectUnauthorized: true },
  });

  await client.connect();
  try {
    // Tracks which migration files have already been applied, keyed on the
    // filename as a plain TEXT primary key - no SERIAL/IDENTITY needed, and
    // this table itself has to be created as its own standalone statement.
    await runWithRetry(
      client,
      'CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())',
    );

    const { rows: appliedRows } = await runWithRetry(client, 'SELECT name FROM schema_migrations');
    const applied = new Set(appliedRows.map((row) => row.name));

    const migrationFiles = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    let appliedCount = 0;
    for (const file of migrationFiles) {
      if (applied.has(file)) continue;

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      // Apply the migration, then record it, as two separate statements -
      // DSQL can't commit a migration's DDL together with the DML that
      // records it in one transaction.
      await runWithRetry(client, sql);
      await runWithRetry(client, 'INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      logger.info(`Applied migration: ${file}`);
      appliedCount += 1;
    }

    if (appliedCount === 0) {
      logger.info('No pending migrations.');
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  logger.error('Failed to run migrations: ', err);
  process.exit(1);
});
