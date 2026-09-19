// Whether a MouseEvent is an unmodified left-click that app-level SPA
// selection logic should handle itself (calling preventDefault() on the
// anchor's real navigation and updating state in place). Middle-click,
// right-click, and ctrl/cmd/shift-click are left alone so the browser's
// native anchor behavior (open in new tab/window) still works, mirroring the
// guard Angular's own RouterLink directive applies before intercepting a click.
export function isPlainLeftClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
}
