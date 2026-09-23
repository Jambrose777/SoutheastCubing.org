// Stable ids for the teams seeded by 0028_seed_fixed_teams.sql - referenced
// by id (not a lookup-by-name) anywhere code needs to know "is this row one
// of the fixed teams"
const ADMIN_TEAM_ID = 'admin';
const BOARD_TEAM_ID = 'board';
const BOARD_LIAISONS_TEAM_ID = 'board_liaisons';

const OFFICER_TEAM_IDS = [
  'officer_president',
  'officer_vice_president',
  'officer_secretary',
  'officer_assistant_secretary',
  'officer_treasurer',
  'officer_assistant_treasurer',
];

// Every fixed team id - name/existence is locked for all of these through the
// Manage Teams dashboard, but membership/description remain fully editable.
const FIXED_TEAM_IDS = [ADMIN_TEAM_ID, BOARD_TEAM_ID, BOARD_LIAISONS_TEAM_ID, ...OFFICER_TEAM_IDS];

module.exports = {
  ADMIN_TEAM_ID,
  BOARD_TEAM_ID,
  BOARD_LIAISONS_TEAM_ID,
  OFFICER_TEAM_IDS,
  FIXED_TEAM_IDS,
};
