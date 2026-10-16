const delegatesDb = require('../database/people/delegates.database.js');
const peopleService = require('./people.service.js');
const { httpError } = require('../helpers/httpError.helper.js');
const { SOUTHEAST_STATES } = require('../helpers/southeastStates.helper.js');

// The delegate_rank_history table's own CHECK constraint's allowed values.
const VALID_RANKS = ['trainee', 'junior', 'delegate', 'senior', 'regional', 'temporary'];

// Resolves `person` ({ peopleId } or { wcaId }) to a delegate row, creating
// the underlying `people`/`delegates` rows if this person has never been
// tracked as a Delegate before. First-ever Delegate row promotes a person
// into a managed photo.
async function resolveDelegate(person, actorId) {
  const peopleId = await peopleService.resolvePeopleId(person, true);
  return delegatesDb.upsertDelegate(peopleId, actorId);
}

function assertValidRank(rank) {
  if (!VALID_RANKS.includes(rank)) {
    throw httpError(400, `Invalid rank "${rank}".`);
  }
}

function assertValidState(state) {
  if (!SOUTHEAST_STATES.includes(state)) {
    throw httpError(400, `Invalid state "${state}".`);
  }
}

// Backfills a past rank stint - always closed (endDate required), since
// this tool can only ever create *past* stints; a new currently-open row
// stays sync-controlled.
async function createRankRow({ person, rank, startDate, endDate, actorId }) {
  assertValidRank(rank);
  if (!startDate) throw httpError(400, 'startDate is required.');
  if (!endDate) throw httpError(400, 'endDate is required.');
  const delegate = await resolveDelegate(person, actorId);
  return delegatesDb.openRankRow(delegate.people_id, rank, startDate, actorId, endDate);
}

// Backfills a past state stint - always closed (endDate required), since
// this tool can only ever create *past* stints; a new currently-open row
// stays sync-controlled.
async function createStateRow({ person, state, startDate, endDate, actorId }) {
  assertValidState(state);
  if (!startDate) throw httpError(400, 'startDate is required.');
  if (!endDate) throw httpError(400, 'endDate is required.');
  const delegate = await resolveDelegate(person, actorId);
  return delegatesDb.openStateRow(delegate.people_id, state, startDate, actorId, endDate);
}

// Edits a rank-history row. A currently-open row (end_date IS NULL) can
// only have its startDate corrected - changing `rank` or setting `endDate`
// on one is rejected outright, since which rank a currently-open row holds
// stays sync-controlled (a manual edit can't fight with the next nightly
// run). An already-closed row is fully editable, including `rank`/`endDate`.
async function updateRankRow(id, { rank, startDate, endDate, actorId }) {
  const existing = await delegatesDb.findRankRowById(id);
  if (!existing) throw httpError(404, 'Rank history row not found.');
  if (!startDate) throw httpError(400, 'startDate is required.');

  if (!existing.end_date) {
    if (rank !== undefined && rank !== existing.rank) {
      throw httpError(400, "Can't change which rank a currently-open row holds.");
    }
    if (endDate) {
      throw httpError(400, "Can't set an end date on a currently-open row here.");
    }
    return delegatesDb.updateRankRow(id, {
      rank: existing.rank,
      startDate,
      endDate: null,
      actorId,
    });
  }

  assertValidRank(rank);
  if (!endDate) throw httpError(400, 'endDate is required.');
  return delegatesDb.updateRankRow(id, { rank, startDate, endDate, actorId });
}

// Edits a state-history row - same open-row-lock rule as updateRankRow above.
async function updateStateRow(id, { state, startDate, endDate, actorId }) {
  const existing = await delegatesDb.findStateRowById(id);
  if (!existing) throw httpError(404, 'State history row not found.');
  if (!startDate) throw httpError(400, 'startDate is required.');

  if (!existing.end_date) {
    if (state !== undefined && state !== existing.state) {
      throw httpError(400, "Can't change which state a currently-open row holds.");
    }
    if (endDate) {
      throw httpError(400, "Can't set an end date on a currently-open row here.");
    }
    return delegatesDb.updateStateRow(id, {
      state: existing.state,
      startDate,
      endDate: null,
      actorId,
    });
  }

  assertValidState(state);
  if (!endDate) throw httpError(400, 'endDate is required.');
  return delegatesDb.updateStateRow(id, { state, startDate, endDate, actorId });
}

// Permanently deletes a rank-history row - Admin-only.
async function hardDeleteRankRow(id) {
  const existing = await delegatesDb.findRankRowById(id);
  if (!existing) throw httpError(404, 'Rank history row not found.');
  await delegatesDb.hardDeleteRankRow(id);
}

// Permanently deletes a state-history row - Admin-only.
async function hardDeleteStateRow(id) {
  const existing = await delegatesDb.findStateRowById(id);
  if (!existing) throw httpError(404, 'State history row not found.');
  await delegatesDb.hardDeleteStateRow(id);
}

// Sets a Delegate's bio on Admin/Board's behalf.
async function updateBio(peopleId, bio, actorId) {
  const delegate = await delegatesDb.findDelegateByPeopleId(peopleId);
  if (!delegate) throw httpError(404, 'This person is not a Delegate.');
  return delegatesDb.updateBio(delegate.id, bio, actorId);
}

// Sets a Delegate's Discord user ID from the Board/Admin Manage Users tool.
async function updateDiscordUserId(peopleId, discordUserId, actorId) {
  if (discordUserId !== null && typeof discordUserId !== 'string') {
    throw httpError(400, 'Discord user ID must be a string or null.');
  }
  const normalizedDiscordUserId = discordUserId?.trim() || null;
  if (normalizedDiscordUserId && !/^\d+$/.test(normalizedDiscordUserId)) {
    throw httpError(400, 'Discord user ID must contain digits only.');
  }

  const delegate = await delegatesDb.findDelegateByPeopleId(peopleId);
  if (!delegate) throw httpError(404, 'This person is not a Delegate.');
  return delegatesDb.updateDiscordUserId(delegate.id, normalizedDiscordUserId, actorId);
}

module.exports = {
  createRankRow,
  createStateRow,
  updateRankRow,
  updateStateRow,
  hardDeleteRankRow,
  hardDeleteStateRow,
  updateBio,
  updateDiscordUserId,
};
