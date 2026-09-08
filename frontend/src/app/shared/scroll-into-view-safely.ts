import { afterNextRender, Injector } from '@angular/core';

// Selecting an item (via list click or map hover) can update signals that
// Angular hasn't yet reflected in the DOM, so `document.getElementById`
// would find nothing (or the pre-update element) if queried immediately.
// `afterNextRender` schedules the lookup to run once Angular has actually
// finished applying the resulting DOM update.
export function scrollIntoViewSafely(
  elementId: string,
  injector: Injector,
  onlyIfNotVisible = false,
  options: ScrollIntoViewOptions = { behavior: 'smooth' },
): void {
  afterNextRender(
    () => {
      const target = document.getElementById(elementId);
      if (!target) {
        return;
      }

      // Map hover events fire continuously as the cursor moves, so only scroll
      // when the target is actually out of view - otherwise re-scrolling an
      // already-visible list item on every hover fights the user's own manual
      // scrolling.
      if (onlyIfNotVisible) {
        const rect = target.getBoundingClientRect();
        const isVisible = rect.bottom <= window.innerHeight && rect.top >= 0;
        if (isVisible) {
          return;
        }
      }

      target.scrollIntoView(options);
    },
    { injector },
  );
}
