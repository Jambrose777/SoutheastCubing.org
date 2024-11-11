export class MapPoint {
  lat: number;
  long: number;
  id: string;
  colorClass?: MarkerColorClass;
}

export enum MarkerColorClass {
  blue = 'blue-marker',
  red = 'red-marker',
  orange = 'orange-marker',
  green = 'green-marker'
}
