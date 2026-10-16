const crypto = require('crypto');
const { groupBy } = require('../../helpers/groupBy.helper.js');
const db = require('../pool.js');

const logger = require('../../utils/logger.util.js');

// Fetches unofficial events grouped by competition, alphabetically by saved name.
async function getUnofficialEventsByCompetition(competitionIds) {
  if (!competitionIds.length) return new Map();

  try {
    const { rows } = await db.pool.query(
      `SELECT competition_id, event_name, icon
       FROM competition_unofficial_events
       WHERE competition_id = ANY($1)
       ORDER BY event_name`,
      [competitionIds],
    );
    const rowsByCompetition = groupBy(rows, 'competition_id');
    return new Map(
      [...rowsByCompetition].map(([competitionId, groupRows]) => [
        competitionId,
        groupRows.map(({ event_name, icon }) => ({ event_name, icon })),
      ]),
    );
  } catch (error) {
    logger.error('Failed to retrieve unofficial events from the competition_unofficial_events table.', error);
    throw error;
  }
}

// Replaces one competition's unofficial events while preserving duplicate icons.
async function replaceUnofficialEventsForCompetition(competitionId, events = []) {
  try {
    const changed = await db.withRetry(async (client) => {
      const { rows: existingRows } = await client.query(
        `SELECT event_name, icon
         FROM competition_unofficial_events
         WHERE competition_id = $1`,
        [competitionId],
      );

      const compareEvents = (left, right) =>
        left.eventName.localeCompare(right.eventName) || left.icon.localeCompare(right.icon);
      const incoming = [...events].sort(compareEvents);
      const existing = existingRows
        .map((row) => ({ eventName: row.event_name, icon: row.icon }))
        .sort(compareEvents);
      if (
        incoming.length === existing.length &&
        incoming.every(
          (event, index) =>
            event.eventName === existing[index].eventName && event.icon === existing[index].icon,
        )
      ) {
        return false;
      }

      await client.query(
        'DELETE FROM competition_unofficial_events WHERE competition_id = $1',
        [competitionId],
      );

      if (events.length) {
        const valueGroups = [];
        const params = [];
        events.forEach((event, index) => {
          const base = index * 4;
          valueGroups.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`);
          params.push(crypto.randomUUID(), competitionId, event.eventName, event.icon);
        });
        await client.query(
          `INSERT INTO competition_unofficial_events (id, competition_id, event_name, icon)
           VALUES ${valueGroups.join(', ')}`,
          params,
        );
      }
      return true;
    });

    logger.debug(
      `Replaced unofficial events for competition_id ${competitionId} (${events.length} row(s)).`,
    );
    return changed;
  } catch (error) {
    logger.error(
      `Failed to replace unofficial events for competition_id ${competitionId}.`,
      error,
    );
    throw error;
  }
}

module.exports = { getUnofficialEventsByCompetition, replaceUnofficialEventsForCompetition };