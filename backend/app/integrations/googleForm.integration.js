const path = require('path');
const fs = require('fs');
const google = require('@googleapis/forms');

// Logger
const logger = require('../utils/logger.util.js');

const formID = '1vtcLw_QPrS-ZDKG9XxsN192xPEdr0gCA7vIoRVlTZmI';

// gets competitions listed on the Southeast Cubing Volunteer Google Form
async function getCompetitionsInVolunteerForm() {
  // Credentials live in backend/.env/, a sibling of app/ - not gitignored
  // app/ itself, so this walks up two levels from app/integrations/.
  const credentialsPath = path.join(__dirname, '..', '..', '.env', 'southeastcubing-org-api.json');

  // The Google service-account credentials file is gitignored and isn't always
  // present locally degrade gracefully instead of throwing and breaking the
  // whole competitions update flow.
  if (!fs.existsSync(credentialsPath)) {
    logger.error(
      'Missing Google service-account credentials file at ' +
        credentialsPath +
        ' - skipping volunteer form fetch.',
    );
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

  try {
    const res = await forms.forms.get({ formId: formID });

    // Validate the full response shape before touching it - the Forms API can return
    // a differently-structured response if the form is edited, so treat any missing
    // level of this path the same as a fully missing response.
    const options = res.data?.items?.[0]?.questionItem?.question?.choiceQuestion?.options;
    if (!options) {
      logger.error('Error retrieving Volunteers from Google Form: unexpected response shape.');
      return [];
    }

    logger.info('Successfully fetched Volunteers from Google Form.');
    return options
      .filter((comp) => {
        // A value without "(" doesn't match the expected "Competition Name (date)"
        // format - skip it rather than producing a garbled substring.
        if (comp.value.indexOf('(') === -1) {
          logger.warn(`Unexpected volunteer form option value, skipping: "${comp.value}"`);
          return false;
        }
        return true;
      })
      .map((comp) => comp.value.substring(0, comp.value.indexOf('(') - 1));
  } catch (err) {
    logger.error('Error retrieving Volunteers from Google Form: ', err);
    return [];
  }
}

module.exports = { getCompetitionsInVolunteerForm };
