import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  HostListener,
  input,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import {
  averageAttemptValues,
  droppedClockAttemptIndexes,
  formatClockValue,
} from '../clock-results.util';
import type { ClockAttemptValue } from '../clock-results.util';
import type { ClockResultsTableResult } from '../clock-results-table/clock-results-table.component';
import { ClockScrambleDiagramComponent } from './clock-scramble-diagram/clock-scramble-diagram.component';

type TimerPhase = 'idle' | 'ready' | 'running';

const ROUND_NAME_BY_ID: Record<string, string> = {
  '1': 'First round',
  '2': 'Second round',
  '3': 'Semi Final',
  c: 'Final',
  d: 'First round',
  f: 'Final',
};

@Component({
  selector: 'se-clock-scramble-practice-pane',
  templateUrl: './clock-scramble-practice-pane.component.html',
  styleUrls: ['./clock-scramble-practice-pane.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ClockScrambleDiagramComponent],
})
export class ClockScramblePracticePaneComponent implements OnDestroy {
  result = input.required<ClockResultsTableResult>();
  readonly selectedAttemptIndex = signal(0);
  readonly userResults = signal<ClockAttemptValue[]>([]);
  readonly lastCompletedAttemptIndex = signal<number | null>(null);
  readonly timerPhase = signal<TimerPhase>('idle');
  readonly timerCentiseconds = signal(0);
  readonly formatClockValue = formatClockValue;
  private readonly timerDisplay = viewChild<ElementRef<HTMLOutputElement>>('timerDisplay');
  private currentResultId: string | null = null;
  private timerStartedAt: number | null = null;
  private timerIntervalId: number | null = null;

  constructor() {
    // Focus the timer as soon as this pane is rendered so Space works immediately.
    afterNextRender(() => this.timerDisplay()?.nativeElement.focus());
    effect(() => {
      const result = this.result();
      if (result.resultId === this.currentResultId) return;
      this.currentResultId = result.resultId;
      this.resetForResult(result);
    });
  }

  // Stop timer updates when the pane closes so all practice state remains temporary.
  ngOnDestroy(): void {
    this.clearTimerInterval();
  }

  // Expose attempt indices for the row loop in attempt order.
  attemptIndexes(): number[] {
    return this.result().scrambles?.map((_, index) => index) ?? [];
  }

  // Return the active scramble in the original WCA notation for the diagram.
  selectedScramble(): string | null {
    return this.result().scrambles?.[this.selectedAttemptIndex()] ?? null;
  }

  // Hide standalone trailing direction tokens without changing the stored scramble.
  scrambleText(index: number): string {
    return (this.result().scrambles?.[index] ?? '').replace(/(?:\s+(?:UR|DR|DL|UL))+\s*$/, '');
  }

  // Use the result competitor's first name as the WCA attempt column heading.
  resultFirstName(): string {
    return this.result().personName.trim().split(/\s+/)[0] || 'Result';
  }

  // Resolve known WCA round IDs to their display names.
  roundName(): string | null {
    return ROUND_NAME_BY_ID[this.result().roundTypeId] ?? null;
  }

  // Format the original WCA attempt and mark dropped average extremes.
  wcaAttemptText(index: number): string {
    const result = this.result();
    const attemptIndex = result.resultType === 'single' ? this.bestSingleAttemptIndex() : index;
    const attempt = result.attempts[attemptIndex];
    if (attempt === undefined) return '-';
    const droppedAttempts =
      result.resultType === 'average'
        ? droppedClockAttemptIndexes(result.attempts.map((value) => (value < 0 ? 'DNF' : value)))
        : new Set<number>();
    return this.parenthesizeAttempt(formatClockValue(attempt), attemptIndex, droppedAttempts);
  }

  // Format the user's time, including partial best/worst markers and DNF values.
  userAttemptText(index: number): string {
    const attempt = this.userResults()[index];
    if (attempt === null || attempt === undefined) return '-';
    const droppedAttempts = droppedClockAttemptIndexes(this.userResults());
    const text = attempt === 'DNF' ? 'DNF' : formatClockValue(attempt);
    return this.parenthesizeAttempt(text, index, droppedAttempts);
  }

  // Calculate and format the source average from the ordered WCA attempts.
  originalAverageText(): string {
    const average = averageAttemptValues(
      this.result().attempts.map((attempt) => (attempt < 0 ? 'DNF' : attempt)),
    );
    return average === null ? '-' : average === 'DNF' ? average : formatClockValue(average);
  }

  // Keep the user average unavailable until every attempt has a time or DNF result.
  userAverageText(): string {
    const average = averageAttemptValues(this.userResults());
    return average === null ? '-' : average === 'DNF' ? average : formatClockValue(average);
  }

  // Cancel an active solve before selecting another attempt, preserving recorded results.
  selectAttempt(index: number): void {
    if (index < 0 || index >= this.attemptIndexes().length || index === this.selectedAttemptIndex())
      return;
    this.cancelTimer();
    this.selectedAttemptIndex.set(index);
  }

  // Replace the most recently completed user time with DNF.
  markPreviousDnf(): void {
    const previousIndex = this.lastCompletedAttemptIndex();
    if (previousIndex === null) return;
    const nextResults = [...this.userResults()];
    nextResults[previousIndex] = 'DNF';
    this.userResults.set(nextResults);
  }

  // Name the attempt targeted by the previous-result DNF action.
  previousDnfAriaLabel(): string {
    const previousIndex = this.lastCompletedAttemptIndex();
    return previousIndex === null
      ? 'Mark the previous attempt as DNF'
      : `Mark attempt ${previousIndex + 1} as DNF`;
  }

  // Put the timer into its ready state on Space down and stop a running solve on the next press.
  @HostListener('document:keydown', ['$event'])
  onSpaceDown(event: KeyboardEvent): void {
    if (event.code !== 'Space' || this.isInteractiveTarget(event.target)) return;
    event.preventDefault();
    if (event.repeat) return;

    if (this.timerPhase() === 'running') {
      this.finishTimedAttempt();
    } else if (this.timerPhase() === 'idle') {
      this.timerPhase.set('ready');
    }
  }

  // Start timing only when Space is released from the ready state.
  @HostListener('document:keyup', ['$event'])
  onSpaceUp(event: KeyboardEvent): void {
    if (event.code !== 'Space' || this.timerPhase() !== 'ready') return;
    event.preventDefault();
    this.startTimer();
  }

  // Accessible text for the focusable timer display.
  timerAccessibleLabel(): string {
    return this.timerPhase() === 'ready'
      ? 'Timer ready'
      : `Timer ${formatClockValue(this.timerCentiseconds())}`;
  }

  // Reset all in-memory solve state when another result is selected.
  private resetForResult(result: ClockResultsTableResult): void {
    this.cancelTimer();
    this.selectedAttemptIndex.set(0);
    this.lastCompletedAttemptIndex.set(null);
    this.userResults.set(Array(result.scrambles?.length ?? 0).fill(null));
  }

  // Align a single's sole scramble with its first fastest recorded WCA attempt.
  private bestSingleAttemptIndex(): number {
    let bestIndex = -1;
    let bestValue = Infinity;
    this.result().attempts.forEach((attempt, index) => {
      if (attempt > 0 && attempt < bestValue) {
        bestIndex = index;
        bestValue = attempt;
      }
    });
    return bestIndex >= 0 ? bestIndex : this.result().attempts.length > 0 ? 0 : -1;
  }

  // Begin a new solve from zero and refresh the displayed centiseconds.
  private startTimer(): void {
    this.timerStartedAt = performance.now();
    this.timerCentiseconds.set(0);
    this.timerPhase.set('running');
    this.timerIntervalId = window.setInterval(() => {
      if (this.timerStartedAt === null) return;
      this.timerCentiseconds.set(Math.round((performance.now() - this.timerStartedAt) / 10));
    }, 10);
  }

  // Round a completed solve to the nearest hundredth and replace the selected result.
  private finishTimedAttempt(): void {
    if (this.timerStartedAt === null) return;
    const elapsed = Math.round((performance.now() - this.timerStartedAt) / 10);
    this.clearTimerInterval();
    this.timerStartedAt = null;
    this.timerPhase.set('idle');
    this.timerCentiseconds.set(elapsed);
    this.recordUserResult(elapsed);
  }

  // Replace one user result and advance cyclically to the next unfinished average attempt.
  private recordUserResult(value: number | 'DNF'): void {
    const currentIndex = this.selectedAttemptIndex();
    const nextResults = [...this.userResults()];
    nextResults[currentIndex] = value;
    this.userResults.set(nextResults);
    this.lastCompletedAttemptIndex.set(currentIndex);

    if (this.result().resultType !== 'average') return;
    for (let offset = 1; offset <= nextResults.length; offset += 1) {
      const nextIndex = (currentIndex + offset) % nextResults.length;
      if (nextResults[nextIndex] !== null) continue;
      this.selectedAttemptIndex.set(nextIndex);
      this.timerCentiseconds.set(0);
      return;
    }
  }

  // Cancel the current solve and reset the timer display without changing recorded results.
  private cancelTimer(): void {
    this.clearTimerInterval();
    this.timerStartedAt = null;
    this.timerPhase.set('idle');
    this.timerCentiseconds.set(0);
  }

  // Stop the periodic timer refresh, if one is active.
  private clearTimerInterval(): void {
    if (this.timerIntervalId === null) return;
    window.clearInterval(this.timerIntervalId);
    this.timerIntervalId = null;
  }

  // Ignore Space shortcuts when a native interactive control should handle the key.
  private isInteractiveTarget(target: EventTarget | null): boolean {
    return (
      target instanceof HTMLElement &&
      target.closest('button, a, input, select, textarea, [contenteditable="true"]') !== null
    );
  }

  // Add parentheses to one selected dropped attempt.
  private parenthesizeAttempt(text: string, index: number, droppedAttempts: Set<number>): string {
    return droppedAttempts.has(index) ? `(${text})` : text;
  }
}
