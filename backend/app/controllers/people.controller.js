const peopleService = require('../services/people.service.js');
const { respondWithServiceError } = require('../helpers/httpError.helper.js');

// GET /dashboard/people/search - search-as-you-type combobox backing search.
async function searchPeople(req, res) {
  try {
    const results = await peopleService.searchPeople(req.query.q);
    res.json(results);
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to search people');
  }
}

// GET /dashboard/people/wca-lookup/:wcaId - "add by WCA ID" fallback lookup.
async function lookupWcaId(req, res) {
  try {
    const person = await peopleService.lookupWcaId(req.params.wcaId);
    if (!person) {
      res.status(404).json({ message: 'WCA ID not found.' });
      return;
    }
    res.json(person);
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to look up WCA ID');
  }
}

// POST /dashboard/people/resolve - resolves a { peopleId } or { wcaId }
// selection into a display-ready person, used by multi-select comboboxes
// that need the resolved person immediately.
async function resolvePerson(req, res) {
  try {
    const person = await peopleService.resolvePerson(req.body ?? {});
    res.json(person);
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to resolve person');
  }
}

// GET /dashboard/manage-users - every person's Manage Users row.
async function listUsers(req, res) {
  try {
    const users = await peopleService.listUsers();
    res.json(users);
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to list users');
  }
}

module.exports = {
  searchPeople,
  lookupWcaId,
  resolvePerson,
  listUsers,
};
