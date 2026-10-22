import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'se-clock-video-expanded-row, tr[seClockVideoExpandedRow]',
  templateUrl: './clock-video-expanded-row.component.html',
  styleUrl: './clock-video-expanded-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClockVideoExpandedRowComponent {
  colspan = input.required<number>();
  embedUrl = input.required<SafeResourceUrl | null>();
  panelId = input.required<string>();
}
