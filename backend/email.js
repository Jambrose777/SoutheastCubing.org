const nodemailer = require('nodemailer');
const { stripNewlines } = require('./utils/sanitize');
const { config } = require('./utils/config.js');

// Logger
const logger = require('./logger.js');

// Email mailer - only built once EMAIL_USER/EMAIL_PASS are confirmed present, so a
// missing pair disables sending (see sendEmail's 503 below) instead of handing
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

const EmailType = {
  clubs: 'clubs',
  pastCompetition: 'pastCompetition',
  getInvolved: 'getInvolved',
  socialMedia: 'socialMedia',
  software: 'software',
  general: 'general',
  organizing: 'organizing',
};

// Sends email from notifications@southeastcubing.org to requested entity
function sendEmail(req, res) {
  // Validations
  if (!req.body || !req.body.name || !req.body.email || !req.body.text || !req.body.subject) {
    res.status(400).json({ message: 'must provide name, email, subject, and text.' });
  } else if (!req.body.emailType || !EmailType[req.body.emailType]) {
    res.status(400).json({ message: 'must provide a valid emailType.' });
  } else {
    const toEmail = getToEmail(req.body.emailType);

    // EMAIL_USER/EMAIL_PASS/the relevant EMAIL_TO_* are optional env vars - sending
    // this email is this route's entire job (a direct-purpose route, not a
    // background side effect), so a missing one must fail the request rather than
    // silently no-op or crash trying to use an unconfigured transporter.
    if (!transporter || !toEmail) {
      logger.warn(
        `Cannot send email for emailType "${req.body.emailType}" - EMAIL_USER/EMAIL_PASS or the destination address env var is not configured.`,
      );
      res.status(503).json({ message: 'Email is not configured. Please try again later.' });
      return;
    }

    // Strip \r/\n from user-supplied fields that end up in email headers
    const name = stripNewlines(req.body.name);
    const email = stripNewlines(req.body.email);
    const subject = stripNewlines(req.body.subject);

    // Send email
    transporter
      .sendMail({
        from: `"${name}" <${config.EMAIL_USER}>`,
        replyTo: email,
        to: toEmail,
        subject: getEmailSubject(subject),
        text: getEmailText(name, email, req.body.text, req.ip),
      })
      .then(() => {
        res.send({ status: 'success' });
      })
      .catch((err) => {
        logger.error('ip-' + req.ip + ' Error sending email: ', err);
        res.status(500).json({ message: 'Failed to send email. Please try again later.' });
      });
  }
}

// Converts email type to a send to address
function getToEmail(emailType) {
  switch (emailType) {
    case EmailType.getInvolved:
      return config.EMAIL_TO_BOARD;
    case EmailType.clubs:
      return config.EMAIL_TO_CLUBS;
    case EmailType.organizing:
      return config.EMAIL_TO_COMPETITIONS;
    case EmailType.pastCompetition:
    case EmailType.socialMedia:
    case EmailType.software:
    case EmailType.general:
    default:
      return config.EMAIL_TO_CONTACT;
  }
}

// Formats Subject
function getEmailSubject(subject) {
  return '[SoutheastCubing.org] Contact Form - ' + subject;
}

// Formats email body
function getEmailText(name, email, text, ip) {
  let emailText = `You've received an email from ${name} <${email}>`;
  if (ip) {
    emailText += ' - ' + ip;
  }
  emailText +=
    "\n\nPlease note: all messages sent through this form are unauthenticated. If the person is asking for a request relating to them (ie. cancelling a registration, updating their name), make sure to receive verification with the persons email as seen on WCA.\n\nThey've sent the following message:\n\n" +
    text;

  return emailText;
}

module.exports = { sendEmail };
