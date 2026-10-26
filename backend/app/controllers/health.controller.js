const healthService = require('../services/health.service.js');
const { respondWithServiceError } = require('../helpers/httpError.helper.js');

// Returns internal backend and database health.
async function getInternalHealth(req, res) {
  try {
    const result = await healthService.getInternalHealth(req.query.check);
    res.status(result.status === 'healthy' ? 200 : 503).json(result);
  } catch (error) {
    respondWithServiceError(res, error, 'Failed to check internal health');
  }
}

// Returns selected external integration health.
async function getExternalHealth(req, res) {
  try {
    const result = await healthService.getExternalHealth(req.query.check);
    res.status(result.status === 'healthy' ? 200 : 503).json(result);
  } catch (error) {
    respondWithServiceError(res, error, 'Failed to check external health');
  }
}

module.exports = { getInternalHealth, getExternalHealth };
