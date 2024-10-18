const axios = require("axios");
const moment = require("moment");

const aws = require('./aws.js');
const googleForm = require('./googleForm.js');

let competitions;
let lastChecked;

function getCompetitions(req, res) {
  if (competitions && competitions.length > 0) {
    // pull from local cash
    res.send(competitions);
  } else {
    // send no competitions availble.
    res.status(204).json({ message: 'No competition data available at this time.' })
  }
}

function updateCompetitions(req, res) {
  if (lastChecked && lastChecked.isAfter(moment().add(-1, 'hour'))) {
    console.log('400 ', lastChecked.format("YYYY-MM-DD hh:mm:ss"), lastChecked.isAfter(moment().add(-1, 'hour')))
    res.status(400).json({ message: 'Cannot update multiple times within an hour. Last update was: ' + lastChecked.format("YYYY-MM-DD hh:mm:ss") });
  } else {
    // pull competitions from WCA
    getCompetitionsFromWCA().then(comps => {
      res.send(comps);
    })
  }
}

function fetchCompetitions() {
  aws.getCompetitionData(data => {
    if (data && data.competitions && data.competitions.length) {
      lastChecked = moment(data.lastChecked);
      competitions = data.competitions;
    }
    if (!lastChecked || lastChecked.isBefore(moment().set('hour', 0).set('minute', 0).set('second', 0))) {
      console.log('DEBUG: on bootup, pulling from WCA. ', !lastChecked, " lastChecked: ", lastChecked ? lastChecked.format("YYYY-MM-DD HH:mm:ss") : null);
      getCompetitionsFromWCA();
    } else {
      console.log('DEBUG: on bootup, NOT pulling from WCA. ', !lastChecked, " lastChecked: ", lastChecked.format("YYYY-MM-DD HH:mm:ss"));
    }
  });
}

// gets full competition list from WCA
function getCompetitionsFromWCA() {
  return axios.get("https://www.worldcubeassociation.org/api/v0/competitions?country_iso2=US&per_page=1000&page=1&start=" + moment().add(-1, 'day').format('YYYY-MM-DD'))
    .then(async res => {
      // fetch competitions with a staff application
      let competitionsWithStaffApp = await googleForm.getCompetitionsInStaffForm();

      // format competition data
      let comps = await formatCompetitionData(res.data, competitionsWithStaffApp);

      if (comps && comps.length) {
        // save competition data locally
        competitions = comps;
        lastChecked = moment();

        // save competition data to S3
        aws.saveCompetitionData({ lastChecked: lastChecked.format("YYYY-MM-DD HH:mm:ss"), competitions });
      } else {
        console.log('There are no competitions!');
      }

      return comps;
    })
    .catch(err => console.log(err));
}

async function formatCompetitionData(comps, competitionsWithStaffApp) {
  return await Promise.all(comps
    .filter(comp => 
      comp.city.includes(', Georgia') ||
      comp.city.includes(', Tennessee') ||
      comp.city.includes(', North Carolina') ||
      comp.city.includes(', South Carolina') ||
      comp.city.includes(', Alabama') ||
      comp.city.includes(', Florida'))
    //  Sort by date
    .sort((a, b) => moment(a.start_date).isBefore(b.start_date) ? -1 : 1)
    // Create extra fields for competititon data
    .map(async competition => ({
      url: competition.url,
      id: competition.id,
      name: competition.name,
      website: competition.website,
      city: competition.city,
      venue_address: competition.venue_address,
      venue_details: competition.venue_details,
      latitude_degrees: competition.latitude_degrees,
      longitude_degrees: competition.longitude_degrees,
      country_iso2: competition.country_iso2,
      start_date: competition.start_date,
      registration_open: competition.registration_open,
      registration_close: competition.registration_close,
      end_date: competition.end_date,
      competitor_limit: competition.competitor_limit,
      event_ids: competition.event_ids,
      state: competition.city.substring(competition.city.lastIndexOf(",") + 1).trim(),
      full_date: getFullCompetitionDate(competition.start_date, competition.end_date),
      readable_registration_open: getReadableRegistrationOpen(competition),
      isInStaffApplication: competitionsWithStaffApp.includes(competition.name),
      accepted_registrations: await getRegistrationsFromWCA(competition),
    })))
}

function getRegistrationsFromWCA(competition) {
  if (moment.utc(competition.registration_close).isBefore(moment.now()) || moment.utc(competition.registration_open).isAfter(moment.now())) {
    return Promise.resolve(0);
  } else {
    return axios.get(`https://www.worldcubeassociation.org//api/v0/competitions/${competition.id}/registrations`)
      .then(res => res.data.length)
      .catch(err => console.log(err));
  }
}

// Formats a date from WCA with appropriate multi day Logic
function getFullCompetitionDate(start, end) {
  // 1 day competition has no special logic. Output example: "Jan 1, 2023"
  if (start === end) {
    return moment(start).format("MMM D, YYYY");
  }

  let mstart = moment(start);
  let mend = moment(end);

  // Check that year matches
  if (mstart.year === mend.year) {
    // Check that month matches
    if (mstart.month === mend.month) {
      // Multi day competition with a few days difference. Output example: Jan 1 - 2, 2023
      return mstart.format("MMM D") + " - " + mend.format("D, YYYY");
    } else {
      // Multi day competitiion with a month difference included. Output example: Jan 31 - Feb 2, 2023
      return mstart.format("MMM D") + " - " + mend.format("MMM D, YYYY");
    }
  } else {
    // Multi day competitiion with a year difference included. Output example: Dec 31, 2022 - Jan 1, 2023
    return mstart.format("MMM D, YYYY") + " - " + mend.format("MMM D, YYYY");
  }

}

// Provides a string that is easy to read in a specific format
function getReadableRegistrationOpen(competition) {
  return moment.utc(competition.registration_open).local().format("MMM D, YYYY [at] h:mm A");
}

module.exports = { getCompetitions, updateCompetitions, fetchCompetitions };
