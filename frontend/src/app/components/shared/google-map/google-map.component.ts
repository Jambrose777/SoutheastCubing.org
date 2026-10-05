import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SafeUrlPipe } from '../../../pipes/safeUrl.pipe';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'se-google-map',
  templateUrl: './google-map.component.html',
  styleUrls: ['./google-map.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SafeUrlPipe],
})
export class GoogleMapComponent {
  address = input<string | null>(null);

  googleMapUrl = computed(() => environment.links.googleMapsApi + (this.address() ?? ''));
}
