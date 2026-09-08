import { afterNextRender, Injector } from '@angular/core';

// Walks up from `element` to find its nearest scrollable ancestor (the
// element that actually clips/scrolls it), e.g. the clubs/competitions list's
// `.list-container` div. Returns `null` if none is found, meaning the element
// is only clipped by the browser window itself.
function getScrollParent(element: HTMLElement): HTMLElement | null {
  let parent = element.parentElement;
  while (parent) {
    const { overflowY } = getComputedStyle(parent);
    const isScrollable = overflowY === 'auto' || overflowY === 'scroll';
    if (isScrollable && parent.scrollHeight > parent.clientHeight) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

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
        // The clubs/competitions lists scroll inside their own container, not
        // the window, so an item can sit outside the container's visible
        // area while its bounding rect still falls within window bounds.
        // Compare against the scrollable container's rect when there is one,
        // falling back to the window's bounds for targets that aren't inside
        // a scrollable container.
        const scrollParent = getScrollParent(target);
        const bounds = scrollParent
          ? scrollParent.getBoundingClientRect()
          : { top: 0, bottom: window.innerHeight };
        const isVisible = rect.bottom <= bounds.bottom && rect.top >= bounds.top;
        if (isVisible) {
          return;
        }
      }

      target.scrollIntoView(options);
    },
    { injector },
  );
}
