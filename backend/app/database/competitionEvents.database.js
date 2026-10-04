const { chunk } = require('../helpers/chunk.helper.js');
const { groupBy } = require('../helpers/groupBy.helper.js');
const db = require('./pool.js');

// Competitions typically carry at most ~20 WCA event ids each. Chunking
// competition ids into groups of this size keeps queries under DSQL's row cap.
const EVENT_ID_CHUNK_SIZE = 100;

// Fetches event ids for the given competition ids, grouped by competition.
async function getEventIdsByCompetition(competitionIds, queryable = db.pool) {
  if (!competitionIds.length) return new Map();

  const { rows } = await queryable.query(
    'SELECT competition_id, event_id FROM competition_events WHERE competition_id = ANY($1)',
    [competitionIds],
  );
  const rowsByCompetition = groupBy(rows, 'competition_id');
  return new Map(
    [...rowsByCompetition].map(([competitionId, groupRows]) => [
      competitionId,
      groupRows.map((row) => row.event_id),
    ]),
  );
}

// Replaces the competition_events rows for competitions whose incoming
// event_ids actually differ from what's stored, skipping the rest.
async function replaceEventIds(comps) {
  for (const eventBatch of chunk(comps, EVENT_ID_CHUNK_SIZE)) {
    await db.withRetry(async (client) => {
      const competitionIds = eventBatch.map((comp) => comp.id);
      const existingEventIdsByCompetition = await getEventIdsByCompetition(
        competitionIds,
        client,
      );

      // Compare as sorted arrays - only competitions with an actual 
      // difference need their rows replaced.
      const changedComps = eventBatch.filter((comp) => {
        const incoming = [...(comp.event_ids ?? [])].sort();
        const existing = [...(existingEventIdsByCompetition.get(comp.id) ?? [])].sort();
        return (
          incoming.length !== existing.length || incoming.some((id, i) => id !== existing[i])
        );
      });
      if (!changedComps.length) return;

      const changedIds = changedComps.map((comp) => comp.id);
      await client.query('DELETE FROM competition_events WHERE competition_id = ANY($1)', [
        changedIds,
      ]);

      const valueGroups = [];
      const params = [];
      let paramIdx = 1;
      changedComps.forEach((comp) => {
        (comp.event_ids ?? []).forEach((eventId) => {
          valueGroups.push(`($${paramIdx}, $${paramIdx + 1})`);
          params.push(comp.id, eventId);
          paramIdx += 2;
        });
      });

      if (valueGroups.length) {
        await client.query(
          `INSERT INTO competition_events (competition_id, event_id) VALUES ${valueGroups.join(', ')}`,
          params,
        );
      }
    });
  }
}

module.exports = { getEventIdsByCompetition, replaceEventIds };
