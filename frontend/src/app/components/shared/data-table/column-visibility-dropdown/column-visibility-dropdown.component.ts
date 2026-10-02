import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
} from '@angular/core';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DataTableColumnMeta } from '../data-table.types';

// Column-visibility popover: a trigger button + checklist of every column
// (not just filterable ones) - toggling one shows/hides it in the table
// without touching that column's own filter/sort state. Each row also has
// its own drag handle to reorder columns.
@Component({
  selector: 'se-column-visibility-dropdown',
  templateUrl: './column-visibility-dropdown.component.html',
  styleUrls: ['./column-visibility-dropdown.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DragDropModule, MatTooltipModule],
})
export class ColumnVisibilityDropdownComponent {
  private elementRef = inject(ElementRef<HTMLElement>);

  // Every reorderable column, in its current display order.
  columns = input.required<DataTableColumnMeta[]>();
  // Columns that always render last, after every reorderable one above - not
  // draggable, just a plain visibility checkbox.
  pinnedColumns = input<DataTableColumnMeta[]>([]);
  visibleKeys = input.required<Set<string>>();
  // Emitted whenever a single column's checkbox is toggled.
  visibilityChange = output<{ key: string; shown: boolean }>();
  // Emitted with every column's key, in the new order, after a drag.
  orderChange = output<string[]>();

  isOpen = false;

  toggleOpen() {
    this.isOpen = !this.isOpen;
  }

  close() {
    this.isOpen = false;
  }

  onToggle(key: string, event: Event) {
    const shown = (event.target as HTMLInputElement).checked;
    this.visibilityChange.emit({ key, shown });
  }

  // Reorders a local copy (never mutates the `columns` input itself) and
  // emits just the resulting key order.
  onDrop(event: CdkDragDrop<DataTableColumnMeta[]>) {
    const reordered = [...this.columns()];
    moveItemInArray(reordered, event.previousIndex, event.currentIndex);
    this.orderChange.emit(reordered.map((column) => column.key));
  }

  // Closes on any click outside this component's own trigger/panel.
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.isOpen && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }
}
