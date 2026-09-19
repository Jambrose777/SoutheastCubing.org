export enum Colors {
  black = '#1A1A18',
  blue = '#9AC1CB',
  darkGrey = '#798897',
  green = '#6AA076',
  grey = '#DFE0DF',
  yellow = '#F1E3C0',
  purple = '#BCABE3',
  orange = '#FFA460',
  red = '#E69291',
  white = 'white',
}

export enum RegistrationStatus {
  preLaunch = 'preLaunch',
  closed = 'closed',
  openWithSpots = 'openWithSpots',
  openWithWaitingList = 'openWithWaitingList',
  open = 'open',
}

export const StateColors: Record<string, Colors> = {
  Alabama: Colors.orange,
  AL: Colors.orange,
  Georgia: Colors.blue,
  GA: Colors.blue,
  Florida: Colors.red,
  FL: Colors.red,
  'North Carolina': Colors.green,
  NC: Colors.green,
  'South Carolina': Colors.purple,
  SC: Colors.purple,
  Tennessee: Colors.yellow,
  TN: Colors.yellow,
  Southeast: Colors.purple,
  '??': Colors.grey,
  '???': Colors.grey,
};

export enum States {
  AL = 'Alabama',
  FL = 'Florida',
  GA = 'Georgia',
  NC = 'North Carolina',
  SC = 'South Carolina',
  TN = 'Tennessee',
}

export enum EmailType {
  clubs = 'clubs',
  upcomingCompetition = 'upcomingCompetition',
  pastCompetition = 'pastCompetition',
  general = 'general',
  getInvolved = 'getInvolved',
  socialMedia = 'socialMedia',
  software = 'software',
  organizing = 'organizing',
}

export enum EmailApiStatus {
  none = 'none',
  pending = 'pending',
  success = 'success',
  failure = 'failure',
  doubleFailure = 'doubleFailure',
}

export const Events = [
  '333',
  '222',
  '444',
  '555',
  '666',
  '777',
  '333bf',
  '333fm',
  '333oh',
  'clock',
  'fto',
  'minx',
  'pyram',
  'skewb',
  'sq1',
  '444bf',
  '555bf',
  '333mbf',
];

// Human-readable names for each WCA event id in `Events`
export const EventNames: Record<string, string> = {
  '333': '3x3x3 Cube',
  '222': '2x2x2 Cube',
  '444': '4x4x4 Cube',
  '555': '5x5x5 Cube',
  '666': '6x6x6 Cube',
  '777': '7x7x7 Cube',
  '333bf': '3x3x3 Blindfolded',
  '333fm': '3x3x3 Fewest Moves',
  '333oh': '3x3x3 One-Handed',
  clock: 'Clock',
  fto: 'Face-Turning Octahedron',
  minx: 'Megaminx',
  pyram: 'Pyraminx',
  skewb: 'Skewb',
  sq1: 'Square-1',
  '444bf': '4x4x4 Blindfolded',
  '555bf': '5x5x5 Blindfolded',
  '333mbf': '3x3x3 Multi-Blind',
};
