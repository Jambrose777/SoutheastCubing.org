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

module.exports = {
  searchPeople,
  lookupWcaId,
};
