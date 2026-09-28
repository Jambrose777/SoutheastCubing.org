#!/usr/bin/env node

// One-off (re-runnable) script: copies every current Delegate's real bio,
// already written and stored today in the Contentful "Delegates" content
// type's `description` field, into `delegates.bio`.
//
// Only ever fills a still-blank `delegates.bio` - never overwrites one
// that's already set, so re-running this after someone has since edited
// their bio (via My Info or, later, Manage Users) can't stomp a real edit
// with stale Contentful text.
//
// Run via `pnpm --filter southeastcubing-org-api run backfill-delegate-bios`.

const db = require('../app/database/pool.js');
const delegatesDb = require('../app/database/delegates.database.js');
const contentful = require('../app/integrations/contentful.integration.js');
const logger = require('../app/utils/logger.util.js');

async function main() {
  if (!contentful.isConfigured()) {
    throw new Error(
      'CONTENTFUL_SPACE/CONTENTFUL_ACCESS_TOKEN not set - Contentful is not configured.',
    );
  }
  const entries = await contentful
    .getClient()
    .getEntries(Object.assign({ content_type: 'delegates' }));

  let succeeded = 0;
  let skippedAlreadySet = 0;
  let skippedNoBio = 0;
  let skippedNoMatch = 0;

  for (const entry of entries.items) {
    const wcaId = entry.fields.wcaid;
    const bio = entry.fields.description;
    const name = entry.fields.name ?? '(unnamed entry)';

    if (!wcaId) {
      logger.warn(
        `Skipping Contentful Delegate entry "${name}" (sys id ${entry.sys.id}) - no wcaid set.`,
      );
      skippedNoMatch += 1;
      continue;
    }
    if (!bio) {
      logger.debug(`Skipping ${name} (wca_id ${wcaId}) - Contentful entry has no description.`);
      skippedNoBio += 1;
      continue;
    }

    const delegate = await delegatesDb.findDelegateByWcaId(wcaId);
    if (!delegate) {
      logger.warn(
        `Skipping ${name} (wca_id ${wcaId}) - no matching delegates row (not tracked by the nightly WCA sync yet?).`,
      );
      skippedNoMatch += 1;
      continue;
    }

    if (delegate.bio) {
      logger.debug(`Skipping ${name} (wca_id ${wcaId}) - delegates.bio is already set.`);
      skippedAlreadySet += 1;
      continue;
    }

    await delegatesDb.updateBio(delegate.id, bio);
    logger.info(`Backfilled bio for ${name} (wca_id ${wcaId}).`);
    succeeded += 1;
  }

  logger.info(
    `Done - ${succeeded} backfilled, ${skippedAlreadySet} already had a bio, ` +
      `${skippedNoBio} had no Contentful description, ${skippedNoMatch} had no matching delegates row.`,
  );
}

main()
  .catch((err) => {
    logger.error('Failed to backfill Delegate bios from Contentful: ', err);
    process.exitCode = 1;
  })
  .finally(() => db.pool.end());
