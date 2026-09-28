const teamMembershipsDb = require('../database/teamMemberships.database.js');
const teamLeadersDb = require('../database/teamLeaders.database.js');
const delegatesDb = require('../database/delegates.database.js');
const { resolvePersonPicture } = require('../helpers/personPicture.helper.js');
const { PERSONAL_RANKS } = require('../helpers/delegateRanks.helper.js');
const { httpError } = require('../helpers/httpError.helper.js');
const devImpersonation = require('../helpers/devImpersonation.helper.js');
const { getCurrentRoles } = require('../helpers/roles.helper.js');
const {
  ADMIN_TEAM_ID,
  BOARD_TEAM_ID,
  OFFICER_TEAM_IDS,
} = require('../helpers/fixedTeams.helper.js');

// Whether a membership's team should link to the Who We Are page
function linksToWhoWeAre(row) {
  if (row.team_id === ADMIN_TEAM_ID) return false;
  if (row.team_id === BOARD_TEAM_ID || OFFICER_TEAM_IDS.includes(row.team_id)) {
    return true;
  }
  return !row.team_hidden && !row.team_archived_at;
}

// Shapes a still-active membership row. If `activeStint` is passed (the
// person's currently-active leadership stint on this same team, if any),
// the displayed "since" date is that stint's own start date rather than the
// membership's own start date - a leader's line reads as "since they became
// leader," not "since they joined the team."
function toCurrentMembershipView(membership, activeStint) {
  return {
    type: 'membership',
    membershipId: membership.id,
    teamId: membership.team_id,
    teamName: membership.team_name,
    specialRole: membership.special_role,
    isLeader: !!activeStint,
    sinceDate: activeStint ? activeStint.start_date : membership.start_date,
    linksToWhoWeAre: linksToWhoWeAre(membership),
  };
}

// Shapes a past (ended) membership row - its own line, with no leadership
// info attached (a past leadership stint on the same team gets its own
// separate line via toPastLeadershipStintView, rather than being merged in
// here).
function toPastMembershipView(membership) {
  return {
    type: 'membership',
    membershipId: membership.id,
    teamId: membership.team_id,
    teamName: membership.team_name,
    specialRole: membership.special_role,
    startDate: membership.start_date,
    endDate: membership.end_date,
    linksToWhoWeAre: linksToWhoWeAre(membership),
  };
}

// Shapes a past (ended) leadership stint - its own line in the past list,
// separate from the membership row it happened during.
function toPastLeadershipStintView(stint) {
  return {
    type: 'leadershipStint',
    leaderId: stint.id,
    teamId: stint.team_id,
    teamName: stint.team_name,
    startDate: stint.start_date,
    endDate: stint.end_date,
    linksToWhoWeAre: linksToWhoWeAre(stint),
  };
}

// Shapes a currently-open personal-rank row, combined with the currently-
// open state row (if any) into one line - e.g. "Junior Delegate - Georgia".
// `sinceDate` is whichever of the two rows' own start dates is more recent.
function toCurrentDelegateRankView(rankRow, stateRow) {
  const sinceDate =
    stateRow && new Date(stateRow.start_date) > new Date(rankRow.start_date)
      ? stateRow.start_date
      : rankRow.start_date;
  return {
    type: 'delegateRank',
    rankRowId: rankRow.id,
    rank: rankRow.rank,
    state: stateRow?.state ?? null,
    stateRowId: stateRow?.id ?? null,
    sinceDate,
  };
}

// Shapes a currently-open state row on its own - only used for the
// defensive fallback case (a state row open with no personal-rank row
// open), which shouldn't happen given delegate_state_history is only ever
// populated via a concurrently-open personal rank, but isn't silently
// dropped if it ever does.
function toCurrentDelegateStateView(row) {
  return { type: 'delegateState', stateRowId: row.id, state: row.state, sinceDate: row.start_date };
}

// Shapes a closed (`end_date` set) delegate_rank_history row for the past
// list.
function toPastDelegateRankView(row) {
  return {
    type: 'delegateRank',
    rankRowId: row.id,
    rank: row.rank,
    startDate: row.start_date,
    endDate: row.end_date,
  };
}

// Shapes a closed delegate_state_history row for the past list.
function toPastDelegateStateView(row) {
  return {
    type: 'delegateState',
    stateRowId: row.id,
    state: row.state,
    startDate: row.start_date,
    endDate: row.end_date,
  };
}

// Assembles everything the My Info tab needs for the signed-in user: their
// core identity/contact fields plus their roles/memberships split into two
// separate current vs. past lists.
async function getMyInfo(user) {
  const [memberships, leadershipStints, delegate] = await Promise.all([
    teamMembershipsDb.listMembershipsForPerson(user.people_id),
    teamLeadersDb.listLeadershipStintsForPerson(user.people_id),
    delegatesDb.findDelegateByPeopleId(user.people_id),
  ]);

  // A session impersonating a Delegate role has no real `delegates` row,
  // but still needs bio editing.
  const isImpersonatedDelegate = delegate
    ? false
    : Boolean((await getCurrentRoles(user.people_id, user.sessionId)).delegateRank);

  const current = memberships
    .filter((membership) => !membership.end_date)
    .map((membership) => {
      const activeStint = leadershipStints.find(
        (stint) => stint.team_id === membership.team_id && !stint.end_date,
      );
      return toCurrentMembershipView(membership, activeStint);
    });

  const past = [
    ...memberships.filter((membership) => membership.end_date).map(toPastMembershipView),
    ...leadershipStints.filter((stint) => stint.end_date).map(toPastLeadershipStintView),
  ];

  let delegateBio;
  if (isImpersonatedDelegate) {
    delegateBio = devImpersonation.getImpersonatedBio(user.sessionId);
  } else if (delegate) {
    // Sets Delegate's bio
    delegateBio = delegate.bio ?? '';

    // Get rank and state data for a Delegate.
    const [rankRows, stateRows] = await Promise.all([
      delegatesDb.listRankRowsForDelegate(delegate.id),
      delegatesDb.listStateRowsForDelegate(delegate.id),
    ]);

    const openRankRows = rankRows.filter((row) => !row.end_date);
    const openPersonalRankRow = openRankRows.find((row) => PERSONAL_RANKS.includes(row.rank));
    const openOtherRankRows = openRankRows.filter((row) => row !== openPersonalRankRow);
    const openStateRow = stateRows.find((row) => !row.end_date) ?? null;

    if (openPersonalRankRow) {
      // Combined into one current line - "Junior Delegate - Georgia."
      current.push(toCurrentDelegateRankView(openPersonalRankRow, openStateRow));

      const rankStart = new Date(openPersonalRankRow.start_date);
      const stateStart = openStateRow ? new Date(openStateRow.start_date) : null;
      if (stateStart && stateStart > rankStart) {
        // The combined line shows the state's (more recent) date - the
        // rank's own earlier start date still needs to be on record
        // somewhere, so it goes into past instead of disappearing.
        past.push(toPastDelegateRankView(openPersonalRankRow));
      } else if (stateStart && stateStart.getTime() !== rankStart.getTime()) {
        // The combined line shows the rank's (more recent) date - same
        // idea, but for the state's earlier start date instead.
        past.push(toPastDelegateStateView(openStateRow));
      }
      // If the two dates are equal, the combined line already fully
      // represents both - nothing extra goes into past.
    } else if (openStateRow) {
      // Defensive fallback - a state row open with no personal-rank row
      // open shouldn't happen (state history is only ever populated
      // alongside a concurrently-open personal rank), but isn't silently
      // dropped if it ever does.
      current.push(toCurrentDelegateStateView(openStateRow));
    }

    // regional/senior/temporary each open/close independently of the
    // personal-rank track and are never combined with a state.
    current.push(...openOtherRankRows.map((row) => toCurrentDelegateRankView(row, null)));

    // Every closed rank row shows in past.
    past.push(...rankRows.filter((row) => row.end_date).map(toPastDelegateRankView));
    past.push(...stateRows.filter((row) => row.end_date).map(toPastDelegateStateView));
  }

  current.sort((a, b) => new Date(b.sinceDate).getTime() - new Date(a.sinceDate).getTime());

  past.sort((a, b) => {
    const bEnd = b.endDate ? new Date(b.endDate).getTime() : Date.now();
    const aEnd = a.endDate ? new Date(a.endDate).getTime() : Date.now();
    return bEnd - aEnd;
  });

  return {
    seciId: user.people_id,
    wcaId: user.wca_id,
    wcaUserId: user.wca_user_id,
    name: user.name,
    email: user.email,
    dob: user.dob,
    ...resolvePersonPicture(user),
    hasManagedPhoto: user.has_managed_photo,
    pictureSyncedWithWca: user.picture_synced_with_wca,
    memberships: { current, past },
    // Only present at all for an actual (or impersonated) Delegate.
    ...(delegate || isImpersonatedDelegate ? { delegateBio } : {}),
  };
}

// Sets the signed-in user's own Delegate bio - 400 if they aren't a
// Delegate at all (no delegates row to write to). Returns the refreshed
// My Info payload, same as getMyInfo, so the frontend can update in one
// round trip rather than trusting a bespoke mutation response.
async function updateBio(user, bio) {
  const delegate = await delegatesDb.findDelegateByPeopleId(user.people_id);
  if (delegate) {
    await delegatesDb.updateBio(delegate.id, bio, user.id);
    return getMyInfo(user);
  }

  const impersonatedRank = (await getCurrentRoles(user.people_id, user.sessionId)).delegateRank;
  if (impersonatedRank) {
    devImpersonation.setImpersonatedBio(user.sessionId, bio);
    return getMyInfo(user);
  }

  // if neither trigger then the person is not a Delegate
  throw httpError(400, 'This person is not a Delegate.');
}

module.exports = { getMyInfo, updateBio };
