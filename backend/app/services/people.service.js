const peopleDb = require('../database/people.database.js');
const delegatesDb = require('../database/delegates.database.js');
const teamMembershipsDb = require('../database/teamMemberships.database.js');
const wcaIntegration = require('../integrations/wca.integration.js');
const photosService = require('./photos.service.js');
const { httpError } = require('../helpers/httpError.helper.js');
const { withResolvedPicture, resolvePersonPicture } = require('../helpers/personPicture.helper.js');
const { highestDisplayRank } = require('../helpers/delegateRanks.helper.js');
const { groupBy } = require('../helpers/groupBy.helper.js');

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

// Assembles one Manage Users row from a raw joined `people`/ `users`/`delegates`
// row plus this person's own open ranks/state Delegate stint and active team memberships.
function buildUserRow(person, { openRanksByPeopleId, openStateByPeopleId, teamsByPeopleId }) {
  const hasDelegateHistory = !!person.delegate_id;
  const openRanks = openRanksByPeopleId.get(person.id) ?? [];
  // A delegate row with no currently-open rank is a "Former Delegate".
  const delegateRank = hasDelegateHistory ? highestDisplayRank(openRanks) : null;
  const delegateState = openStateByPeopleId.get(person.id) ?? null;

  const updatedAt = [person.people_updated_at, person.users_updated_at, person.delegate_updated_at]
    .filter((date) => date != null)
    .reduce((latest, date) => (latest == null || date > latest ? date : latest), null);

  return {
    peopleId: person.id,
    seciId: person.id,
    wcaId: person.wca_id,
    wcaUserId: person.wca_user_id,
    name: person.name,
    ...resolvePersonPicture(person),
    hasManagedPhoto: person.has_managed_photo,
    pictureSyncedWithWca: person.picture_synced_with_wca,
    email: person.email,
    dob: person.dob,
    hasDelegateHistory,
    delegateRank,
    delegateState,
    bio: person.bio,
    teams: teamsByPeopleId.get(person.id) ?? [],
    updatedAt,
  };
}

// Lists every Manage Users row  - every `people` row, left-joined with
// `users`/`delegates`, plus each person's own open Delegate rank/state
// and active team memberships.
async function listUsers() {
  const [people, openRankRows, openStateRows, delegateRows, activeMemberships] = await Promise.all([
    peopleDb.listAllPeopleWithUsersAndDelegate(),
    delegatesDb.listAllOpenRankRows(),
    delegatesDb.listAllOpenStateRows(),
    delegatesDb.listAllDelegatesWithPeople(),
    teamMembershipsDb.listAllActiveTeamMemberships(),
  ]);

  // The open rank/state rows are only tagged with their own delegate_id,
  // not people_id - this maps between the two.
  const peopleIdByDelegateId = new Map(delegateRows.map((row) => [row.id, row.people_id]));

  const openRanksByPeopleId = new Map();
  for (const [delegateId, rows] of groupBy(openRankRows, 'delegate_id')) {
    const peopleId = peopleIdByDelegateId.get(delegateId);
    if (peopleId)
      openRanksByPeopleId.set(
        peopleId,
        rows.map((row) => row.rank),
      );
  }

  const openStateByPeopleId = new Map();
  for (const row of openStateRows) {
    const peopleId = peopleIdByDelegateId.get(row.delegate_id);
    if (peopleId) openStateByPeopleId.set(peopleId, row.state);
  }

  const teamsByPeopleId = new Map();
  for (const [peopleId, rows] of groupBy(activeMemberships, 'people_id')) {
    teamsByPeopleId.set(
      peopleId,
      rows.map((row) => ({
        teamId: row.team_id,
        teamName: row.team_name,
        specialRole: row.special_role,
        isLeader: row.is_active_leader,
      })),
    );
  }

  return people.map((person) =>
    buildUserRow(person, { openRanksByPeopleId, openStateByPeopleId, teamsByPeopleId }),
  );
}

module.exports = {
  WCA_ID_FORMAT,
  resolvePeopleId,
  searchPeople,
  lookupWcaId,
  listUsers,
};
