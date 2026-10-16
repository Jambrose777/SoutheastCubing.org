const crypto = require('crypto');
const db = require('../pool.js');

const logger = require('../../utils/logger.util.js');

// Every competition_delegates row for the given competition ids, joined with
// each person's display fields - lead Delegate first, then alphabetical.
async function listForCompetitions(competitionIds) {
  if (!competitionIds.length) return [];
  const { rows } = await db.pool.query(
    `SELECT cd.competition_id, cd.is_lead, p.id AS people_id, p.name, p.wca_id, p.picture_url,
            p.has_managed_photo, p.thumbnail_crop_x, p.thumbnail_crop_y, p.thumbnail_crop_w,
            p.thumbnail_crop_h
     FROM competition_delegates cd
     JOIN people p ON p.id = cd.people_id
     WHERE cd.competition_id = ANY($1)
     ORDER BY cd.is_lead DESC, p.name`,
    [competitionIds],
  );
  return rows;
}

// Replaces every competition_delegates row for `competitionId` with
// `delegates` (`[{ peopleId, isLead }]`) in one transaction - skipped
// entirely if the incoming set is identical to what's already stored.
async function replaceDelegatesForCompetition(competitionId, delegates) {
  return db.withRetry(async (client) => {
    const { rows: existingRows } = await client.query(
      'SELECT people_id, is_lead FROM competition_delegates WHERE competition_id = $1',
      [competitionId],
    );

    // Compare as sorted "peopleId:isLead" pairs - order isn't meaningful,
    // only an actual difference in membership/lead status needs a write.
    const toKey = (peopleId, isLead) => `${peopleId}:${!!isLead}`;
    const incoming = delegates.map((d) => toKey(d.peopleId, d.isLead)).sort();
    const existing = existingRows.map((row) => toKey(row.people_id, row.is_lead)).sort();
    if (
      incoming.length === existing.length &&
      incoming.every((key, i) => key === existing[i])
    ) {
      return;
    }

    // Deletee existing.
    await client.query('DELETE FROM competition_delegates WHERE competition_id = $1', [
      competitionId,
    ]);

    if (delegates.length) {
      const valueGroups = [];
      const params = [];
      delegates.forEach((delegate, i) => {
        const base = i * 4;
        valueGroups.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`);
        params.push(crypto.randomUUID(), competitionId, delegate.peopleId, !!delegate.isLead);
      });
      await client.query(
        `INSERT INTO competition_delegates (id, competition_id, people_id, is_lead)
         VALUES ${valueGroups.join(', ')}`,
        params,
      );
    }

    logger.debug(
      `Replaced competition_delegates for competition_id ${competitionId} (${delegates.length} row(s)).`,
    );
  });
}

// True if `peopleId` already has a competition_delegates row for `competitionId`.
async function isDelegateOnCompetition(peopleId, competitionId) {
  const { rows } = await db.pool.query(
    'SELECT 1 FROM competition_delegates WHERE people_id = $1 AND competition_id = $2 LIMIT 1',
    [peopleId, competitionId],
  );
  return rows.length > 0;
}

// Flags exactly one existing competition_delegates row as lead - used once a
// competition is linked. The unconditional WHERE competition_id (no
// people_id filter) means every row for this competition is touched in one
// statement, clearing the old lead at the same time the new one is set.
async function setLead(competitionId, peopleId) {
  await db.withRetry(async (client) => {
    await client.query(
      'UPDATE competition_delegates SET is_lead = (people_id = $2) WHERE competition_id = $1',
      [competitionId, peopleId],
    );
  });
  logger.debug(`Set lead Delegate for competition_id ${competitionId} to people_id ${peopleId}.`);
}

module.exports = {
  listForCompetitions,
  replaceDelegatesForCompetition,
  isDelegateOnCompetition,
  setLead,
};
