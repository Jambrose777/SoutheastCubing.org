#!/usr/bin/env node

// One-off (re-runnable) script: mirrors a managed photo into local storage
// for every `people` row with no `picture_url` yet - the gap left by the 
// migrations, which only ever sets the flag via SQL and never makes an 
// outbound HTTP call to WCA.
//
// Run via `pnpm --filter southeastcubing-org-api run backfill-people-pictures`.

const db = require('../app/database/pool.js');
const peopleDb = require('../app/database/people.database.js');
const photosService = require('../app/services/photos.service.js');
const logger = require('../app/utils/logger.util.js');

async function main() {
  const { rows } = await db.pool.query(
    `SELECT id, wca_id, name, picture_url
     FROM people
     WHERE has_managed_photo = true
       AND wca_id IS NOT NULL
       AND picture_url IS NULL`,
  );

  logger.info(
    `Found ${rows.length} managed-photo people row(s) with no stored photo yet.`,
  );

  let succeeded = 0;
  let skipped = 0;
  let failed = 0;

  for (const person of rows) {
    try {
      const avatarUrl = await photosService.resolveCurrentWcaAvatarUrl(person.wca_id);
      if (!avatarUrl) {
        logger.warn(
          `No WCA avatar found for wca_id ${person.wca_id} (${person.name}) - skipping.`,
        );
        skipped += 1;
        continue;
      }

      const { key, crop } = await photosService.mirrorWcaAvatar(person.id, avatarUrl);
      await peopleDb.setManagedPhoto(person.id, {
        pictureKey: key,
        wcaPictureSourceUrl: avatarUrl,
        pictureSyncedWithWca: true,
        ...crop,
      });
      logger.info(`Backfilled managed photo for ${person.name} (wca_id ${person.wca_id}).`);
      succeeded += 1;
    } catch (err) {
      logger.error(
        `Failed to backfill managed photo for wca_id ${person.wca_id} (${person.name}): `,
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
