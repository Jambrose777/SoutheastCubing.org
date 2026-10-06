const crypto = require('crypto');
const db = require('./pool.js');

const logger = require('../utils/logger.util.js');

// Every competition_organizers row for the given competition ids, joined with
// each person's display fields - alphabetical by name.
async function listForCompetitions(competitionIds) {
  if (!competitionIds.length) return [];
  const { rows } = await db.pool.query(
    `SELECT co.competition_id, p.id AS people_id, p.name, p.wca_id, p.picture_url,
            p.has_managed_photo, p.thumbnail_crop_x, p.thumbnail_crop_y, p.thumbnail_crop_w,
            p.thumbnail_crop_h
     FROM competition_organizers co
     JOIN people p ON p.id = co.people_id
     WHERE co.competition_id = ANY($1)
     ORDER BY p.name`,
    [competitionIds],
  );
  return rows;
}

// True if `peopleId` already has a competition_organizers row for `competitionId`.
async function isOrganizerOnCompetition(peopleId, competitionId) {
  const { rows } = await db.pool.query(
    'SELECT 1 FROM competition_organizers WHERE people_id = $1 AND competition_id = $2 LIMIT 1',
    [peopleId, competitionId],
  );
  return rows.length > 0;
}

// Replaces every competition_organizers row for `competitionId` with
// `peopleIds` in one transaction - skipped entirely if the incoming set 
// is identical to what's already stored.
async function replaceOrganizersForCompetition(competitionId, peopleIds) {
  return db.withRetry(async (client) => {
    const { rows: existingRows } = await client.query(
      'SELECT people_id FROM competition_organizers WHERE competition_id = $1',
      [competitionId],
    );

    // Compare as sorted arrays - order isn't meaningful, only an actual
    // membership difference needs a write.
    const incoming = [...peopleIds].sort();
    const existing = existingRows.map((row) => row.people_id).sort();
    if (
      incoming.length === existing.length &&
      incoming.every((peopleId, i) => peopleId === existing[i])
    ) {
      return;
    }

    // Delete existing.
    await client.query('DELETE FROM competition_organizers WHERE competition_id = $1', [
      competitionId,
    ]);

    if (peopleIds.length) {
      const valueGroups = [];
      const params = [];
      peopleIds.forEach((peopleId, i) => {
        const base = i * 3;
        valueGroups.push(`($${base + 1}, $${base + 2}, $${base + 3})`);
        params.push(crypto.randomUUID(), competitionId, peopleId);
      });
      await client.query(
        `INSERT INTO competition_organizers (id, competition_id, people_id)
         VALUES ${valueGroups.join(', ')}`,
        params,
      );
    }

    logger.debug(
      `Replaced competition_organizers for competition_id ${competitionId} (${peopleIds.length} row(s)).`,
    );
  });
}

module.exports = { listForCompetitions, isOrganizerOnCompetition, replaceOrganizersForCompetition };
