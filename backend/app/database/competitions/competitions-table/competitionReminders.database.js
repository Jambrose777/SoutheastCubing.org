const db = require('../../pool.js');
const logger = require('../../../utils/logger.util.js');
const { fromRow } = require('../../../helpers/competitions/competitionRows.helper.js');

// Returns every announced competition still pending a Discord announcement.
async function getCompetitionsPendingDiscordAnnouncement() {
  try {
    const { rows } = await db.pool.query(
      'SELECT * FROM competitions WHERE announced_on_discord_at IS NULL AND is_announced IS TRUE',
    );
    return rows.map((row) => fromRow(row, []));
  } catch (error) {
    logger.error(
      'Failed to fetch competitions pending Discord announcement from the competitions table: ',
      error,
    );
    throw error;
  }
}

// Returns linked, unannounced competitions on `startDate` with their assigned Delegates' account emails.
async function getUnannouncedDeadlineReminderCandidates(startDate) {
  try {
    const { rows } = await db.pool.query(
      `SELECT c.id AS competition_id, c.name AS competition_name, c.start_date,
              p.id AS people_id, p.name AS delegate_name, u.email AS delegate_email
       FROM competitions c
       LEFT JOIN competition_delegates cd ON cd.competition_id = c.id
       LEFT JOIN people p ON p.id = cd.people_id
       LEFT JOIN users u ON u.people_id = p.id
       WHERE c.start_date = $1
         AND c.wca_competition_id IS NOT NULL
         AND c.is_announced IS NOT TRUE
       ORDER BY c.id, p.name`,
      [startDate],
    );
    return rows;
  } catch (error) {
    logger.error('Failed to fetch WCA deadline reminder candidates from the competitions table: ', error);
    throw error;
  }
}

// Marks reminder rows as sent only after their Discord posts have succeeded.
async function markEquipmentRemindersSent(ids) {
  if (!ids.length) return [];
  try {
    const { rows } = await db.withRetry(async (client) =>
      client.query(
        `UPDATE competitions
         SET equipment_reminder_sent_at = now()
         WHERE id = ANY($1) AND equipment_reminder_sent_at IS NULL
         RETURNING id`,
        [ids],
      ),
    );
    logger.debug(`Marked ${rows.length} equipment reminder(s) sent in the competitions table.`);
    return rows.map((row) => row.id);
  } catch (error) {
    logger.error('Failed to mark equipment reminders sent in the competitions table: ', error);
    throw error;
  }
}

// Finds announced, unsent competitions on or after `today` with a holder assigned.
async function getEquipmentReminderCandidates(today) {
  try {
    const { rows } = await db.pool.query(
      `SELECT c.id, c.name, c.city, c.start_date, c.end_date, c.full_date
       FROM competitions c
       WHERE c.is_announced IS TRUE
         AND c.is_cancelled IS FALSE
         AND c.equipment_reminder_sent_at IS NULL
         AND c.start_date >= $1
         AND EXISTS (
           SELECT 1 FROM competition_equipment_holders ceh
           WHERE ceh.competition_id = c.id
         )
       ORDER BY c.start_date ASC, c.name ASC`,
      [today],
    );
    return rows;
  } catch (error) {
    logger.error(
      'Failed to fetch equipment reminder candidates from the competitions table: ',
      error,
    );
    throw error;
  }
}

module.exports = {
  getCompetitionsPendingDiscordAnnouncement,
  getUnannouncedDeadlineReminderCandidates,
  markEquipmentRemindersSent,
  getEquipmentReminderCandidates,
};