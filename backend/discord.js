const axios = require("axios");
const moment = require("moment-timezone");

const eventIconMap = {
  '333': ':3x3:',
  '222': ':2x2:',
  '444': ':4x4:',
  '555': ':5x5:',
  '666': ':6x6:',
  '777': ':7x7:',
  '333bf': ':3BLD:',
  '333fm': ':FMC:',
  '333oh': ':OH:',
  'clock': ':Clock:',
  'minx': ':Megaminx:',
  'pyram': ':Pyraminx:',
  'skewb': ':Skewb:',
  'sq1': ':Square1:',
  '444bf': ':4BLD:',
  '555bf': ':5BLD:',
  '333mbf': ':MBLD:',
}

function postCompetitionInDiscord(competition) {
  // compose Discord Message
  let discordMessage = `[${competition.name}](https://www.worldcubeassociation.org/competitions/${competition.id})\n`;
  discordMessage += `${competition.city} - ${competition.full_date}\n`;
  discordMessage += competition.event_ids.map(eventId => eventIconMap[eventId]).join(" ") + `\n\n`;
  discordMessage += `@${competition.state}\n\n`;
  discordMessage += `Registrations opens ${moment(competition.registration_open).tz("America/New_York").format("dddd, MMMM Do [at] h:mm a")} Eastern / ${moment(competition.registration_open).tz("America/Chicago").format("h:mm a")} Central\n\n`;
  discordMessage += `https://www.worldcubeassociation.org/competitions/${competition.id}`;

  return axios.post(
    process.env.DISCORD_WEBHOOK,
    JSON.stringify({
      content: discordMessage,
    }),
    {
      headers: {
        "Content-Type": "application/json",
      },
    })
    .then(res => res)
    .catch(err => console.log(err));
}

module.exports = { postCompetitionInDiscord };
