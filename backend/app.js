const express = require('express');
const morgan = require('morgan');
var cors = require('cors');
const email = require('./email.js')

const app = express();
const port = 8080;

app.use(express.json())
app.use(morgan(":method :url :status :res[content-length] - :response-time ms"));
app.use(cors());

app.post('/email', async (req, res) => {
  email.sendEmail(req, res);
});

app.get('/', async (req, res) => {
  res.send({ status: 'healthy' });
});

app.listen(port, function () {
  console.log(`listening on port ${port}!`)
});
