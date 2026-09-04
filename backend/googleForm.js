const path = require('path');
const fs = require('fs');
const google = require('@googleapis/forms');

// Logger
const log4js = require("log4js");
const logger = log4js.getLogger();
logger.level = "debug";

const formID = '1vtcLw_QPrS-ZDKG9XxsN192xPEdr0gCA7vIoRVlTZmI';

// gets competitions listed on the Southeast Cubing Staff Google Form
async function getCompetitionsInStaffForm() {
  const credentialsPath = path.join(__dirname, 'southeastcubing-org-api.json');

  // The Google service-account credentials file is gitignored and isn't always
  // present locally degrade gracefully instead of throwing and breaking the 
  // whole competitions update flow.
  if (!fs.existsSync(credentialsPath)) {
    logger.error('Missing Google service-account credentials file at ' + credentialsPath + ' - skipping staff form fetch.');
    return [];
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: ['https://www.googleapis.com/auth/forms.body.readonly'],
  });
  const forms = google.forms({
    version: 'v1',
    auth: auth,
  });
  const res = await forms.forms.get({formId: formID});
  if (res.data) {
    logger.info('Successfully fetched Staff from Google Form.');
    const competitionsWithStaff = res.data.items[0].questionItem.question.choiceQuestion.options
      .map(comp => comp.value.substring(0, comp.value.indexOf("(") - 1));
    return competitionsWithStaff;
  } else {
    logger.error('Error retrieving Staff from Google Form.');
    return [];
  }
}

module.exports = { getCompetitionsInStaffForm };
