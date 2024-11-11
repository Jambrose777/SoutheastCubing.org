export class MapPoint {
  lat: number;
  long: number;
  id: string;
  colorClass?: MarkerColorClass;
}

export enum MarkerColorClass {
  blue = 'blue-marker',
  red = 'red-marker',
  yellow = 'yellow-marker',
  green = 'green-marker'
}
