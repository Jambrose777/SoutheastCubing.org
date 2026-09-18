const express = require('express');

// Logger
const logger = require('../utils/logger.util.js');

const emailController = require('../controllers/email.controller.js');
const competitionsController = require('../controllers/competitions.controller.js');
const { emailLimiter } = require('../middleware/rateLimit.middleware.js');

// Public, unauthenticated routes.
const router = express.Router();

router.post('/email', emailLimiter, async (req, res) => {
  try {
    emailController.sendEmail(req, res);
  } catch (e) {
    logger.error('POST /email ', e);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Internal server error' });
    }
  }
});

router.get('/competitions', async (req, res) => {
  try {
    await competitionsController.getCompetitions(req, res);
  } catch (e) {
    logger.error('GET /competitions ', e);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Internal server error' });
    }
  }
});

router.post('/update-competitions', async (req, res) => {
  try {
    await competitionsController.updateCompetitions(req, res);
  } catch (e) {
    logger.error('GET /update-competitions ', e);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Internal server error' });
    }
  }
});

router.get('/', async (req, res) => {
  try {
    res.send({ status: 'healthy' });
  } catch (e) {
    logger.error('GET / ', e);
  }
});

module.exports = router;
