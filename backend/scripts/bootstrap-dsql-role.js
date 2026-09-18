#!/usr/bin/env node

// One-time (re-runnable) maintenance script: creates the non-admin `app_dev`
// database role on the dev Aurora DSQL cluster and links it to an IAM
// identity via `AWS IAM GRANT`, so that identity can authenticate as
// `app_dev` using a `dsql:DbConnect` token. Run manually
// (`pnpm --filter backend bootstrap-dsql-role`) - never invoked by the
// running backend, which only ever connects as `app_dev` (see ../app/database/pool.js).
//
// To grant a different/additional IAM identity later (e.g. onboarding a
// future contributor), re-run with DSQL_GRANT_IAM_ARN set to their ARN -
// role creation is skipped if `app_dev` already exists, so this is safe to
// re-run against an already-bootstrapped cluster.

const { Client } = require('pg');
const { DsqlSigner } = require('@aws-sdk/dsql-signer');

const log4js = require('log4js');
const logger = log4js.getLogger();
logger.level = 'debug';

const DSQL_ENDPOINT = process.env.DSQL_ENDPOINT;
const DSQL_REGION = 'us-east-2';
const grantArn = process.env.DSQL_GRANT_IAM_ARN;

// Basic shape check before this value gets interpolated into a SQL statement
// below - `AWS IAM GRANT` has no parameterized-query form to bind it safely.
const IAM_ARN_PATTERN = /^arn:aws:iam::\d{12}:(user|role)\/[\w+=,.@-]+$/;

async function main() {
  if (!DSQL_ENDPOINT) {
    throw new Error('Set DSQL_ENDPOINT to the DSQL cluster endpoint to bootstrap.');
  }
  if (!grantArn) {
    throw new Error(
      'Set DSQL_GRANT_IAM_ARN to the IAM user/role ARN that should be able to connect as app_dev.',
    );
  }
  if (!IAM_ARN_PATTERN.test(grantArn)) {
    throw new Error(`DSQL_GRANT_IAM_ARN does not look like a valid IAM user/role ARN: ${grantArn}`);
  }

  // Admin-scoped token - only used for this one-time bootstrap connection,
  // never by the running backend. Credentials come from the default AWS
  // credential chain (AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY in the
  // environment).
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

  // connect to the DSQL client
  await client.connect();

  try {
    // This only creates the role once - on every later run (or for a different
    // developer's ARN), app_dev already exists here. It only runs again if the
    // role is dropped or the cluster is recreated from scratch.
    const { rows } = await client.query("SELECT 1 FROM pg_roles WHERE rolname = 'app_dev'");
    if (rows.length === 0) {
      await client.query('CREATE ROLE app_dev WITH LOGIN');
      logger.info('Created app_dev role.');
    } else {
      logger.info('app_dev role already exists - skipping creation.');
    }

    // The IAM policy alone doesn't determine which database role a
    // dsql:DbConnect token authenticates as - this statement is what actually
    // links the IAM identity to app_dev.
    await client.query(`AWS IAM GRANT app_dev TO '${grantArn}'`);
    logger.info(`Granted IAM identity ${grantArn} the ability to connect as app_dev.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  logger.error('Failed to bootstrap the app_dev DSQL role: ', err);
  process.exit(1);
});
