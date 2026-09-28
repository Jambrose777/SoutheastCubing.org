const delegatesDb = require('../database/delegates.database.js');
const { resolvePersonPicture } = require('../helpers/personPicture.helper.js');
const { RANK_DISPLAY_ORDER, highestDisplayRank } = require('../helpers/delegateRanks.helper.js');

// SECI's own delegate_regions display name - shown as the Regional
// Delegate's own "state" instead of their actual home state, since their
// standing is regionwide.
const REGIONAL_DELEGATE_DISPLAY_STATE = 'Southeast';

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

// Groups `rows` by `key`'s value, into a Map.
function groupBy(rows, key) {
  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row[key])) grouped.set(row[key], []);
    grouped.get(row[key]).push(row);
  }
  return grouped;
}

module.exports = { listDelegatesForPublicPage };
