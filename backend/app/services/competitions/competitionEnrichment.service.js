const competitionEventsDb = require('../../database/competitions/competitionEvents.database.js');
const competitionUnofficialEventsDb = require('../../database/competitions/competitionUnofficialEvents.database.js');

// Merges official ids and saved unofficial events into each competition.
async function withCompetitionEvents(comps) {
  const competitionIds = comps.map((comp) => comp.id);
  const [eventIdsByCompetition, unofficialEventsByCompetition] = await Promise.all([
    competitionEventsDb.getEventIdsByCompetition(competitionIds),
    competitionUnofficialEventsDb.getUnofficialEventsByCompetition(competitionIds),
  ]);
  return comps.map((comp) => ({
    ...comp,
    event_ids: eventIdsByCompetition.get(comp.id) ?? [],
    unofficial_events: unofficialEventsByCompetition.get(comp.id) ?? [],
  }));
}

module.exports = { withCompetitionEvents };