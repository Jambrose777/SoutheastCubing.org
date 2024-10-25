import { Competition } from "../models/Competition";
import { RegistrationStatus } from "./types";
import * as moment from 'moment';
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
