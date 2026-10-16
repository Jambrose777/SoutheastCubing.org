const crypto = require('crypto');
const db = require('../pool.js');

const logger = require('../../utils/logger.util.js');

// Every equipment-holder assignment for the given competition ids, including
// each person's display fields and assignment-specific details.
async function listForCompetitions(competitionIds) {
  if (!competitionIds.length) return [];
  try {
    const { rows } = await db.pool.query(
      `SELECT ceh.competition_id, ceh.people_id, ceh.equipment_details,
              p.name, p.wca_id, p.picture_url, d.discord_user_id,
              p.has_managed_photo, p.thumbnail_crop_x, p.thumbnail_crop_y, p.thumbnail_crop_w,
              p.thumbnail_crop_h
       FROM competition_equipment_holders ceh
       LEFT JOIN people p ON p.id = ceh.people_id
       LEFT JOIN delegates d ON d.people_id = ceh.people_id
       WHERE ceh.competition_id = ANY($1)`,
      [competitionIds],
    );
    return rows;
  } catch (error) {
    logger.error(
      'Failed to fetch equipment-holder assignments from the competition_equipment_holders table: ',
      error,
    );
    throw error;
  }
}

// Replaces every equipment-holder assignment for a competition; null
// `peopleId` represents the generic "Other" holder.
async function replaceEquipmentHoldersForCompetition(competitionId, holders) {
  return db.withRetry(async (client) => {
    const { rows: existingRows } = await client.query(
      'SELECT people_id, equipment_details FROM competition_equipment_holders WHERE competition_id = $1',
      [competitionId],
    );

    // Compare as sorted arrays.
    const sortNullsFirst = (a, b) => (a ?? '').localeCompare(b ?? '');
    const incoming = holders
      .map((holder) => ({
        peopleId: holder.peopleId,
        equipmentDetails: holder.equipmentDetails,
      }))
      .sort((a, b) => sortNullsFirst(a.peopleId, b.peopleId));
    const existing = existingRows
      .map((row) => ({ peopleId: row.people_id, equipmentDetails: row.equipment_details }))
      .sort((a, b) => sortNullsFirst(a.peopleId, b.peopleId));
    if (
      incoming.length === existing.length &&
      incoming.every(
        (holder, i) =>
          holder.peopleId === existing[i].peopleId &&
          holder.equipmentDetails === existing[i].equipmentDetails,
      )
    ) {
      return;
    }

    // delete all equipment holders for competition.
    await client.query('DELETE FROM competition_equipment_holders WHERE competition_id = $1', [
      competitionId,
    ]);

    if (incoming.length) {
      const valueGroups = [];
      const params = [];
      incoming.forEach((holder, i) => {
        const base = i * 4;
        valueGroups.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`);
        params.push(crypto.randomUUID(), competitionId, holder.peopleId, holder.equipmentDetails);
      });
      await client.query(
        `INSERT INTO competition_equipment_holders
           (id, competition_id, people_id, equipment_details)
         VALUES ${valueGroups.join(', ')}`,
        params,
      );
    }

    logger.debug(
      `Replaced competition_equipment_holders for competition_id ${competitionId} (${incoming.length} row(s)).`,
    );
  });
}

module.exports = { listForCompetitions, replaceEquipmentHoldersForCompetition };
