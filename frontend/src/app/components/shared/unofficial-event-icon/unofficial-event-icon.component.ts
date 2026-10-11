import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';
import { getCustomUnofficialIconAsset, OTHER_ICON_ID } from './unofficial-events.util';

@Component({
  selector: 'se-unofficial-event-icon',
  templateUrl: './unofficial-event-icon.component.html',
  styleUrls: ['./unofficial-event-icon.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatTooltip],
})
export class UnofficialEventIconComponent {
  icon = input.required<string>();
  label = input<string | null>(null);
  customIconAsset = computed(() => getCustomUnofficialIconAsset(this.icon()));
  otherIconId = OTHER_ICON_ID;
}
