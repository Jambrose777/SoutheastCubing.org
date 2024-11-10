const express = require('express');
const morgan = require('morgan');
var cors = require('cors');
const schedule = require('node-schedule');

const email = require('./email.js')
const competitions = require('./competitions.js');

const app = express();
const port = 8080;

app.use(express.json())
app.use(morgan(":method :url :status :res[content-length] - :response-time ms"));
app.use(cors());

// load in competitions on bootup
competitions.fetchCompetitions();

// fetch competitions update everyday at midnight
schedule.scheduleJob('0 0 * * *', () => { 
  competitions.getCompetitionsFromWCA().then(comps => {
    res.send(comps);
  });
});

app.post('/email', async (req, res) => {
  email.sendEmail(req, res);
});

app.get('/competitions', async (req, res) => {
  competitions.getCompetitions(req, res);
});

app.get('/update-competitions', async (req, res) => {
  competitions.updateCompetitions(req, res);
});

app.get('/', async (req, res) => {
  res.send({ status: 'healthy' });
});

app.listen(port, function () {
  console.log(`listening on port ${port}!`)
});
