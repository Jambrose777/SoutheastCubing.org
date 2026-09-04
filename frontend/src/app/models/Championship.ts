export class Championship {
  id: string;
  name: string;
  year: number;
  city: string;
  date: string;
  images: { path: string }[];
  logo: string;
  description: string;
  competitors: number;
  champions: Champion[];
  state: string;
}

export class Champion {
  year: number;
  event: string;
  seChampName: string;
  seChampResult: string;
  overallChampName: string;
  overallChampResult: string;
}
