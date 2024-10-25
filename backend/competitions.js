const axios = require("axios");
const moment = require("moment");

const aws = require('./aws.js');
const googleForm = require('./googleForm.js');
const contentful = require('./contentful.js');
const discord = require('./discord.js');

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
    console.log('400 ', lastChecked.format("YYYY-MM-DD HH:mm:ss"), lastChecked.isAfter(moment().add(-1, 'hour')))
    res.status(400).json({ message: 'Cannot update multiple times within an hour. Last update was: ' + lastChecked.format("YYYY-MM-DD HH:mm:ss") });
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
      // fetch manual competitions from Contentful
      let contentfulCompetitions = await Promise.all((await contentful.getContentfulCompetitions()).items.map(async contentfulComp => {
        // fetch info on competition from WCA
        const wcaCompetition = await getWCACompetitions(res.data, contentfulComp.fields.id);

        return {
          ...wcaCompetition,
          name: contentfulComp.fields.name,
          city: contentfulComp.fields.city,
          venue_address: contentfulComp.fields.venueAddress,
          venue_details: contentfulComp.fields.venueDetails,
          latitude_degrees: contentfulComp.fields.latitudeDegrees,
          longitude_degrees: contentfulComp.fields.longitudeDegrees,
          country_iso2: contentfulComp.fields.countryIso2,
          competitor_limit: contentfulComp.fields.competitorLimit,
          is_manual_competition: true,
        };
      }));

      // Filter out past competitions from Contentful
      contentfulCompetitions = contentfulCompetitions.filter(comp => moment(comp.end_date).isAfter(moment().add(-1, 'day')));

      // fetch competitions with a staff application
      let competitionsWithStaffApp = await googleForm.getCompetitionsInStaffForm();

      // format competition data
      let comps = await formatCompetitionData(res.data.concat(contentfulCompetitions), competitionsWithStaffApp);

      if (comps && comps.length) {
        // for any new competitions, post them on discord
        comps.filter(comp => !competitions.find(comp2 => comp2.id === comp.id)).forEach(newCompetition => {
          discord.postCompetitionInDiscord(newCompetition);
        });

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
    // Filter to only SE comp Dates
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
      is_in_staff_application: competitionsWithStaffApp.includes(competition.name),
      accepted_registrations: await getRegistrationsFromWCA(competition),
      full_date: getFullCompetitionDate(competition.start_date, competition.end_date),
      is_manual_competition: competition.is_manual_competition || false,
    })))
}

function getRegistrationsFromWCA(competition) {
  if (moment.utc(competition.registration_close).isBefore(moment.now()) || moment.utc(competition.registration_open).isAfter(moment.now())) {
    return Promise.resolve(0);
  } else {
    return axios.get(`https://www.worldcubeassociation.org/api/v0/competitions/${competition.id}/registrations`)
      .then(res => res.data.length)
      .catch(err => console.log(err));
  }
}

function getWCACompetitions(competitions, competitionId) {
  let wcaCompetition = competitions.find(wcaCompetition => wcaCompetition.id === competitionId);
  if (wcaCompetition) {
    return Promise.resolve(wcaCompetition);
  } else {
    return axios.get(`https://www.worldcubeassociation.org/api/v0/competitions/${competitionId}`)
      .then(res => res.data)
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

module.exports = { getCompetitions, updateCompetitions, fetchCompetitions };
