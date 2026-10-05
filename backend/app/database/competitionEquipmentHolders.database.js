const crypto = require('crypto');
const db = require('./pool.js');

const logger = require('../utils/logger.util.js');

// Every competition_equipment_holders row for the given competition ids,
// joined with each person's display fields.
async function listForCompetitions(competitionIds) {
  if (!competitionIds.length) return [];
  const { rows } = await db.pool.query(
    `SELECT ceh.competition_id, ceh.people_id, p.name, p.wca_id, p.picture_url,
            p.has_managed_photo, p.thumbnail_crop_x, p.thumbnail_crop_y, p.thumbnail_crop_w,
            p.thumbnail_crop_h
     FROM competition_equipment_holders ceh
     LEFT JOIN people p ON p.id = ceh.people_id
     WHERE ceh.competition_id = ANY($1)`,
    [competitionIds],
  );
  return rows;
}

// Replaces every competition_equipment_holders row for `competitionId` with
// `peopleIds` (a `null` entry represents "Other") in one transaction -
// skipped entirely if the incoming set is identical to what's already
// stored.
async function replaceEquipmentHoldersForCompetition(competitionId, peopleIds) {
  return db.withRetry(async (client) => {
    const { rows: existingRows } = await client.query(
      'SELECT people_id FROM competition_equipment_holders WHERE competition_id = $1',
      [competitionId],
    );

    // Compare as sorted arrays.
    const sortNullsFirst = (a, b) => (a ?? '').localeCompare(b ?? '');
    const incoming = [...peopleIds].sort(sortNullsFirst);
    const existing = existingRows.map((row) => row.people_id).sort(sortNullsFirst);
    if (
      incoming.length === existing.length &&
      incoming.every((peopleId, i) => peopleId === existing[i])
    ) {
      return;
    }

    // delete all equipment holders for competition.
    await client.query('DELETE FROM competition_equipment_holders WHERE competition_id = $1', [
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
        `INSERT INTO competition_equipment_holders (id, competition_id, people_id)
         VALUES ${valueGroups.join(', ')}`,
        params,
      );
    }

    logger.debug(
      `Replaced competition_equipment_holders for competition_id ${competitionId} (${peopleIds.length} row(s)).`,
    );
  });
}

module.exports = { listForCompetitions, replaceEquipmentHoldersForCompetition };
