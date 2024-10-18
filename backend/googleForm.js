const path = require('path');
const google = require('@googleapis/forms');

const formID = '1vtcLw_QPrS-ZDKG9XxsN192xPEdr0gCA7vIoRVlTZmI';

async function getCompetitionsInStaffForm() {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, 'southeastcubing-org-api.json'),
    scopes: ['https://www.googleapis.com/auth/forms.body.readonly'],
  });
  const forms = google.forms({
    version: 'v1',
    auth: auth,
  });
  const res = await forms.forms.get({formId: formID});
  if (res.data) {
    const competitionsWithStaff = res.data.items[0].questionItem.question.choiceQuestion.options
      .map(comp => comp.value.substring(0, comp.value.indexOf("(") - 1));
    return competitionsWithStaff;
  } else {
    console.log('soft error')
    return [];
  }
}

module.exports = { getCompetitionsInStaffForm };
