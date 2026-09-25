const teamMembershipsDb = require('../database/teamMemberships.database.js');
const teamLeadersDb = require('../database/teamLeaders.database.js');
const { ADMIN_TEAM_ID, BOARD_TEAM_ID, OFFICER_TEAM_IDS } = require('../helpers/fixedTeams.helper.js');

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

// Assembles everything the My Info tab needs for the signed-in user: their
// core identity/contact fields plus their roles/memberships split into two
// separate current vs. past lists.
async function getMyInfo(user) {
  const [memberships, leadershipStints] = await Promise.all([
    teamMembershipsDb.listMembershipsForPerson(user.people_id),
    teamLeadersDb.listLeadershipStintsForPerson(user.people_id),
  ]);

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
  ].sort((a, b) => b.endDate.localeCompare(a.endDate));

  return {
    seciId: user.people_id,
    wcaId: user.wca_id,
    wcaUserId: user.wca_user_id,
    name: user.name,
    email: user.email,
    dob: user.dob,
    pictureUrl: user.picture_url,
    memberships: { current, past },
  };
}

module.exports = { getMyInfo };
