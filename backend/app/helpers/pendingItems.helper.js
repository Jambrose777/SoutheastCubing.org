const delegatesDb = require('../database/delegates.database.js');

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
];

// Every pending item currently open for `user` - at most one per provider,
// in provider-registration order.
async function getPendingItems(user) {
  const items = await Promise.all(PROVIDERS.map((provider) => provider(user)));
  return items.filter((item) => item !== null);
}

module.exports = { getPendingItems };
