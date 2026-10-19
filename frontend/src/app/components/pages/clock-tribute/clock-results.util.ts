// Display Clock centiseconds as seconds and negative WCA result sentinels as DNF.
export function formatClockValue(value: number): string {
  if (value < 0) return 'DNF';
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, '0')}`;
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
