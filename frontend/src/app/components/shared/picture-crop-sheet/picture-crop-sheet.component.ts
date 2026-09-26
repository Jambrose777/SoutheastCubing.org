import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
  effect,
  signal,
  computed,
  viewChild,
  ElementRef,
} from '@angular/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MyInfoService } from 'src/app/services/southeastcubing-api/my-info.service';
import { ToastService } from 'src/app/services/toast.service';
import { MyInfo } from 'src/app/models/MyInfo';

// Minimum crop box size (in the image's own natural pixels) - keeps a
// resize drag from shrinking the crop down to something unusably tiny.
const MIN_CROP_SIZE = 40;

// Every edge/corner a resize drag can start from - n/s/e/w grow the box
// away from their opposite edge; the four corners grow away from their
// opposite corner.
type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

interface DragState {
  mode: 'move' | 'resize';
  handle?: ResizeHandle;
  startClientX: number;
  startClientY: number;
  startLeft: number;
  startTop: number;
  startSize: number;
}

// Shared "Picture & Crop" sheet.
@Component({
  selector: 'se-picture-crop-sheet',
  templateUrl: './picture-crop-sheet.component.html',
  styleUrls: ['./picture-crop-sheet.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatSlideToggleModule, MatTooltipModule],
})
export class PictureCropSheetComponent {
  private myInfoApi = inject(MyInfoService);
  private toastService = inject(ToastService);

  info = input.required<MyInfo>();
  closed = output<void>();
  saved = output<void>();

  private cropImg = viewChild<ElementRef<HTMLImageElement>>('cropImg');
  private fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  syncing = signal(false);
  uploading = signal(false);
  savingCrop = signal(false);

  // Bumped every time `info` gets a new value from the parent (i.e. after
  // any of this sheet's own mutations completes) - appended to the image
  // URL as a cache-buster, since a person's managed photo always lives at
  // the same fixed URL and would otherwise keep showing a stale, browser-
  // cached copy after an upload or resync.
  private refreshToken = signal(0);

  // The crop actually persisted on the server, vs. the one currently shown
  // in the editor (which may have an uncommitted drag/resize on it).
  committedCrop = signal({ x: 0, y: 0, size: 0 });
  draftCrop = signal({ x: 0, y: 0, size: 0 });

  naturalSize = signal<{ width: number; height: number } | null>(null);
  renderedWidth = signal(0);
  renderedHeight = signal(0);

  private dragState: DragState | null = null;
  private readonly onPointerMove = (event: PointerEvent) => this.handlePointerMove(event);
  private readonly onPointerUp = () => this.handlePointerUp();

  displayImageUrl = computed(() => {
    const url = this.info().pictureUrl;
    if (!url) return null;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${this.refreshToken()}`;
  });

  scale = computed(() => {
    const natural = this.naturalSize();
    return natural && natural.width > 0 ? this.renderedWidth() / natural.width : 1;
  });

  boxLeft = computed(() => this.draftCrop().x * this.scale());
  boxTop = computed(() => this.draftCrop().y * this.scale());
  boxSize = computed(() => this.draftCrop().size * this.scale());

  cropDirty = computed(() => {
    const committed = this.committedCrop();
    const draft = this.draftCrop();
    return committed.x !== draft.x || committed.y !== draft.y || committed.size !== draft.size;
  });

  constructor() {
    // Re-seeds committed/draft crop state (and bumps the cache-buster)
    // every time the parent hands this sheet a fresh `info`.
    effect(() => {
      const info = this.info();
      this.refreshToken.update((value) => value + 1);
      const crop = {
        x: info.thumbnailCropX ?? 0,
        y: info.thumbnailCropY ?? 0,
        size: info.thumbnailCropW ?? info.thumbnailCropH ?? 0,
      };
      this.committedCrop.set(crop);
      this.draftCrop.set(crop);
      this.naturalSize.set(null);
      this.renderedWidth.set(0);
      this.renderedHeight.set(0);
    });
  }

  isDirty(): boolean {
    return this.cropDirty();
  }

  onImageLoad() {
    const img = this.cropImg()?.nativeElement;
    if (!img) return;
    this.naturalSize.set({ width: img.naturalWidth, height: img.naturalHeight });
    this.renderedWidth.set(img.clientWidth);
    this.renderedHeight.set(img.clientHeight);
  }

  onToggleSync(enabled: boolean) {
    this.syncing.set(true);
    this.myInfoApi.setSyncEnabled(enabled).subscribe({
      next: () => {
        this.syncing.set(false);
        this.toastService.success(enabled ? 'Photo sync enabled.' : 'Photo sync disabled.');
        this.saved.emit();
      },
      error: (err) => {
        this.syncing.set(false);
        this.toastService.error(err?.error?.message ?? 'Failed to update photo sync.');
      },
    });
  }

  openFilePicker() {
    this.fileInput()?.nativeElement.click();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.toastService.error('Please choose an image file.');
      return;
    }

    this.uploading.set(true);
    this.myInfoApi.uploadPhoto(file).subscribe({
      next: () => {
        this.uploading.set(false);
        this.toastService.success('Photo uploaded.');
        this.saved.emit();
      },
      error: (err) => {
        this.uploading.set(false);
        this.toastService.error(err?.error?.message ?? 'Failed to upload photo.');
      },
    });
  }

  startDrag(event: PointerEvent) {
    this.beginInteraction(event, 'move');
  }

  startResize(event: PointerEvent, handle: ResizeHandle) {
    this.beginInteraction(event, 'resize', handle);
  }

  private beginInteraction(event: PointerEvent, mode: 'move' | 'resize', handle?: ResizeHandle) {
    event.preventDefault();
    event.stopPropagation();
    const box = this.draftCrop();
    this.dragState = {
      mode,
      handle,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startLeft: box.x,
      startTop: box.y,
      startSize: box.size,
    };
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
  }

  private handlePointerMove(event: PointerEvent) {
    const drag = this.dragState;
    const natural = this.naturalSize();
    const scale = this.scale();
    if (!drag || !natural || scale <= 0) return;

    const dx = (event.clientX - drag.startClientX) / scale;
    const dy = (event.clientY - drag.startClientY) / scale;

    if (drag.mode === 'move') {
      const size = drag.startSize;
      const x = clamp(drag.startLeft + dx, 0, natural.width - size);
      const y = clamp(drag.startTop + dy, 0, natural.height - size);
      this.draftCrop.set({ x, y, size });
    } else if (drag.handle) {
      this.draftCrop.set(resizeFromHandle(drag, drag.handle, dx, dy, natural));
    }
  }

  private handlePointerUp() {
    this.dragState = null;
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
  }

  saveCrop() {
    if (!this.cropDirty()) return;
    const crop = this.draftCrop();
    this.savingCrop.set(true);
    this.myInfoApi
      .updateCrop({
        cropX: Math.round(crop.x),
        cropY: Math.round(crop.y),
        cropW: Math.round(crop.size),
        cropH: Math.round(crop.size),
      })
      .subscribe({
        next: () => {
          this.savingCrop.set(false);
          this.toastService.success('Crop updated.');
          this.saved.emit();
        },
        error: (err) => {
          this.savingCrop.set(false);
          this.toastService.error(err?.error?.message ?? 'Failed to update crop.');
        },
      });
  }

  close() {
    this.closed.emit();
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

// Resizes the crop box from a single edge or corner, always keeping it
// square:
// - A corner drag grows/shrinks the box away from its opposite corner
//   (that corner stays fixed), same as a normal resize handle.
// - An edge drag grows/shrinks the box away from its opposite edge, but
//   stays centered along the perpendicular axis so the box remains square.
// Every branch clamps `newSize` between MIN_CROP_SIZE and however large the
// box can get before it would push past the image's own bounds, given
// where its fixed edge/corner/center is.
function resizeFromHandle(
  drag: Pick<DragState, 'startLeft' | 'startTop' | 'startSize'>,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  natural: { width: number; height: number },
): { x: number; y: number; size: number } {
  const { startLeft, startTop, startSize } = drag;
  const centerX = startLeft + startSize / 2;
  const centerY = startTop + startSize / 2;
  const rightEdge = startLeft + startSize;
  const bottomEdge = startTop + startSize;

  switch (handle) {
    case 'e': {
      const maxSize = Math.min(
        natural.width - startLeft,
        2 * centerY,
        2 * (natural.height - centerY),
      );
      const size = clamp(startSize + dx, MIN_CROP_SIZE, maxSize);
      return { x: startLeft, y: centerY - size / 2, size };
    }
    case 'w': {
      const maxSize = Math.min(rightEdge, 2 * centerY, 2 * (natural.height - centerY));
      const size = clamp(startSize - dx, MIN_CROP_SIZE, maxSize);
      return { x: rightEdge - size, y: centerY - size / 2, size };
    }
    case 'n': {
      const maxSize = Math.min(bottomEdge, 2 * centerX, 2 * (natural.width - centerX));
      const size = clamp(startSize - dy, MIN_CROP_SIZE, maxSize);
      return { x: centerX - size / 2, y: bottomEdge - size, size };
    }
    case 's': {
      const maxSize = Math.min(
        natural.height - startTop,
        2 * centerX,
        2 * (natural.width - centerX),
      );
      const size = clamp(startSize + dy, MIN_CROP_SIZE, maxSize);
      return { x: centerX - size / 2, y: startTop, size };
    }
    case 'se': {
      const maxSize = Math.min(natural.width - startLeft, natural.height - startTop);
      const size = clamp(startSize + (dx + dy) / 2, MIN_CROP_SIZE, maxSize);
      return { x: startLeft, y: startTop, size };
    }
    case 'sw': {
      const maxSize = Math.min(rightEdge, natural.height - startTop);
      const size = clamp(startSize + (dy - dx) / 2, MIN_CROP_SIZE, maxSize);
      return { x: rightEdge - size, y: startTop, size };
    }
    case 'ne': {
      const maxSize = Math.min(natural.width - startLeft, bottomEdge);
      const size = clamp(startSize + (dx - dy) / 2, MIN_CROP_SIZE, maxSize);
      return { x: startLeft, y: bottomEdge - size, size };
    }
    case 'nw': {
      const maxSize = Math.min(rightEdge, bottomEdge);
      const size = clamp(startSize - (dx + dy) / 2, MIN_CROP_SIZE, maxSize);
      return { x: rightEdge - size, y: bottomEdge - size, size };
    }
  }
}
