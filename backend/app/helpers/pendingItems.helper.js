const delegatesDb = require('../database/people/delegates.database.js');

// The notification-badge mechanism's "pending item".
const PROVIDERS = [
  // A Delegate with a still-blank bio.
  async function blankDelegateBio(user) {
    const delegate = await delegatesDb.findDelegateByPeopleId(user.people_id);
    if (!delegate || delegate.bio) return null;
    return {
      id: 'delegate-bio',
      label: 'Add your Delegate bio',
      toolRouterLink: '/dashboard/my-info',
      fieldId: 'delegate-bio-field',
    };
  },
  // Current Delegate records without a Discord user ID need Board/Admin attention.
  async function missingDelegateDiscordUserId(_user, roles) {
    if (!roles?.isAdmin && !roles?.isBoard) return null;
    if (!(await delegatesDb.hasCurrentDelegatesMissingDiscordUserId())) return null;
    return {
      id: 'delegate-discord-user-id',
      label: 'Add Discord user IDs for current Delegates',
      toolRouterLink: '/dashboard/manage-users',
      queryParams: { showMissingDiscordIds: 'true' },
    };
  },
];

// Every pending item currently open for `user` - at most one per provider,
// in provider-registration order.
async function getPendingItems(user, roles) {
  const items = await Promise.all(PROVIDERS.map((provider) => provider(user, roles)));
  return items.filter((item) => item !== null);
}

module.exports = { getPendingItems };
