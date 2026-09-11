export interface Championship {
  id: string;
  name: string;
  championshipType: string;
  year: number;
  cityState: string;
  city: string;
  date: string;
  images: { path: string }[];
  logo?: string;
  logoWidth?: number;
  logoHeight?: number;
  description?: string;
  competitors?: number;
  champions: Champion[];
  state: string;
}

export interface Champion {
  year: number;
  event: string;
  seChampName?: string; // refers to both SE and State Champion
  seChampResult?: string; // refers to both SE and State Champion
  overallChampName?: string;
  overallChampResult?: string;
}
