const nodemailer = require('nodemailer');

// Logger
const log4js = require("log4js");
const logger = log4js.getLogger();
logger.level = "debug";

// Email mailer
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// verify that the transporter is successfully setup
transporter.verify()
  .then(() => {
    logger.info('Email transporter successfully setup.')
  }).catch(err => {
    logger.fatal('Error setting up email transporter: ', err)
  });

const EmailType = {
  clubs: 'clubs',
  pastCompetition: 'pastCompetition',
  getInvolved: 'getInvolved',
  socialMedia: 'socialMedia',
  software: 'software',
  general: 'general',
  organizing: 'organizing',
}

// Sends email from notifications@southeastcubing.org to requested entity
function sendEmail(req, res) {
  // Validations
  if (!req.body || !req.body.name || !req.body.email || !req.body.text || !req.body.subject) {
    res.status(400).json({ message: 'must provide name, email, subject, and text.' });
  } else if (!req.body.emailType || !EmailType[req.body.emailType]) {
    res.status(400).json({ message: 'must provide a valid emailType.' });
  } else {

    // Send email
    transporter.sendMail({
      from: `"${req.body.name}" <${process.env.EMAIL_USER}>`,
      replyTo: req.body.email,
      to: getToEmail(req.body.emailType),
      subject: getEmailSubject(req.body.subject),
      text: getEmailText(req.body.name, req.body.email, req.body.text, req.body.ip),
    })
      .then(info => {
        res.send({ status: 'success' });
      })
      .catch(err => {
        logger.error('ip-' + req.ip + ' Error sending email: ', err);
        res.status(500).json({ message: err });
      });
      
  }
}

// Converts email type to a send to address
function getToEmail(emailType) {
  switch (emailType) {
    case EmailType.getInvolved:
      return 'board@southeastcubing.org';
    case EmailType.clubs:
      return 'clubs@southeastcubing.org';
    case EmailType.organizing:
      return 'competitions@southeastcubing.org';
    case EmailType.pastCompetition:
    case EmailType.socialMedia:
    case EmailType.software:
    case EmailType.general:
    default:
      return 'contact@southeastcubing.org';
  }
}

// Formats Subject
function getEmailSubject(subject) {
  return '[SoutheastCubing.org] Contact Form - ' + subject;
}

// Formats email body
function getEmailText(name, email, text, ip) {
  let emailText = `You've recieved an email from ${name} <${email}>`;
  if (ip) {
    emailText += ' - ' + ip;
  }
  emailText += '\n\nPlease note: all messages sent through this form are unauthenticated. If the person is asking for a request relating to them (ie. cancelling a registration, updating their name), make sure to recieve verification with the persons email as seen on WCA.\n\nThey\'ve sent the following message:\n\n' + text;

  return emailText;
}

module.exports = { sendEmail };
