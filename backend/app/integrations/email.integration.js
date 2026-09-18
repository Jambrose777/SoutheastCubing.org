const nodemailer = require('nodemailer');
const { config } = require('../config/config.js');

// Logger
const logger = require('../utils/logger.util.js');

// Email mailer - only built once EMAIL_USER/EMAIL_PASS are confirmed present, so a
// missing pair disables sending (see isConfigured() below) instead of handing
// nodemailer undefined credentials and deferring the failure to the first send.
let transporter;
if (config.EMAIL_USER && config.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    auth: {
      user: config.EMAIL_USER,
      pass: config.EMAIL_PASS,
    },
  });

  // verify that the transporter is successfully setup
  transporter
    .verify()
    .then(() => {
      logger.info('Email transporter successfully setup.');
    })
    .catch((err) => {
      logger.fatal('Error setting up email transporter: ', err);
    });
}

// True once EMAIL_USER/EMAIL_PASS are present and the transporter is built.
function isConfigured() {
  return !!transporter;
}

// Sends `mailOptions` through the configured SMTP transporter.
function sendMail(mailOptions) {
  return transporter.sendMail(mailOptions);
}

module.exports = { isConfigured, sendMail };
