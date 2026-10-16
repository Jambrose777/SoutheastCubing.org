const crypto = require('crypto');
const db = require('../pool.js');

const logger = require('../../utils/logger.util.js');

// Lists the WCA competition ids a Delegate has permanently dismissed.
async function listDismissedWcaCompetitionIds(peopleId) {
  try {
    const { rows } = await db.pool.query(
      'SELECT wca_competition_id FROM competition_banner_dismissals WHERE people_id = $1',
      [peopleId],
    );
    return rows.map((row) => row.wca_competition_id);
  } catch (error) {
    logger.error(
      `Failed to list competition_banner_dismissals for people_id ${peopleId}: `,
      error,
    );
    throw error;
  }
}

// Permanently dismisses a WCA competition for one Delegate; duplicate requests are harmless.
async function createDismissal(peopleId, wcaCompetitionId) {
  try {
    await db.withRetry(async (client) => {
      const id = crypto.randomUUID();
      await client.query(
        `INSERT INTO competition_banner_dismissals (id, people_id, wca_competition_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (people_id, wca_competition_id) DO NOTHING`,
        [id, peopleId, wcaCompetitionId],
      );
    });
    logger.debug(
      `Inserted competition_banner_dismissals row for people_id ${peopleId}, WCA competition ${wcaCompetitionId}.`,
    );
  } catch (error) {
    logger.error(
      `Failed to persist competition_banner_dismissals row for people_id ${peopleId}, WCA competition ${wcaCompetitionId}: `,
      error,
    );
    throw error;
  }
}

module.exports = { listDismissedWcaCompetitionIds, createDismissal };