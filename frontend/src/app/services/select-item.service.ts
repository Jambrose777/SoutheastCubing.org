import { inject, Injectable, Injector, WritableSignal } from '@angular/core';
import { NavService } from 'src/app/services/nav.service';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { ThemeService } from 'src/app/services/theme.service';
import { Colors } from 'src/app/shared/types';
import { scrollIntoViewSafely } from 'src/app/shared/scroll-into-view-safely';

// Config for `SelectItemService.select()`, capturing only the per-page differences
export interface SelectItemConfig<T> {
  // The page's own selected-item signal, updated in place.
  selectedSignal: WritableSignal<T | undefined>;
  // Whether `item` is the currently selected item
  isSelected: (item: T) => boolean;
  // The DOM element id to scroll to on mobile - must match the id="" set in
  // the page's template for each list item.
  elementId: (item: T) => string;
  // The page's default main-pane color, restored when nothing is selected.
  basePaneColor: Colors;
  // The main-pane color to apply once `item` becomes selected.
  selectColor: (item: T) => Colors;
  // Called after the selection state has been updated, to replace the
  // browser's history entry with a URL reflecting the new selection.
  updateUrl: () => void;
}

// Shared "select an item to drill into its details" behavior used by every
// list+detail page. Provided in root since it only wraps other root-provided
// services and holds no per-page state of its own.
@Injectable({
  providedIn: 'root',
})
export class SelectItemService {
  private navService = inject(NavService);
  private themeService = inject(ThemeService);
  private screenSizeService = inject(ScreenSizeService);
  private injector = inject(Injector);

  select<T>(item: T, config: SelectItemConfig<T>): void {
    this.navService.closeNav();

    if (config.isSelected(item)) {
      // Selecting an already-selected item deselects it and resets the theme color;
      config.selectedSignal.set(undefined);
      this.themeService.setMainPaneColor(config.basePaneColor);
    } else {
      // The item becomes selected, recolors the theme, and scrolls it into view
      config.selectedSignal.set(item);
      if (!this.screenSizeService.isMobile()) {
        this.themeService.setMainPaneColor(config.selectColor(item));
        document.getElementById('header')?.scrollIntoView();
      } else {
        scrollIntoViewSafely(config.elementId(item), this.injector);
      }
    }

    config.updateUrl();
  }
}
