// WCA result records.
export interface ClockResult {
  resultId: string;
  roundTypeId: string;
  date: string;
  rankingType: 'single' | 'average';
  wcaId: string;
  personName: string;
  rank: number;
  value: number;
  competitionId: string;
  competitionName: string;
  city: string;
  state: string | null;
  competitionState?: string | null;
  videoUrl?: string;
  attempts: number[];
  scrambles?: string[];
}

export interface ClockCurrentRecords {
  single: ClockResult;
  average: ClockResult;
}

export type ClockRecordMilestone = Omit<ClockResult, 'rank' | 'rankingType'> & {
  record: string;
  metric: ClockResult['rankingType'];
};

export interface ClockPodiumCompetitor {
  resultId: string;
  roundTypeId: string;
  place: number;
  wcaId: string;
  name: string;
  average: number;
  attempts: number[];
  scrambles?: string[];
}

export interface ClockQualifyingPodium {
  competitionId: string;
  competitionName: string;
  date: string;
  competitionState: string;
  score: number;
  rank: number;
  competitors: [ClockPodiumCompetitor, ClockPodiumCompetitor, ClockPodiumCompetitor];
}

export interface ClockChampionshipType {
  championshipId: string;
  championshipType: string;
}

export interface ClockChampionshipFinalist {
  resultId: string;
  roundTypeId: string;
  wcaId: string;
  personName: string;
  personCountryId: string;
  place: number;
  best: number;
  average: number;
  state: string;
  attempts: number[];
  videoUrl?: string;
  scrambles?: string[];
}

export interface ClockMajorChampionship {
  competitionId: string;
  logoAssetId?: string;
  competitionName: string;
  date: string;
  championships: ClockChampionshipType[];
  year: string;
  finalists: ClockChampionshipFinalist[];
  city: string;
  state: string | null;
}

export interface ClockSoutheastCompetition {
  competitionId: string;
  resultId: string | null;
  roundTypeId: string | null;
  logoAssetId?: string;
  competitionName: string;
  date: string;
  city: string;
  wcaId: string | null;
  personName: string | null;
  state: string | null;
  best: number | null;
  average: number | null;
  attempts: number[] | null;
  videoUrl?: string;
  scrambles?: string[];
}

export interface ClockFourRoundFinalist {
  personName: string;
  wcaId: string | null;
}

export interface ClockFourRoundCompetition {
  competitionId: string;
  logoAssetId?: string;
  competitionName: string;
  date: string;
  city: string;
  state: string;
  finalists: ClockFourRoundFinalist[];
}

export interface ClockSoutheastChampion {
  competitionId: string;
  resultId: string;
  roundTypeId: string;
  competitionName: string;
  date: string;
  city: string;
  logoAssetId: string;
  wcaId: string;
  personName: string;
  state: string | null;
  best: number;
  average: number;
  attempts: number[];
  videoUrl?: string;
  scrambles?: string[];
}

export interface ClockRankings {
  rankLimit: number;
  results: ClockResult[];
}

export interface ClockStatistics {
  metadata: {
    exportDate: string;
  };
  rankings: ClockRankings;
  currentRecords: ClockCurrentRecords;
  femaleRecordAchievements: ClockRecordMilestone[];
  regionalRecords: ClockRecordMilestone[];
  podiums: {
    qualifyingPodiums: ClockQualifyingPodium[];
  };
  majorChampionships: ClockMajorChampionship[];
  southeastCompetitions: ClockSoutheastCompetition[];
  fourRoundClockCompetitions: ClockFourRoundCompetition[];
  southeastChampions: ClockSoutheastChampion[];
}
