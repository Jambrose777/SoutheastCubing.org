const express = require('express');
const morgan = require('morgan');
var cors = require('cors');
const schedule = require('node-schedule');

// Logger
const log4js = require('log4js');
const logger = log4js.getLogger();
logger.level = 'debug';

const email = require('./email.js');
const competitions = require('./competitions.js');
const db = require('./db/pool.js');

const app = express();
const port = 8080;

// Trust only loopback (the nginx reverse proxy sits on the same host) so
// req.ip resolves X-Forwarded-For from that hop - trusting 'true' would let
// any client spoof their own IP via that header.
app.set('trust proxy', 'loopback');

app.use(express.json());
app.use(morgan('[:date[iso]] [INFO] ip-:remote-addr :method :url :status :response-time ms'));
// Scope CORS to an explicit allowlist (prod domain(s) + local dev server) instead of
// allowing any origin, so unrelated sites can't make cross-origin requests to the API.
app.use(cors({ origin: process.env.CORS_ORIGIN.split(',') }));

// Confirm the pooled DSQL connection actually works on boot - logged only, so a
// misconfigured/unreachable cluster is visible immediately.
db.verifyConnection()
  .then(() => logger.info('Successfully connected to the dev DSQL cluster.'))
  .catch((e) => logger.error('Failed to connect to the dev DSQL cluster: ', e));

// load in competitions on bootup
logger.info('Fetching competitions on startup.');
competitions.fetchCompetitions().catch((e) => {
  logger.error('Error on fetching competitions on startup: ', e);
});

// fetch competitions update every day at midnight UTC
schedule.scheduleJob('0 0 * * *', () => {
  logger.info('Fetching competitions on scheduled update.');
  competitions
    .refreshCompetitionsFromWCA()
    .then(() => logger.info('Successfully fetched competitions on scheduled update.'))
    .catch((e) => logger.error('Error on fetching competitions on scheduled update: ', e));
});

app.post('/email', async (req, res) => {
  try {
    email.sendEmail(req, res);
  } catch (e) {
    logger.error('ip-' + req.ip + ' POST /email ', e);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Internal server error' });
    }
  }
});

app.get('/competitions', async (req, res) => {
  try {
    await competitions.getCompetitions(req, res);
  } catch (e) {
    logger.error('ip-' + req.ip + ' GET /competitions ', e);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Internal server error' });
    }
  }
});

app.post('/update-competitions', async (req, res) => {
  try {
    await competitions.updateCompetitions(req, res);
  } catch (e) {
    logger.error('ip-' + req.ip + ' GET /update-competitions ', e);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Internal server error' });
    }
  }
});

app.get('/', async (req, res) => {
  try {
    res.send({ status: 'healthy' });
  } catch (e) {
    logger.error('ip-' + req.ip + ' GET / ', e);
  }
});

app.listen(port, function () {
  logger.info(`Server Started. Listening on port ${port}`);
});
