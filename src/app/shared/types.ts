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
}

export const StateColors = {
  'Alabama': Colors.orange,
  'Georgia': Colors.blue,
  'Florida': Colors.red,
  'North Carolina': Colors.green,
  'South Carolina': Colors.purple,
  'Tennessee': Colors.yellow,
}

export  enum RegistrationStatus {
  preLaunch = 'preLaunch',
  open = 'open',
  closed = 'closed',
  openWithSpots = 'openWithSpots',
  openWithWaitingList = 'openWithWaitingList'
}
