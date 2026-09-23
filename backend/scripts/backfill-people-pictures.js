#!/usr/bin/env node

// One-off (re-runnable) script: fills in `picture_url` (and refreshes
// `name`) for `people` rows that have a `wca_id`, no picture yet, and no
// `users` row - the gap left by a migration-seeded row, which only ever
// gets a name/wca_id via raw SQL `INSERT`s, never a live WCA lookup.
//
// Run via `pnpm --filter backend backfill-people-pictures`.

const db = require('../app/database/pool.js');
const peopleDb = require('../app/database/people.database.js');
const wcaIntegration = require('../app/integrations/wca.integration.js');
const logger = require('../app/utils/logger.util.js');

async function main() {
  const { rows } = await db.pool.query(
    `SELECT p.id, p.wca_id, p.name
     FROM people p
     WHERE p.wca_id IS NOT NULL
       AND p.picture_url IS NULL
       AND NOT EXISTS (SELECT 1 FROM users u WHERE u.people_id = p.id)`,
  );

  logger.info(`Found ${rows.length} people row(s) with a wca_id but no picture (and no users row) yet.`);

  let succeeded = 0;
  let skipped = 0;
  let failed = 0;

  for (const person of rows) {
    try {
      const wcaPerson = await wcaIntegration.fetchPersonByWcaId(person.wca_id);
      if (!wcaPerson) {
        logger.warn(`No WCA person found for wca_id ${person.wca_id} (${person.name}) - skipping.`);
        skipped += 1;
        continue;
      }
      await peopleDb.upsertPersonFromWcaIdLookup({
        wcaId: person.wca_id,
        name: wcaPerson.name,
        pictureUrl: wcaPerson.avatar?.thumb_url ?? null,
      });
      logger.info(`Backfilled picture for ${wcaPerson.name} (wca_id ${person.wca_id}).`);
      succeeded += 1;
    } catch (err) {
      logger.error(
        `Failed to backfill picture for wca_id ${person.wca_id} (${person.name}): `,
        err,
      );
      failed += 1;
    }
  }

  logger.info(
    `Done - ${succeeded} succeeded, ${skipped} skipped (not found on WCA), ${failed} failed.`,
  );
}

main()
  .catch((err) => {
    logger.error('Failed to backfill people pictures: ', err);
    process.exitCode = 1;
  })
  .finally(() => db.pool.end());
