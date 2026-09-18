const { stripNewlines } = require('../helpers/sanitize.helper.js');
const { config } = require('../config/config.js');

const EmailType = {
  clubs: 'clubs',
  pastCompetition: 'pastCompetition',
  getInvolved: 'getInvolved',
  socialMedia: 'socialMedia',
  software: 'software',
  general: 'general',
  organizing: 'organizing',
};

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

// Builds the nodemailer message options for a contact-form submission -
// resolves the destination address from emailType and strips \r/\n from
// user-supplied fields that end up in email headers. Returns null if
// emailType has no configured destination address, leaving it to the caller
// to decide how to respond to that.
function buildContactFormMessage({ name, email, subject, text, ip, emailType }) {
  const toEmail = getToEmail(emailType);
  if (!toEmail) {
    return null;
  }

  const sanitizedName = stripNewlines(name);
  const sanitizedEmail = stripNewlines(email);
  const sanitizedSubject = stripNewlines(subject);

  return {
    from: `"${sanitizedName}" <${config.EMAIL_USER}>`,
    replyTo: sanitizedEmail,
    to: toEmail,
    subject: getEmailSubject(sanitizedSubject),
    text: getEmailText(sanitizedName, sanitizedEmail, text, ip),
  };
}

module.exports = { EmailType, buildContactFormMessage };
