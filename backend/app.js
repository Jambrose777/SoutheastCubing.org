const express = require('express');
const morgan = require('morgan');
var cors = require('cors');
const schedule = require('node-schedule');

// Logger
const log4js = require("log4js");
const logger = log4js.getLogger();
logger.level = "debug";

const email = require('./email.js')
const competitions = require('./competitions.js');

const app = express();
const port = 8080;

app.use(express.json())
app.use(morgan("[:date[iso]] [INFO] ip-:remote-addr :method :url :status :response-time ms"));
app.use(cors());

// load in competitions on bootup
try {
  logger.info('Fetching competitions on startup.');
  competitions.fetchCompetitions();
} catch (e) {
  logger.error('Error on fetching competitions on startup: ', e);
}

// fetch competitions update everyday at midnight
schedule.scheduleJob('0 0 * * *', () => {
  try {
    logger.info('Fetching competitions on scheduled update.');
    competitions.getCompetitionsFromWCA().then(() => {
      logger.info('Successfully fetched competitions on scheduled update.');
    });
  } catch (e) {
    logger.error('Error on fetching competitions on scheduled update: ', e);
  }
});

app.post('/email', async (req, res) => {
  try {
    email.sendEmail(req, res);
  } catch (e) {
    logger.error('ip-' + req.ip + ' POST /email ', e);
  }
});

app.get('/competitions', async (req, res) => {
  try {
    competitions.getCompetitions(req, res);
  } catch (e) {
    logger.error('ip-' + req.ip + ' GET /competitions ', e);
  }
});

app.get('/update-competitions', async (req, res) => {
  try {
    competitions.updateCompetitions(req, res);
  } catch (e) {
    logger.error('ip-' + req.ip + ' GET /update-competitions ', e);
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
  logger.info(`Server Started. Listening on port ${port}`)
});
