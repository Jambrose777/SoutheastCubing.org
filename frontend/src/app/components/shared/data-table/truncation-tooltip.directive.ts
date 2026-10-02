import { Directive, DoCheck, ElementRef, inject } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';

const CLAMPED_LINE_COUNT = 2;

// Sub-pixel/font-rendering rounding alone routinely produces a few px of
// `scrollWidth`/`scrollHeight` "overflow" even on content that isn't
// actually missing any visible characters - this is the slack subtracted
// out before treating that overflow as real truncation.
const OVERFLOW_TOLERANCE_PX = 2;

// Shows the same `matTooltip` for a cell's full text, but only once it's
// actually been clamped/truncated.
@Directive({
  selector: '[seTruncationTooltip]',
  hostDirectives: [MatTooltip],
})
export class TruncationTooltipDirective implements DoCheck {
  private el = inject(ElementRef<HTMLElement>).nativeElement;
  private tooltip = inject(MatTooltip, { self: true });
  private lastCheckedText: string | null = null;

  constructor() {
    this.tooltip.position = 'above';
    this.tooltip.disabled = true;
  }

  ngDoCheck(): void {
    const text = (this.el.textContent ?? '').trim();
    if (text === this.lastCheckedText) return;
    this.lastCheckedText = text;

    if (!text) {
      this.tooltip.disabled = true;
      return;
    }

    const style = getComputedStyle(this.el);
    const naturalTwoLineHeight =
      parseFloat(style.lineHeight) * CLAMPED_LINE_COUNT +
      parseFloat(style.paddingTop) +
      parseFloat(style.paddingBottom);
    const isTruncated =
      this.el.scrollHeight > naturalTwoLineHeight + OVERFLOW_TOLERANCE_PX ||
      this.el.scrollWidth > this.el.clientWidth + OVERFLOW_TOLERANCE_PX;
    this.tooltip.disabled = !isTruncated;
    this.tooltip.message = text;
  }
}
