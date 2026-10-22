import type {
  ClockFourRoundCompetition,
  ClockQualifyingPodium,
  ClockRecordMilestone,
  ClockResult,
  ClockSoutheastChampion,
  ClockSoutheastCompetition,
} from 'src/app/models/ClockResult';
import { formatLongDate } from 'src/app/shared/date.util';
import type {
  ClockResultsTableCell,
  ClockResultsTableResult,
  ClockResultsTableRow,
} from './clock-results-table/clock-results-table.component';
import { formatClockValue } from './clock-results.util';

type ClockResultCellSource = {
  resultId: string | null;
  competitionName: string;
  roundTypeId: string | null;
  personName: string | null;
  attempts: number[] | null;
  scrambles?: string[];
  value?: number;
  best?: number | null;
};

const RECORD_TEXT_COLORS: Partial<Record<string, 'blue' | 'red'>> = {
  WR: 'blue',
  FWR: 'blue',
  NAR: 'red',
  FNAR: 'red',
};

// Build rows for Clock competitions that contain four rounds.
export function buildClockFourRoundCompetitionRows(
  competitions: ClockFourRoundCompetition[],
  logoUrlsByAssetId: ReadonlyMap<string, string>,
): ClockResultsTableRow[] {
  return [...competitions]
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((competition) => ({
      id: competition.competitionId,
      competition: linkedCompetitionCell(competition.competitionId, competition.competitionName, {
        imageUrl: competition.logoAssetId
          ? logoUrlsByAssetId.get(competition.logoAssetId)
          : undefined,
        meta: `${formatLongDate(competition.date)} · ${competition.city}`,
      }),
      finalists: {
        text: '',
        links: competition.finalists.map((finalist) =>
          personCell(finalist.personName, finalist.wcaId),
        ),
      },
    }));
}

// Build the shared result row used for Southeast competition winners and champions.
export function buildClockSoutheastResultRow(
  record: ClockSoutheastCompetition | ClockSoutheastChampion,
  competitorColumn: 'winner' | 'champion',
  logoUrlsByAssetId: ReadonlyMap<string, string>,
): ClockResultsTableRow {
  const singleResult = resultCellData(record, 'single');
  const averageResult = resultCellData(record, 'average');
  const row: ClockResultsTableRow = {
    id: record.competitionId,
    video: { text: '', videoUrl: record.videoUrl },
    competition: linkedCompetitionCell(record.competitionId, record.competitionName, {
      imageUrl: record.logoAssetId ? logoUrlsByAssetId.get(record.logoAssetId) : undefined,
      meta: `${formatLongDate(record.date)} · ${record.city}`,
    }),
    single: record.best === null ? { text: '' } : clockValueCell(record.best),
    average: record.average === null ? { text: '' } : clockValueCell(record.average),
    state: record.wcaId ? stateCell(record.state, 'Unknown') : { text: '' },
    result: {
      ...(singleResult ? { single: singleResult } : {}),
      ...(averageResult ? { average: averageResult } : {}),
    },
  };
  row[competitorColumn] =
    record.wcaId && record.personName ? personCell(record.personName, record.wcaId) : { text: '' };
  return row;
}

// Build common result rows for the ranking, current-record, and milestone tables.
export function buildClockResultCells(
  record: Pick<
    ClockResult,
    | 'date'
    | 'rankingType'
    | 'value'
    | 'wcaId'
    | 'personName'
    | 'competitionId'
    | 'competitionName'
    | 'state'
    | 'competitionState'
    | 'videoUrl'
    | 'resultId'
    | 'roundTypeId'
    | 'attempts'
    | 'scrambles'
  >,
): Omit<ClockResultsTableRow, 'id'> {
  const result = resultCellData(record, record.rankingType);
  const valueCell = clockValueCell(record.value);
  return {
    date: { text: formatLongDate(record.date) },
    name: personCell(record.personName, record.wcaId),
    single: record.rankingType === 'single' ? valueCell : { text: '' },
    average: record.rankingType === 'average' ? valueCell : { text: '' },
    state: stateCell(record.state),
    competition: buildClockCompetitionCell(record),
    video: { text: '', videoUrl: record.videoUrl },
    ...(result ? { result: { [record.rankingType]: result } } : {}),
  };
}

// Map record milestones into date-ordered rows for the two record tables.
export function buildClockRecordMilestoneRows(
  records: ClockRecordMilestone[],
): ClockResultsTableRow[] {
  return [...records]
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((record) => {
      const result = { ...record, rankingType: record.metric };
      const row = buildClockResultCells(result);
      return {
        id: `${record.date}-${record.record}-${record.metric}-${record.wcaId}-${record.competitionId}`,
        ...row,
        record: { text: record.record, textColor: RECORD_TEXT_COLORS[record.record] },
      };
    });
}

// Reuse result formatting for each competitor in a qualifying podium.
export function buildClockPodiumCompetitorCells(
  competition: ClockQualifyingPodium,
  competitor: ClockQualifyingPodium['competitors'][number],
): {
  name: ClockResultsTableCell;
  average: ClockResultsTableCell;
  result?: ClockResultsTableResult;
} {
  const row = buildClockResultCells({
    date: competition.date,
    rankingType: 'average',
    value: competitor.average,
    wcaId: competitor.wcaId,
    personName: competitor.name,
    competitionId: competition.competitionId,
    competitionName: competition.competitionName,
    state: null,
    competitionState: competition.competitionState,
    resultId: competitor.resultId,
    roundTypeId: competitor.roundTypeId,
    attempts: competitor.attempts,
    scrambles: competitor.scrambles,
  });

  return {
    name: row.name ?? { text: '' },
    average: row.average ?? { text: '' },
    result: row.result?.['average'],
  };
}

// Build a linked competition cell with its state pill metadata.
export function buildClockCompetitionCell(
  competition: Pick<ClockResult, 'competitionId' | 'competitionName' | 'competitionState'>,
): ClockResultsTableCell {
  return {
    ...linkedCompetitionCell(competition.competitionId, competition.competitionName),
    pill: true,
    pillState: competition.competitionState,
  };
}

function linkedCompetitionCell(
  competitionId: string,
  competitionName: string,
  details: Pick<ClockResultsTableCell, 'imageUrl' | 'meta'> = {},
): ClockResultsTableCell {
  return {
    text: competitionName,
    href: `https://www.worldcubeassociation.org/competitions/${competitionId}`,
    ...details,
  };
}

function personCell(personName: string, wcaId: string | null): ClockResultsTableCell {
  return {
    text: personName,
    ...(wcaId ? { href: `https://www.worldcubeassociation.org/persons/${wcaId}` } : {}),
  };
}

function clockValueCell(value: number): ClockResultsTableCell {
  return { text: formatClockValue(value) };
}

function resultCellData(
  result: ClockResultCellSource,
  resultType: 'single' | 'average',
): ClockResultsTableResult | undefined {
  const { resultId, competitionName, roundTypeId, personName, attempts, scrambles } = result;
  if (!resultId || !roundTypeId || !attempts) return undefined;
  let resultScrambles = scrambles;
  if (resultType === 'single' && scrambles && scrambles.length > 1) {
    const singleValue = result.value ?? result.best;
    let attemptIndex =
      singleValue === undefined || singleValue === null
        ? -1
        : attempts.findIndex((attempt) => attempt === singleValue);
    if (attemptIndex < 0) {
      let bestAttempt = Infinity;
      attempts.forEach((attempt, index) => {
        if (attempt > 0 && attempt < bestAttempt) {
          attemptIndex = index;
          bestAttempt = attempt;
        }
      });
    }
    if (attemptIndex < 0 && attempts.length > 0) attemptIndex = 0;
    resultScrambles =
      attemptIndex >= 0 && attemptIndex < scrambles.length ? [scrambles[attemptIndex]] : [];
  }
  return {
    resultId,
    competitionName,
    roundTypeId,
    resultType,
    personName: personName ?? '',
    attempts,
    ...(resultScrambles ? { scrambles: resultScrambles } : {}),
  };
}

function stateCell(state: string | null, fallback = ''): ClockResultsTableCell {
  return { text: state ?? fallback, pill: true, pillState: state };
}
