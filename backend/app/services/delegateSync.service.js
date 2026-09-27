const wca = require('../integrations/wca.integration.js');
const delegatesDb = require('../database/delegates.database.js');
const peopleDb = require('../database/people.database.js');
const logger = require('../utils/logger.util.js');
const { SOUTHEAST_STATES } = require('../helpers/southeastStates.helper.js');

// SECI's own delegate_regions group id.
const SECI_GROUP_ID = 32;

// WCA's delegate_status values map one-to-one onto our rank enum, except
// they carry a "_delegate" suffix we drop. `temporary` excluded
const WCA_STATUS_TO_RANK = {
  trainee_delegate: 'trainee',
  junior_delegate: 'junior',
  delegate: 'delegate',
  senior_delegate: 'senior',
  regional_delegate: 'regional',
};

// The personal-rank track - trainee/junior/delegate are mutually exclusive
// (WCA reports at most one at a time), unlike Regional/Senior which can be
// concurrently open alongside a personal rank.
const TRACK_RANK_STATUSES = ['trainee_delegate', 'junior_delegate', 'delegate'];

// Parses WCA's `location` field down to the first Southeast state it lists,
// or null if there isn't one. WCA's location is free text, usually
// "USA (<State>)".
function parseSoutheastState(location) {
  if (!location) return null;
  const match = location.match(/^USA \(([^)]+)\)$/);
  if (!match) return null;
  const candidates = match[1].split('&').map((s) => s.trim());
  return candidates.find((c) => SOUTHEAST_STATES.includes(c)) ?? null;
}

// Groups a flat role list by user.wca_id - a person can hold more than one
// concurrently-open role at once (e.g. a personal `delegate` role and a
// separate `regional_delegate` role), so this is a list per wca_id, not a
// single value.
function groupRolesByWcaId(roles) {
  const byWcaId = new Map();
  for (const role of roles) {
    const wcaId = role.user?.wca_id;
    if (!wcaId) continue;
    if (!byWcaId.has(wcaId)) byWcaId.set(wcaId, []);
    byWcaId.get(wcaId).push(role);
  }
  return byWcaId;
}

// Groups delegate_rank_history/delegate_state_history rows (already tagged
// with wca_id by the database layer's bulk listAllOpen*Rows queries) by
// wca_id.
function groupRowsByWcaId(rows) {
  const byWcaId = new Map();
  for (const row of rows) {
    if (!byWcaId.has(row.wca_id)) byWcaId.set(row.wca_id, []);
    byWcaId.get(row.wca_id).push(row);
  }
  return byWcaId;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

// Runs the WCA sync: reconciles every currently-open 
// delegate_rank_history/delegate_state_history row against WCA's own live 
// user_roles data, and refreshes competitions_delegated_count. Returns a 
// structured summary of what changed.
async function syncDelegatesFromWca() {
  const summary = {
    promoted: [],
    demoted: [],
    rankChanged: [],
    regionalOrSeniorChanged: [],
    stateChanged: [],
    errors: [],
  };

  // SECI's own roles - an empty/implausible response is far more likely a
  // WCA outage or API-shape change than a genuine "we have zero Delegates"
  // day, so this aborts the whole run rather than closing out every
  // currently-open row. Also doubles as the candidate list for brand-new
  // southeast delegates.
  const seciRoles = await wca.fetchUserRoles({ groupId: SECI_GROUP_ID, isActive: true });
  if (!Array.isArray(seciRoles) || seciRoles.length === 0) {
    const message = `WCA returned no Southeast Delegates (groupId=${SECI_GROUP_ID}) - aborting sync rather than closing every open row.`;
    logger.error(message);
    summary.errors.push(message);
    return summary;
  }

  // Every active delegate_regions role worldwide - the actual source of
  // truth for "what roles does this specific wca_id currently hold" used
  // below, not just seciRoles. senior_delegate roles are always scoped to a
  // parent/broader group which is itself a delegate_regions group.
  const worldwideRoles = await wca.fetchUserRoles({
    groupType: 'delegate_regions',
    isActive: true,
  });
  const rolesByWcaId = groupRolesByWcaId(worldwideRoles);

  // Every existing delegates/rank/state row we have, read once up front.
  const delegatesByWcaId = new Map(
    (await delegatesDb.listAllDelegatesWithWcaId()).map((row) => [row.wca_id, row]),
  );
  const openRankRowsByWcaId = groupRowsByWcaId(await delegatesDb.listAllOpenRankRows());
  const openStateRows = await delegatesDb.listAllOpenStateRows();
  const openStateRowByWcaId = new Map(openStateRows.map((row) => [row.wca_id, row]));

  // Reconcile every wca_id WCA currently reports for our region, plus every
  // wca_id we already track,
  const seciWcaIds = new Set(seciRoles.map((role) => role.user?.wca_id).filter(Boolean));
  const trackedWcaIds = new Set([...seciWcaIds, ...openRankRowsByWcaId.keys()]);

  for (const wcaId of trackedWcaIds) {
    try {
      await reconcileOneDelegate({
        wcaId,
        currentRoles: rolesByWcaId.get(wcaId) ?? [],
        existingDelegate: delegatesByWcaId.get(wcaId) ?? null,
        openRankRows: openRankRowsByWcaId.get(wcaId) ?? [],
        openStateRow: openStateRowByWcaId.get(wcaId) ?? null,
        summary,
      });
    } catch (err) {
      const message = `Delegate sync failed reconciling wca_id ${wcaId}: ${err.message}`;
      logger.error(message, err);
      summary.errors.push(message);
    }
  }

  return summary;
}

// Reconciles one person's rank/state rows against their current WCA roles.
// Isolated per-person so one bad record can't abort the whole sync run. 
// Handles the personal-rank track (trainee/junior/delegate - mutually exclusive) 
// and the Regional/Senior tracks (independently open/closed, concurrent with 
// the personal track) separately.
async function reconcileOneDelegate({
  wcaId,
  currentRoles,
  existingDelegate,
  openRankRows,
  openStateRow,
  summary,
}) {
  const personalRole = currentRoles.find((role) =>
    TRACK_RANK_STATUSES.includes(role.metadata?.status),
  );
  const regionalRole = currentRoles.find((role) => role.metadata?.status === 'regional_delegate');
  const seniorRole = currentRoles.find((role) => role.metadata?.status === 'senior_delegate');

  const openPersonalRow = openRankRows.find((row) => TRACK_RANK_STATUSES.some(
    (status) => WCA_STATUS_TO_RANK[status] === row.rank,
  ));
  const openRegionalRow = openRankRows.find((row) => row.rank === 'regional');
  const openSeniorRow = openRankRows.find((row) => row.rank === 'senior');

  const hasAnyCurrentRole = Boolean(personalRole || regionalRole || seniorRole);
  if (!hasAnyCurrentRole && openRankRows.length === 0) return; // never a delegate, nothing to reconcile

  // A delegate row we already have on record is passed straight through -
  // only a genuinely brand-new delegate falls through to ensureDelegateRow's
  // own lookup + WCA person fetch.
  const delegate = existingDelegate ?? (await ensureDelegateRow(wcaId));
  if (!delegate) return;

  await reconcilePersonalTrack({ delegate, wcaId, personalRole, openPersonalRow, summary });
  await reconcileLeadershipTrack({
    delegate,
    wcaId,
    rank: 'regional',
    role: regionalRole,
    openRow: openRegionalRow,
    summary,
  });
  await reconcileLeadershipTrack({
    delegate,
    wcaId,
    rank: 'senior',
    role: seniorRole,
    openRow: openSeniorRow,
    summary,
  });

  // State only ever comes from the personal-rank role - regional_delegate/
  // senior_delegate roles never report a location themselves.
  const newState = personalRole ? parseSoutheastState(personalRole.metadata?.location) : null;
  await reconcileState({ delegate, wcaId, openStateRow, newState, summary });

  // Refreshed directly from the sync payload's total_delegated field.
  const totalDelegated = personalRole?.metadata?.total_delegated;
  if (typeof totalDelegated === 'number' && totalDelegated !== delegate.competitions_delegated_count) {
    await delegatesDb.updateCompetitionsDelegatedCount(delegate.id, totalDelegated);
  }
}

// The personal-rank track (trainee/junior/delegate) - at most one open row
// at a time. A promotion/demotion closes the old row and opens a new one
// (both in one reconciliation pass, same day); a full removal just closes
// with nothing reopened; a brand-new Delegate just opens with nothing to
// close.
async function reconcilePersonalTrack({ delegate, wcaId, personalRole, openPersonalRow, summary }) {
  const newRank = personalRole ? WCA_STATUS_TO_RANK[personalRole.metadata.status] : null;
  if ((openPersonalRow?.rank ?? null) === newRank) return; // unchanged

  // close previous rank
  if (openPersonalRow) {
    await delegatesDb.closeRankRow(openPersonalRow.id, todayIsoDate());
  }

  // opens a new rank
  if (newRank) {
    // start_date comes from WCA's own start_date on the role.
    await delegatesDb.openRankRow(delegate.id, newRank, personalRole.start_date);
  }

  // update summary
  if (openPersonalRow && newRank) {
    summary.rankChanged.push({ wcaId, from: openPersonalRow.rank, to: newRank });
  } else if (openPersonalRow) {
    summary.demoted.push({ wcaId, from: openPersonalRow.rank });
  } else {
    summary.promoted.push({ wcaId, rank: newRank, startDate: personalRole.start_date });
  }
}

// The Regional/Senior tracks - each opens/closes independently of the
// personal-rank track (and of each other), concurrently alongside it.
// Becoming Regional/Senior opens an additional row rather than closing the
// personal-rank row; stepping down closes just that one row.
async function reconcileLeadershipTrack({ delegate, wcaId, rank, role, openRow, summary }) {
  const isCurrentlyHeld = Boolean(role);
  const isCurrentlyOpen = Boolean(openRow);
  if (isCurrentlyHeld === isCurrentlyOpen) return; // unchanged either way

  if (isCurrentlyOpen) {
    await delegatesDb.closeRankRow(openRow.id, todayIsoDate());
    summary.regionalOrSeniorChanged.push({ wcaId, rank, opened: false });
  } else {
    await delegatesDb.openRankRow(delegate.id, rank, role.start_date);
    summary.regionalOrSeniorChanged.push({ wcaId, rank, opened: true });
  }
}

// SE state history - only SE states are ever stored, so moving out of the
// Southeast just closes the open row with nothing reopened, and moving
// between two SE states closes the old row and opens a new one same-day.
async function reconcileState({ delegate, wcaId, openStateRow, newState, summary }) {
  if ((openStateRow?.state ?? null) === newState) return; // unchanged

  if (openStateRow) {
    await delegatesDb.closeStateRow(openStateRow.id, todayIsoDate());
  }
  if (newState) {
    await delegatesDb.openStateRow(delegate.id, newState, todayIsoDate());
  }
  summary.stateChanged.push({ wcaId, from: openStateRow?.state ?? null, to: newState });
}

// Creates a brand-new delegate's `delegates` row. Upserts the underlying 
// `people` row first, so a brand-new Delegate gets a `people` row without 
// requiring them to log in first.
async function ensureDelegateRow(wcaId) {
  const wcaPerson = await wca.fetchPersonByWcaId(wcaId);
  if (!wcaPerson) {
    logger.warn(
      `Delegate sync: WCA lookup for a brand-new delegate (wca_id ${wcaId}) failed - skipping.`,
    );
    return null;
  }
  const person = await peopleDb.upsertPersonFromWcaIdLookup({
    wcaId,
    name: wcaPerson.name,
    pictureUrl: wcaPerson.avatar?.thumb_url ?? null,
  });
  return delegatesDb.upsertDelegate(person.id);
}

module.exports = { syncDelegatesFromWca };
