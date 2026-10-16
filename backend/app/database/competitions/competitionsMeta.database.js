const moment = require('moment');
const db = require('../pool.js');
const logger = require('../../utils/logger.util.js');

// Treat older refresh claims as abandoned so a crashed process cannot block future refreshes.
const BULK_REFRESH_LOCK_TIMEOUT_MINUTES = 10;

// Reads when competitions were last refreshed from WCA.
async function getLastBulkRefreshAt() {
  try {
    const { rows } = await db.pool.query(
      'SELECT last_bulk_refresh_at FROM competitions_meta WHERE id = 1',
    );
    return rows[0]?.last_bulk_refresh_at ? moment(rows[0].last_bulk_refresh_at) : null;
  } catch (err) {
    logger.error('Failed to fetch last_bulk_refresh_at from the competitions_meta table: ', err);
    throw err;
  }
}

// Reads the last successful full refresh and whether one is running.
async function getBulkRefreshState() {
  try {
    const { rows } = await db.pool.query(
      'SELECT last_bulk_refresh_at, bulk_refresh_started_at FROM competitions_meta WHERE id = 1',
    );
    const row = rows[0];
    const lockCutoff = moment().subtract(BULK_REFRESH_LOCK_TIMEOUT_MINUTES, 'minutes');
    const refreshStartedAt = row?.bulk_refresh_started_at;
    return {
      lastBulkRefreshAt: row?.last_bulk_refresh_at ?? null,
      isRunning: !!refreshStartedAt && moment(refreshStartedAt).isAfter(lockCutoff),
    };
  } catch (err) {
    logger.error('Failed to fetch bulk refresh state from the competitions_meta table: ', err);
    throw err;
  }
}

// Claims the global bulk refresh slot unless another refresh is running or the cooldown is active.
async function tryStartBulkRefresh(cooldownCutoff) {
  try {
    return await db.withRetry(async (client) => {
      const staleLockCutoff = moment()
        .subtract(BULK_REFRESH_LOCK_TIMEOUT_MINUTES, 'minutes')
        .toDate();
      const { rows: claimedRows } = await client.query(
        `UPDATE competitions_meta
         SET bulk_refresh_started_at = date_trunc('milliseconds', now())
         WHERE id = 1
           AND (bulk_refresh_started_at IS NULL OR bulk_refresh_started_at <= $2)
           AND (last_bulk_refresh_at IS NULL OR last_bulk_refresh_at <= $1)
         RETURNING last_bulk_refresh_at, bulk_refresh_started_at`,
        [cooldownCutoff, staleLockCutoff],
      );
      if (claimedRows.length) {
        return {
          started: true,
          lastBulkRefreshAt: claimedRows[0].last_bulk_refresh_at ?? null,
          bulkRefreshStartedAt: claimedRows[0].bulk_refresh_started_at,
          isRunning: true,
        };
      }

      const { rows } = await client.query(
        'SELECT last_bulk_refresh_at, bulk_refresh_started_at FROM competitions_meta WHERE id = 1',
      );
      const refreshStartedAt = rows[0]?.bulk_refresh_started_at;
      return {
        started: false,
        lastBulkRefreshAt: rows[0]?.last_bulk_refresh_at ?? null,
        bulkRefreshStartedAt: refreshStartedAt ?? null,
        isRunning:
          !!refreshStartedAt &&
          moment(refreshStartedAt).isAfter(
            moment().subtract(BULK_REFRESH_LOCK_TIMEOUT_MINUTES, 'minutes'),
          ),
      };
    });
  } catch (err) {
    logger.error('Failed to claim the bulk refresh slot in the competitions_meta table: ', err);
    throw err;
  }
}

// Records a successful full refresh and releases its global slot.
async function completeBulkRefresh(checkedAt, bulkRefreshStartedAt) {
  try {
    await db.withRetry(async (client) => {
      const { rows } = await client.query(
        `UPDATE competitions_meta
         SET last_bulk_refresh_at = $1, bulk_refresh_started_at = NULL
         WHERE id = 1 AND bulk_refresh_started_at = $2
         RETURNING id`,
        [checkedAt.toDate(), bulkRefreshStartedAt],
      );
      if (!rows.length) {
        throw new Error('Bulk refresh lock expired or was claimed by another refresh.');
      }
    });
    logger.debug(`Recorded successful full refresh at ${checkedAt.toISOString()}.`);
  } catch (err) {
    logger.error('Failed to record the full refresh in the competitions_meta table: ', err);
    throw err;
  }
}

// Releases the global slot after a failed refresh without advancing the last-successful timestamp.
async function releaseBulkRefresh(bulkRefreshStartedAt) {
  try {
    await db.withRetry(async (client) => {
      await client.query(
        `UPDATE competitions_meta
         SET bulk_refresh_started_at = NULL
         WHERE id = 1 AND bulk_refresh_started_at = $1`,
        [bulkRefreshStartedAt],
      );
    });
    logger.debug('Released the full refresh slot in the competitions_meta table.');
  } catch (err) {
    logger.error('Failed to release the bulk refresh slot in the competitions_meta table: ', err);
    throw err;
  }
}

module.exports = {
  getLastBulkRefreshAt,
  getBulkRefreshState,
  tryStartBulkRefresh,
  completeBulkRefresh,
  releaseBulkRefresh,
};