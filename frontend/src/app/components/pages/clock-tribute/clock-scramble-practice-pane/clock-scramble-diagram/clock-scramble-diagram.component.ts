import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  input,
  OnDestroy,
  viewChild,
} from '@angular/core';
import type { KPuzzle } from 'cubing/kpuzzle';
import type { ExperimentalSVGAnimator } from 'cubing/twisty';

@Component({
  selector: 'se-clock-scramble-diagram',
  templateUrl: './clock-scramble-diagram.component.html',
  styleUrl: './clock-scramble-diagram.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClockScrambleDiagramComponent implements OnDestroy {
  scramble = input.required<string>();
  private readonly playerHost = viewChild<ElementRef<HTMLDivElement>>('playerHost');
  private animator: ExperimentalSVGAnimator | null = null;
  private kpuzzle: KPuzzle | null = null;
  private destroyed = false;

  constructor() {
    afterNextRender(() => void this.createDiagram());
    effect(() => {
      const scramble = this.scramble();
      this.drawScramble(scramble);
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.animator?.wrapperElement.remove();
    this.animator = null;
    this.kpuzzle = null;
  }

  // Load cubing.js's Clock SVG and state model, then draw the current scramble.
  private async createDiagram(): Promise<void> {
    const host = this.playerHost()?.nativeElement;
    if (!host) return;

    const [{ puzzles }, { ExperimentalSVGAnimator }] = await Promise.all([
      import('cubing/puzzles'),
      import('cubing/twisty'),
    ]);
    const [kpuzzle, svgSource] = await Promise.all([
      puzzles['clock'].kpuzzle(),
      puzzles['clock'].svg(),
    ]);
    if (this.destroyed) return;

    this.kpuzzle = kpuzzle;
    const animator = new ExperimentalSVGAnimator(kpuzzle, svgSource);
    const backSideLabel = animator.svgElement.querySelector('rect[width="128"][height="24"]');
    backSideLabel?.parentElement?.remove();
    const backSide = animator.svgElement.querySelector(
      'g[transform="translate(264, 24) scale(0.8)"]',
    );
    backSide?.setAttribute('transform', 'translate(264, 24)');
    animator.svgElement.setAttribute('viewBox', '0 0 480 220');
    const diagramArtwork = animator.svgElement.querySelector(':scope > g');
    diagramArtwork?.setAttribute('transform', 'translate(-12, -16) scale(1.05)');
    Object.assign(animator.wrapperElement.style, { width: '100%', height: '100%' });
    Object.assign(animator.svgElement.style, { display: 'block', width: '100%', height: '100%' });
    this.animator = animator;
    host.replaceChildren(animator.wrapperElement);
    this.drawScramble(this.scramble());
  }

  // Apply the selected scramble through cubing.js's Clock state model.
  private drawScramble(scramble: string): void {
    if (!this.animator || !this.kpuzzle) return;
    this.animator.drawPattern(this.kpuzzle.defaultPattern().applyAlg(scramble));
  }
}
