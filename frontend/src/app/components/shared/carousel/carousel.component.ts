import {
  Component,
  ChangeDetectionStrategy,
  input,
  signal,
  computed,
  effect,
  inject,
  DestroyRef,
} from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

@Component({
  selector: 'se-carousel',
  templateUrl: './carousel.component.html',
  styleUrls: ['./carousel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage],
})
export class CarouselComponent {
  images = input.required<string[]>();
  height = input.required<number>();
  loop = input(false);
  autoplay = input(false);
  arrows = input(true);

  // Default autoplay interval, between automatic slide advances.
  private static readonly AUTOPLAY_INTERVAL_MS = 5000;

  // Position within slides() (not images())
  trackIndex = signal(0);

  // Briefly disables the track's CSS transition while snapping from a
  // cloned end slide back to its real counterpart, so that snap itself is
  // invisible to the user (see onTransitionEnd()).
  suppressTransition = signal(false);

  // When looping, a clone of the last image is prepended and a clone of the
  // first image is appended, so wrapping from one end to the other can keep
  // sliding in the same direction as every other transition (translateX
  // just keeps increasing/decreasing). onTransitionEnd() then snaps from a
  // clone to its real counterpart once that slide finishes, so the illusion
  // holds indefinitely. Ignored for a single image.
  slides = computed(() => {
    const imgs = this.images();
    if (!this.loop() || imgs.length <= 1) {
      return imgs;
    }
    return [imgs[imgs.length - 1], ...imgs, imgs[0]];
  });

  // The real first image sits one slot later than index 0 while looping,
  // since slides() prepends a clon,
  initialTrackIndex = computed(() => (this.loop() && this.images().length > 1 ? 1 : 0));

  // Disables the arrows at either end when not looping, so the control
  // layout stays stable. Looping carousels never disable their arrows.
  isAtStart = computed(() => !this.loop() && this.trackIndex() <= 0);
  isAtEnd = computed(() => !this.loop() && this.trackIndex() >= this.images().length - 1);

  // Background tabs suspend rendering.
  private isPageVisible = signal(!document.hidden);

  constructor() {
    // Keep isPageVisible in sync with the tab's actual visibility.
    const destroyRef = inject(DestroyRef);
    const onVisibilityChange = () => this.isPageVisible.set(!document.hidden);
    document.addEventListener('visibilitychange', onVisibilityChange);
    destroyRef.onDestroy(() =>
      document.removeEventListener('visibilitychange', onVisibilityChange),
    );

    // Jump back to the first image whenever the image set itself changes
    // (e.g. a different championship gets selected).
    effect(() => {
      this.trackIndex.set(this.initialTrackIndex());
    });

    // (Re)start the autoplay timer whenever autoplay/loop/images/page-
    // visibility changes, relying on the effect's cleanup callback to clear
    // the previous interval first so there's never more than one running
    // at once.
    effect((onCleanup) => {
      if (!this.autoplay() || this.images().length <= 1 || !this.isPageVisible()) {
        return;
      }
      const intervalId = setInterval(() => this.next(), CarouselComponent.AUTOPLAY_INTERVAL_MS);
      onCleanup(() => clearInterval(intervalId));
    });
  }

  // Advances to the next slide.
  next(): void {
    if (this.images().length === 0) {
      return;
    }
    if (!this.loop()) {
      const nextIndex = this.trackIndex() + 1;
      if (nextIndex < this.images().length) {
        this.trackIndex.set(nextIndex);
      }
      return;
    }
    if (this.images().length <= 1) {
      return;
    }
    this.trackIndex.set(this.trackIndex() + 1);
  }

  // Moves to the previous slide.
  previous(): void {
    if (this.images().length === 0) {
      return;
    }
    if (!this.loop()) {
      const previousIndex = this.trackIndex() - 1;
      if (previousIndex >= 0) {
        this.trackIndex.set(previousIndex);
      }
      return;
    }
    if (this.images().length <= 1) {
      return;
    }
    this.trackIndex.set(this.trackIndex() - 1);
  }

  // Fires when the track's transform transition finishes. If that
  // transition landed on a cloned slide (one past either real end), snap
  // - without animating - to the real slide it's a clone of.
  onTransitionEnd(): void {
    if (!this.loop()) {
      return;
    }
    const lastIndex = this.slides().length - 1;
    const index = this.trackIndex();
    if (index === lastIndex) {
      this.snapTo(1);
    } else if (index === 0) {
      this.snapTo(lastIndex - 1);
    }
  }

  // Jumps straight to index with the transition disabled.
  private snapTo(index: number): void {
    this.suppressTransition.set(true);
    this.trackIndex.set(index);
    // Re-enable the transition only after the browser has painted the
    // untransitioned snap - otherwise the next real navigation would
    // visibly animate from the wrong starting point.
    requestAnimationFrame(() => this.suppressTransition.set(false));
  }
}
