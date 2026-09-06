import { Component, input, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { Club } from 'src/app/models/Club';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { environment } from 'src/environments/environment';
import { NgOptimizedImage } from '@angular/common';
import { MarkdownComponent } from 'ngx-markdown';

@Component({
  selector: 'se-selected-club',
  templateUrl: './selected-club.component.html',
  styleUrls: ['./selected-club.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MarkdownComponent, NgOptimizedImage],
})
export class SelectedClubComponent {
  private screenSizeService = inject(ScreenSizeService);

  isMobile = this.screenSizeService.isMobile;

  enviroment = environment;
  selectedClub = input<Club>();

  // Single-item array for the @for that keys the image <img>, memoized so its
  // reference only changes when the image URL itself changes.
  imageAsArray = computed(() => {
    const image = this.selectedClub()?.image;
    return image ? [image] : [];
  });
}
