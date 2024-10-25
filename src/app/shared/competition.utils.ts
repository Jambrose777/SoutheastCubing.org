import { Competition } from "../models/Competition";
import { RegistrationStatus } from "./types";
import * as moment from 'moment';

// Formats a date from WCA with appropriate multi day Logic
export function getFullCompetitionDate(start: string, end: string): string {
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

// Calculates the current registration status based on when registration is opened and closed
export function getRegistrationStatus(competition: Competition): RegistrationStatus {
  if (moment.utc(competition.registration_close).isBefore(moment.now())) {
    return RegistrationStatus.closed;
  } else if (moment.utc(competition.registration_open).isAfter(moment.now())) {
    return RegistrationStatus.preLaunch;
  } else if (competition.is_manual_competition) {
    return RegistrationStatus.open;
  } else if (competition.accepted_registrations >= competition.competitor_limit) {
    return RegistrationStatus.openWithWaitingList;
  } else {
    return RegistrationStatus.openWithSpots;
  } 
}

// Provides a string that is easy to read in a specific format
export function getReadableRegistrationOpen(competition: Competition): string {
  return moment.utc(competition.registration_open).local().format("MMM D, YYYY [at] h:mm A");
}
