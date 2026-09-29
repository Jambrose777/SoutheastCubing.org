const peopleDb = require('../database/people.database.js');
const wcaIntegration = require('../integrations/wca.integration.js');
const photosService = require('./photos.service.js');
const { httpError } = require('../helpers/httpError.helper.js');
const { withResolvedPicture } = require('../helpers/personPicture.helper.js');

// Matches WCA's own WCA ID format (e.g. 2010AMBR01).
const WCA_ID_FORMAT = /^\d{4}[A-Z]{4}\d{2}$/;

// Resolves `person` (either an existing `{ peopleId }` selection or a
// `{ wcaId }` "add by WCA ID" fallback) down to a concrete `people.id`. The
// wcaId branch re-fetches name/picture from WCA itself rather than trusting
// client-supplied values, so a caller can't persist a name/picture that
// doesn't actually match that WCA ID.
async function resolvePeopleId(person, promoteManagedPhoto = false) {
  let peopleId;
  if (person.peopleId) {
    const existing = await peopleDb.findPersonById(person.peopleId);
    if (!existing) throw httpError(404, 'Person not found.');
    peopleId = existing.id;
  } else if (person.wcaId) {
    if (!WCA_ID_FORMAT.test(person.wcaId)) {
      throw httpError(400, 'Invalid WCA ID format.');
    }
    const wcaPerson = await wcaIntegration.fetchPersonByWcaId(person.wcaId);
    if (!wcaPerson) throw httpError(404, 'WCA ID not found.');
    const upserted = await peopleDb.upsertPersonFromWcaIdLookup({
      wcaId: person.wcaId,
      name: wcaPerson.name,
      pictureUrl: wcaPerson.avatar?.thumb_url ?? null,
    });
    peopleId = upserted.id;
  } else {
    throw httpError(400, 'Must provide either peopleId or wcaId.');
  }

  if (promoteManagedPhoto) {
    await photosService.promoteToManagedPhoto(peopleId);
  }
  return peopleId;
}

// Backs the Add/Edit Member sheet's search-as-you-type combobox - our own
// `people`/`users` data only.
async function searchPeople(searchTerm) {
  if (!searchTerm || !searchTerm.trim()) return [];
  const results = await peopleDb.searchPeople(searchTerm.trim());
  return results.map(withResolvedPicture);
}

// Proxies WCA's public GET /api/v0/persons/:wca_id lookup - the "add by WCA
// ID" fallback for someone not already in `people`. Returns null on a 404
// (a validly-formatted but unknown WCA ID).
async function lookupWcaId(wcaId) {
  if (!WCA_ID_FORMAT.test(wcaId)) {
    throw httpError(400, 'Invalid WCA ID format.');
  }
  const person = await wcaIntegration.fetchPersonByWcaId(wcaId);
  if (!person) return null;
  return {
    wcaId,
    name: person.name,
    pictureUrl: person.avatar?.thumb_url ?? null,
  };
}

module.exports = { WCA_ID_FORMAT, resolvePeopleId, searchPeople, lookupWcaId };
