import { Component, input, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { Championship } from 'src/app/models/Championship';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { environment } from 'src/environments/environment';
import { NgOptimizedImage } from '@angular/common';
import { MarkdownComponent } from 'ngx-markdown';
import { CarouselComponent, CarouselImage } from '../../../shared/carousel/carousel.component';

@Component({
  selector: 'se-selected-championship',
  templateUrl: './selected-championship.component.html',
  styleUrls: ['./selected-championship.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MarkdownComponent, NgOptimizedImage, CarouselComponent],
})
export class SelectedChampionshipComponent {
  private screenSizeService = inject(ScreenSizeService);

  isMobile = this.screenSizeService.isMobile;

  environment = environment;
  selectedChampionship = input<Championship>();

  // Single-item array for the @for that keys the logo <img>, memoized so its
  // reference only changes when the logo URL itself changes.
  logoAsArray = computed(() => {
    const logo = this.selectedChampionship()?.logo;
    return logo ? [logo] : [];
  });

  // se-carousel takes { url, alt } pairs, but Championship.images is
  // { path, alt }[] - memoized so this only recomputes when the
  // championship itself changes
  imagePaths = computed<CarouselImage[]>(
    () =>
      this.selectedChampionship()?.images.map((image) => ({
        url: image.path,
        alt: image.alt,
      })) ?? [],
  );
}
