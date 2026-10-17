import * as moment from 'moment';
import { Colors } from './types';

export type RegistrationStatus = 'opens-soon' | 'open' | 'closed' | 'waiting-list';

export interface RegistrationStatusInput {
  registration_open?: string | null;
  registration_close?: string | null;
  accepted_registrations?: number | null;
  competitor_limit?: number | null;
}

const registrationStatusDisplay: Record<RegistrationStatus, { label: string; color: Colors }> = {
  'opens-soon': { label: 'Opens soon', color: Colors.blue },
  open: { label: 'Open', color: Colors.green },
  closed: { label: 'Closed', color: Colors.red },
  'waiting-list': { label: 'Waiting List', color: Colors.yellow },
};

// Registration status changes with time, so derive it from the stored dates.
export function getRegistrationStatus(
  competition: RegistrationStatusInput,
): RegistrationStatus | null {
  const {
    registration_open: registrationOpen,
    registration_close: registrationClose,
    accepted_registrations: acceptedRegistrations,
    competitor_limit: competitorLimit,
  } = competition;
  if (!registrationOpen || !registrationClose) return null;

  const now = moment.utc();
  if (moment.utc(registrationOpen).isAfter(now)) return 'opens-soon';
  if (moment.utc(registrationClose).isBefore(now)) return 'closed';
  if (competitorLimit != null && (acceptedRegistrations ?? 0) >= competitorLimit) {
    return 'waiting-list';
  }
  return 'open';
}

export function getRegistrationStatusLabel(status: RegistrationStatus): string {
  return registrationStatusDisplay[status].label;
}

export function getRegistrationStatusColor(status: RegistrationStatus): Colors {
  return registrationStatusDisplay[status].color;
}
