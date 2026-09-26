import { Component, ChangeDetectionStrategy, input, signal, computed } from '@angular/core';

// Renders a person's picture as a fixed-size square, honoring their
// thumbnail crop (thumbnailCropX/Y/W/H) when one is present.
@Component({
  selector: 'se-avatar',
  templateUrl: './avatar.component.html',
  styleUrls: ['./avatar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarComponent {
  src = input.required<string>();
  alt = input<string>('');
  // Square size in px - both the host box's and (in cover-fallback mode)
  // the image's own rendered width/height.
  size = input<number>(40);

  cropX = input<number | null>(null);
  cropY = input<number | null>(null);
  cropW = input<number | null>(null);
  cropH = input<number | null>(null);

  hasCrop = computed(() => {
    const w = this.cropW();
    const h = this.cropH();
    return this.cropX() != null && this.cropY() != null && !!w && !!h;
  });

  private naturalSize = signal<{ width: number; height: number } | null>(null);

  // Scales the full image up so its cropped square (cropW x cropH, in the
  // image's own natural pixels) fills this component's `size()` box.
  private scale = computed(() => {
    const cropW = this.cropW();
    if (!cropW) return null;
    return this.size() / cropW;
  });

  imgWidth = computed(() => {
    const natural = this.naturalSize();
    const scale = this.scale();
    return natural && scale ? natural.width * scale : this.size();
  });

  imgHeight = computed(() => {
    const natural = this.naturalSize();
    const scale = this.scale();
    return natural && scale ? natural.height * scale : this.size();
  });

  imgLeft = computed(() => {
    const scale = this.scale();
    const cropX = this.cropX();
    return scale && cropX != null ? -cropX * scale : 0;
  });

  imgTop = computed(() => {
    const scale = this.scale();
    const cropY = this.cropY();
    return scale && cropY != null ? -cropY * scale : 0;
  });

  onLoad(img: HTMLImageElement) {
    this.naturalSize.set({ width: img.naturalWidth, height: img.naturalHeight });
  }
}
