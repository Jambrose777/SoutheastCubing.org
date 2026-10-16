const moment = require('moment');
const db = require('../../pool.js');
const logger = require('../../../utils/logger.util.js');
const { fromRow } = require('../../../helpers/competitions/competitionRows.helper.js');

// Finds the Drive folder already associated with a multi-city WCA competition.
async function getWcaDriveLinkByWcaCompetitionId(wcaCompetitionId) {
  try {
    const { rows } = await db.pool.query(
      `SELECT wca_drive_link, wca_drive_folder_type
       FROM competitions
       WHERE wca_competition_id = $1
         AND is_multiple_cities_competition IS TRUE
         AND wca_drive_link IS NOT NULL
       ORDER BY id
       LIMIT 1`,
      [String(wcaCompetitionId)],
    );
    return rows[0] ?? null;
  } catch (error) {
    logger.error(
      `Failed to fetch the WCA Drive folder link for WCA competition ${wcaCompetitionId}:`,
      error,
    );
    throw error;
  }
}

// Lists every competition with a Drive folder, including past competitions up to 14 days ago.
async function getCompetitionsWithWcaDriveLink() {
  try {
    const cutoffDate = moment.utc().subtract(14, 'days').format('YYYY-MM-DD');
    const { rows } = await db.pool.query(
      'SELECT * FROM competitions WHERE wca_drive_link IS NOT NULL AND end_date >= $1',
      [cutoffDate],
    );
    return rows.map((row) => fromRow(row, []));
  } catch (error) {
    logger.error(
      'Failed to fetch competitions with WCA Drive folders from the competitions table:',
      error,
    );
    throw error;
  }
}

// Sets or clears a competition's Drive folder URL and synchronized category.
async function setWcaDriveLink(id, folderLink, folderType = null) {
  try {
    const { rows } = await db.withRetry(async (client) =>
      client.query(
        'UPDATE competitions SET wca_drive_link = $1, wca_drive_folder_type = $2 WHERE id = $3 RETURNING id',
        [folderLink ?? null, folderLink ? folderType : null, id],
      ),
    );
    if (rows.length) {
      logger.debug(
        `Updated the WCA Drive folder link for competition ${id} in the competitions table.`,
      );
    }
    return rows.length > 0;
  } catch (error) {
    logger.error(`Failed to update the WCA Drive folder link for competition ${id}:`, error);
    throw error;
  }
}

module.exports = {
  getWcaDriveLinkByWcaCompetitionId,
  getCompetitionsWithWcaDriveLink,
  setWcaDriveLink,
};