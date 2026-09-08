#!/usr/bin/env node

// Regenerates db/schema-snapshot.sql by querying the live schema on the dev
// Aurora DSQL cluster via information_schema, then formatting it back out as
// one CREATE TABLE-shaped block per table. Reading it live means a table
// shows its actual current columns/constraints regardless of how many
// separate migrations touched it over time (e.g. a later ALTER TABLE ADD
// COLUMN migration would otherwise be a separate block far away from the
// table's original CREATE TABLE) - db/migrations/ remains the source of
// truth for *how* the schema got to this state, this file only documents
// *what* it looks like now. Generated, never hand-edited or applied
// directly. Re-run (`pnpm --filter backend schema-snapshot`) after applying
// a new migration (`pnpm --filter backend migrate`) so it reflects the
// schema change.

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { DsqlSigner } = require('@aws-sdk/dsql-signer');

const log4js = require('log4js');
const logger = log4js.getLogger();
logger.level = 'debug';

const DSQL_ENDPOINT = process.env.DSQL_ENDPOINT;
const DSQL_REGION = 'us-east-2';
const OUTPUT_FILE = path.join(__dirname, '../db/schema-snapshot.sql');

// Bookkeeping table for migrate.js itself, not part of the app's data model -
// left out of the snapshot so it only documents the tables the app uses.
const EXCLUDED_TABLES = new Set(['schema_migrations']);

const HEADER = `-- GENERATED FILE - do not edit by hand.
-- Reflects the live schema on the dev DSQL cluster (queried via
-- information_schema), not merely the migration files that produced it - see
-- db/migrations/ for that history. Regenerate with
-- \`pnpm --filter backend schema-snapshot\` after applying a new migration.
`;

async function fetchTableNames(client) {
  const { rows } = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
  );
  return rows.map((row) => row.table_name).filter((name) => !EXCLUDED_TABLES.has(name));
}

async function fetchColumns(client) {
  const { rows } = await client.query(
    `SELECT table_name, column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema = 'public'
     ORDER BY table_name, ordinal_position`,
  );
  return rows;
}

// Primary key columns, in their constraint's column order - single-column
// primary keys are rendered inline on the column itself, composite ones as
// a trailing table-level PRIMARY KEY (...) line.
async function fetchPrimaryKeys(client) {
  const { rows } = await client.query(
    `SELECT tc.table_name, kcu.column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
     WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
     ORDER BY tc.table_name, kcu.ordinal_position`,
  );
  return rows;
}

// Foreign keys, rendered inline on the referencing column (matching how
// they're hand-written in the migration files) rather than as a trailing
// table-level constraint.
async function fetchForeignKeys(client) {
  const { rows } = await client.query(
    `SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
     JOIN information_schema.constraint_column_usage ccu
       ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'`,
  );
  return rows;
}

// CHECK constraints - rendered as trailing table-level lines rather than
// attempting to attach them inline on a specific column, since check_clause
// is a free-form SQL expression that can reference any number of columns.
async function fetchCheckConstraints(client) {
  const { rows } = await client.query(
    `SELECT tc.table_name, cc.check_clause
     FROM information_schema.table_constraints tc
     JOIN information_schema.check_constraints cc
       ON tc.constraint_name = cc.constraint_name AND tc.table_schema = cc.constraint_schema
     WHERE tc.constraint_type = 'CHECK' AND tc.table_schema = 'public'`,
  );
  // DSQL surfaces every NOT NULL column as its own synthesized "<col> IS NOT
  // NULL" CHECK constraint alongside any real ones - filtered out here since
  // that's already conveyed by the NOT NULL on the column itself.
  const NOT_NULL_CHECK_PATTERN = /^"?[a-zA-Z_][a-zA-Z0-9_]*"?\s+IS\s+NOT\s+NULL$/i;
  return rows.filter((row) => !NOT_NULL_CHECK_PATTERN.test(row.check_clause.trim()));
}

// Formats one column's information_schema row back into a single DDL-style
// line, e.g. a NOT NULL text primary key column becomes
// `  competition_id TEXT NOT NULL PRIMARY KEY`, and a nullable foreign key
// column becomes `  competition_id TEXT REFERENCES competitions (id)`.
function formatColumn(column, { primaryKeyColumns, foreignKeysByColumn }) {
  let line = `  ${column.column_name} ${column.data_type.toUpperCase()}`;
  if (column.is_nullable === 'NO') line += ' NOT NULL';
  if (column.column_default !== null) line += ` DEFAULT ${column.column_default}`;
  if (primaryKeyColumns.length === 1 && primaryKeyColumns[0] === column.column_name) {
    line += ' PRIMARY KEY';
  }
  const foreignKey = foreignKeysByColumn.get(column.column_name);
  if (foreignKey) {
    line += ` REFERENCES ${foreignKey.foreign_table_name} (${foreignKey.foreign_column_name})`;
  }
  return line;
}

// Formats one table's full CREATE TABLE (...) block.
function formatTable(tableName, { columns, primaryKeys, foreignKeys, checkConstraints }) {
  const tableColumns = columns.filter((column) => column.table_name === tableName);
  const primaryKeyColumns = primaryKeys
    .filter((row) => row.table_name === tableName)
    .map((row) => row.column_name);
  const foreignKeysByColumn = new Map(
    foreignKeys.filter((row) => row.table_name === tableName).map((row) => [row.column_name, row]),
  );

  const lines = tableColumns.map((column) =>
    formatColumn(column, { primaryKeyColumns, foreignKeysByColumn }),
  );
  if (primaryKeyColumns.length > 1) {
    lines.push(`  PRIMARY KEY (${primaryKeyColumns.join(', ')})`);
  }
  checkConstraints
    .filter((row) => row.table_name === tableName)
    .forEach((row) => {
      // check_clause is already parenthesized by Postgres/DSQL (sometimes
      // doubly so) - normalize to a single wrapping pair to match the
      // CHECK (...) style used in the hand-written migration files.
      const clause = row.check_clause.trim().replace(/^\(+/, '(').replace(/\)+$/, ')');
      lines.push(`  CHECK ${clause}`);
    });

  return `CREATE TABLE ${tableName} (\n${lines.join(',\n')}\n);`;
}

async function main() {
  if (!DSQL_ENDPOINT) {
    throw new Error('Set DSQL_ENDPOINT to the DSQL cluster endpoint to read the schema from.');
  }

  // Admin-scoped token
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
    const tableNames = await fetchTableNames(client);
    const columns = await fetchColumns(client);
    const primaryKeys = await fetchPrimaryKeys(client);
    const foreignKeys = await fetchForeignKeys(client);
    const checkConstraints = await fetchCheckConstraints(client);

    const body = tableNames
      .map((tableName) =>
        formatTable(tableName, { columns, primaryKeys, foreignKeys, checkConstraints }),
      )
      .join('\n\n');

    fs.writeFileSync(OUTPUT_FILE, `${HEADER}\n${body}\n`);
    logger.info(
      `Wrote ${tableNames.length} tables to ${path.relative(process.cwd(), OUTPUT_FILE)}`,
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  logger.error('Failed to generate schema snapshot: ', err);
  process.exit(1);
});
