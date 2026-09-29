const delegatesDb = require('../database/delegates.database.js');
const { resolvePersonPicture } = require('../helpers/personPicture.helper.js');
const { RANK_DISPLAY_ORDER, highestDisplayRank } = require('../helpers/delegateRanks.helper.js');
const { groupBy } = require('../helpers/groupBy.helper.js');

// SECI's own delegate_regions display name - shown as the Regional
// Delegate's own "state" instead of their actual home state, since their
// standing is regionwide.
const REGIONAL_DELEGATE_DISPLAY_STATE = 'Southeast';

// WCA's own placeholder start_date for roles that predate its migration to
// per-role start-date tracking - not a real start date, so a row carrying
// it is very likely a candidate for backfilling through the Manage
// Delegates tool. Exact equality only, per delegates.md - WCA uses this one
// sentinel value consistently, no fuzzy/near-date matching.
const WCA_PLACEHOLDER_START_DATE = '2004-08-01';

// Lists every current Delegate for the public Delegate page - the Regional
// Delegate always shows first, then grouped by state (alphabetical), then by
// Delegate Type within a state (Senior > Delegate > Junior > Trainee),
// tie-broken by promotion date, tie-broken by name.
async function listDelegatesForPublicPage() {
  const [delegateRows, rankRows, stateRows] = await Promise.all([
    delegatesDb.listAllDelegatesWithPeople(),
    delegatesDb.listAllOpenRankRows(),
    delegatesDb.listAllOpenStateRows(),
  ]);

  const openRankRowsByDelegateId = groupBy(rankRows, 'delegate_id');
  const openStateRowByDelegateId = new Map(stateRows.map((row) => [row.delegate_id, row]));

  const delegates = delegateRows
    .map((delegate) => {
      const openRankRows = openRankRowsByDelegateId.get(delegate.id) ?? [];
      const displayRank = highestDisplayRank(openRankRows.map((row) => row.rank));

      // temporary-only (or no open rank at all) - not displayed
      if (!displayRank) return null;

      const displayRankRow = openRankRows.find((row) => row.rank === displayRank);
      const openStateRow = openStateRowByDelegateId.get(delegate.id) ?? null;

      // A non-Regional Delegate with no open state row has moved out of
      // the Southeast - they're no longer actually active for our
      // region, so they're dropped from this list entirely.
      if (displayRank !== 'regional' && !openStateRow) return null;

      return {
        peopleId: delegate.people_id,
        name: delegate.name,
        wcaId: delegate.wca_id,
        ...resolvePersonPicture(delegate),
        bio: delegate.bio,
        competitionsDelegatedCount: delegate.competitions_delegated_count,
        rank: displayRank,
        state:
          displayRank === 'regional'
            ? REGIONAL_DELEGATE_DISPLAY_STATE
            : (openStateRow?.state ?? null),
        // Not part of the response shape itself - only sortKey() below
        // reads this.
        promotionDate: displayRankRow.start_date,
      };
    })
    .filter((delegate) => delegate !== null);

  delegates.sort(
    (a, b) =>
      // Regional Delegate always first, regardless of state grouping.
      Number(b.rank === 'regional') - Number(a.rank === 'regional') ||
      (a.state ?? '').localeCompare(b.state ?? '') ||
      RANK_DISPLAY_ORDER.indexOf(a.rank) - RANK_DISPLAY_ORDER.indexOf(b.rank) ||
      new Date(a.promotionDate).getTime() - new Date(b.promotionDate).getTime() ||
      a.name.localeCompare(b.name),
  );

  // Remove promotion date from public repsonse.
  for (const delegate of delegates) {
    delete delegate.promotionDate;
  }
  return delegates;
}

// Shapes one rank or state row into the flat "every stint" history view.
function toHistoryEntry(row, type) {
  return {
    id: row.id,
    type,
    peopleId: row.people_id,
    name: row.name,
    ...resolvePersonPicture(row),
    competitionsDelegatedCount: row.competitions_delegated_count,
    value: type === 'rank' ? row.rank : row.state,
    startDate: row.start_date,
    endDate: row.end_date,
    isPlaceholderDate:
      new Date(row.start_date).toISOString().slice(0, 10) === WCA_PLACEHOLDER_START_DATE,
  };
}

// Assembles both views the Manage Delegates dashboard needs in one shot:
// `current` (one row per Delegate, their single highest concurrently-open
// rank) and `history` (every rank/state stint, current and past, intertwined).
// This never drops anyone for having moved out of the Southeast - Regional
// Delegate/Admin/Board need to see and correct the full roster's real history,
// not just who's presently active.
async function listDelegatesForDashboard() {
  const [delegateRows, rankRows, stateRows] = await Promise.all([
    delegatesDb.listAllDelegatesWithPeople(),
    delegatesDb.listAllRankRowsWithPeople(),
    delegatesDb.listAllStateRowsWithPeople(),
  ]);

  const rankRowsByDelegateId = groupBy(rankRows, 'delegate_id');
  const stateRowsByDelegateId = groupBy(stateRows, 'delegate_id');

  const current = delegateRows
    .map((delegate) => {
      const allRankRows = rankRowsByDelegateId.get(delegate.id) ?? [];
      const openRankRows = allRankRows.filter((row) => !row.end_date);
      const displayRank = highestDisplayRank(openRankRows.map((row) => row.rank));
      if (!displayRank) return null; // no open rank at all - not a current Delegate

      const displayRankRow = openRankRows.find((row) => row.rank === displayRank);

      const openStateRow = (stateRowsByDelegateId.get(delegate.id) ?? []).find(
        (row) => !row.end_date,
      );

      // A non-Regional Delegate with no open state row has moved out of
      // the Southeast - not a current Delegate for our region.
      if (displayRank !== 'regional' && !openStateRow) return null;

      const rankStart = new Date(displayRankRow.start_date);
      const stateStart = openStateRow ? new Date(openStateRow.start_date) : null;
      const startDateFromState = Boolean(stateStart && stateStart > rankStart);

      return {
        peopleId: delegate.people_id,
        name: delegate.name,
        wcaId: delegate.wca_id,
        ...resolvePersonPicture(delegate),
        competitionsDelegatedCount: delegate.competitions_delegated_count,
        rank: displayRank,
        state: openStateRow?.state ?? null,
        startDate: startDateFromState ? openStateRow.start_date : displayRankRow.start_date,
        startDateFromState,
      };
    })
    .filter((entry) => entry !== null);

  // Rank (Regional > Senior > Delegate > Junior > Trainee), then by the
  // adjusted Start Date (oldest first), then by name.
  current.sort(
    (a, b) =>
      RANK_DISPLAY_ORDER.indexOf(a.rank) - RANK_DISPLAY_ORDER.indexOf(b.rank) ||
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime() ||
      a.name.localeCompare(b.name),
  );

  // History is sorted on the frontend as it depends on different selectable modes.
  const history = [
    ...rankRows.map((row) => toHistoryEntry(row, 'rank')),
    ...stateRows.map((row) => toHistoryEntry(row, 'state')),
  ];

  return { current, history };
}

module.exports = { listDelegatesForPublicPage, listDelegatesForDashboard };
