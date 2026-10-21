import { Directive, ElementRef, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ClockVideoPlaybackService } from './clock-video-playback.service';

interface ExpandedClockVideo {
  rowId: string;
  url: string;
  embedUrl: ReturnType<ClockVideoPlaybackService['embedUrlFor']>;
}

// Coordinate player state and row scrolling for either Clock results table.
@Directive({
  selector: '[seClockVideoTable]',
  exportAs: 'clockVideoTable',
  standalone: true,
})
export class ClockVideoTableDirective {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly videoPlaybackService = inject(ClockVideoPlaybackService);
  private readonly tableToken = Symbol();
  private readonly activeVideo = toSignal(this.videoPlaybackService.activeVideo$, {
    initialValue: null,
  });

  readonly expandedTableHeight = signal<number | null>(null);
  readonly expandedVideo = computed<ExpandedClockVideo | null>(() => {
    const activeVideo = this.activeVideo();
    if (activeVideo?.owner !== this.tableToken) return null;

    return {
      ...activeVideo,
      embedUrl: this.videoPlaybackService.embedUrlFor(activeVideo.url),
    };
  });

  // Toggle a row's video and size the table after the player row renders.
  toggleVideo(rowId: string, videoUrl: string): void {
    const scrollElement = this.elementRef.nativeElement as HTMLElement;
    const currentTableHeight = scrollElement.clientHeight;
    const result = this.videoPlaybackService.toggle(this.tableToken, rowId, videoUrl);
    if (result === 'invalid') return;
    if (result === 'closed') {
      this.expandedTableHeight.set(null);
      return;
    }

    this.expandedTableHeight.set(currentTableHeight);
    requestAnimationFrame(() => this.sizeExpandedVideoAndScroll(rowId, currentTableHeight));
  }

  // Preserve the table height or expand to fit the row and player, then align the result row.
  private sizeExpandedVideoAndScroll(rowId: string, currentTableHeight: number): void {
    const scrollElement = this.elementRef.nativeElement as HTMLElement;
    const header = scrollElement.querySelector<HTMLElement>('thead');
    const resultRow = Array.from(
      scrollElement.querySelectorAll<HTMLTableRowElement>('[data-clock-result-row]'),
    ).find((row) => row.dataset['clockResultRow'] === rowId);
    const videoRow = resultRow?.nextElementSibling as HTMLTableRowElement | null;
    if (!header || !resultRow || !videoRow) return;

    const expandedContentHeight =
      header.offsetHeight + resultRow.offsetHeight + videoRow.offsetHeight;
    this.expandedTableHeight.set(Math.max(currentTableHeight, expandedContentHeight));
    requestAnimationFrame(() => {
      const headerHeight = header.offsetHeight;
      const rowTop = resultRow.getBoundingClientRect().top;
      const scrollTop = scrollElement.getBoundingClientRect().top;
      scrollElement.scrollTo({
        top: scrollElement.scrollTop + rowTop - scrollTop - headerHeight,
        behavior: 'smooth',
      });
    });
  }
}
