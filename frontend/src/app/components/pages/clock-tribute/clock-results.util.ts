// Display Clock centiseconds as seconds and negative WCA result sentinels as DNF.
export function formatClockValue(value: number): string {
  if (value < 0) return 'DNF';
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, '0')}`;
}

export type ClockAttemptValue = number | 'DNF' | null;

// Select the first best and worst attempts, leaving one attempt for each extreme.
export function droppedClockAttemptIndexes(attempts: ClockAttemptValue[]): Set<number> {
  if (attempts.length !== 5) return new Set();
  const completedIndexes = attempts.flatMap((attempt, index) => (attempt === null ? [] : [index]));
  if (completedIndexes.length < 2) return new Set();

  const numericAttempts = attempts.flatMap((attempt, index) =>
    typeof attempt === 'number' ? [{ index, value: attempt }] : [],
  );
  const fastestValue =
    numericAttempts.length > 0 ? Math.min(...numericAttempts.map(({ value }) => value)) : null;
  const fastestIndex =
    fastestValue === null
      ? -1
      : (numericAttempts.find(({ value }) => value === fastestValue)?.index ?? -1);
  const firstDnfIndex = attempts.findIndex((attempt) => attempt === 'DNF');
  let slowestIndex = firstDnfIndex;

  if (slowestIndex < 0 && numericAttempts.length > 0) {
    const slowestValue = Math.max(...numericAttempts.map(({ value }) => value));
    slowestIndex =
      numericAttempts.find(({ index, value }) => value === slowestValue && index !== fastestIndex)
        ?.index ?? -1;
  }

  return new Set([fastestIndex, slowestIndex].filter((index) => index >= 0));
}

// Calculate an average after dropping the selected best and worst attempts.
export function averageAttemptValues(attempts: ClockAttemptValue[]): number | 'DNF' | null {
  if (attempts.length !== 3 && attempts.length !== 5) return null;
  if (attempts.some((attempt) => attempt === null)) return null;

  const dnfCount = attempts.filter((attempt) => attempt === 'DNF').length;
  if (attempts.length === 3) {
    if (dnfCount > 0) return 'DNF';
    const numericAttempts = attempts.filter(
      (attempt): attempt is number => typeof attempt === 'number',
    );
    return Math.round(numericAttempts.reduce((total, attempt) => total + attempt, 0) / 3);
  }
  if (dnfCount >= 2) return 'DNF';

  const droppedAttempts = droppedClockAttemptIndexes(attempts);
  const middleAttempts = attempts.filter(
    (attempt, index): attempt is number =>
      !droppedAttempts.has(index) && typeof attempt === 'number',
  );
  if (middleAttempts.length !== 3) return 'DNF';
  return Math.round(middleAttempts.reduce((total, attempt) => total + attempt, 0) / 3);
}

// Format attempts in competition order and mark the first dropped best and worst attempts.
export function formatClockAttempts(attempts: number[]): string {
  const droppedAttempts = droppedClockAttemptIndexes(
    attempts.map((attempt) => (attempt < 0 ? 'DNF' : attempt)),
  );

  return attempts
    .map((attempt, index) => {
      const formattedAttempt = formatClockValue(attempt);
      return droppedAttempts.has(index) ? `(${formattedAttempt})` : formattedAttempt;
    })
    .join(', ');
}

// Keep the scramble action label singular only when one scramble is available.
export function clockScrambleLabel(scrambles: string[] | undefined): string {
  return scrambles?.length === 1 ? 'Try the Scramble' : 'Try the Scrambles';
}

// Map Southeast states to the Clock Tribute table pill classes.
export function clockStatePillClass(state: string | null | undefined): string {
  const stateClasses: Record<string, string> = {
    Alabama: 'clock-results-pill--alabama',
    Florida: 'clock-results-pill--florida',
    Georgia: 'clock-results-pill--georgia',
    'North Carolina': 'clock-results-pill--north-carolina',
    'South Carolina': 'clock-results-pill--south-carolina',
    Tennessee: 'clock-results-pill--tennessee',
  };
  return stateClasses[state ?? ''] ?? 'clock-results-pill--unknown';
}
