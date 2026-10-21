import { inject, Injectable } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { BehaviorSubject } from 'rxjs';

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

export type ClockVideoToggleResult = 'opened' | 'closed' | 'invalid';

export interface ActiveClockVideo {
  owner: symbol;
  rowId: string;
  url: string;
}

// Share the single active result video across every Clock results table.
@Injectable()
export class ClockVideoPlaybackService {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly activeVideoSubject = new BehaviorSubject<ActiveClockVideo | null>(null);
  readonly activeVideo$ = this.activeVideoSubject.asObservable();

  // Toggle a valid HTTPS video row, replacing any previously active row.
  toggle(owner: symbol, rowId: string, url: string): ClockVideoToggleResult {
    const parsedUrl = this.parseHttpsUrl(url);
    if (!parsedUrl) return 'invalid';

    const activeVideo = this.activeVideoSubject.value;
    if (activeVideo?.owner === owner && activeVideo.rowId === rowId) {
      this.activeVideoSubject.next(null);
      return 'closed';
    }

    this.activeVideoSubject.next({ owner, rowId, url: parsedUrl.href });
    return 'opened';
  }

  // Convert supported YouTube URLs to a privacy-enhanced player URL.
  embedUrlFor(url: string): SafeResourceUrl | null {
    const videoUrl = this.parseHttpsUrl(url);
    if (!videoUrl || !YOUTUBE_HOSTS.has(videoUrl.hostname)) return null;

    const videoId =
      videoUrl.hostname === 'youtu.be' || videoUrl.hostname === 'www.youtu.be'
        ? (videoUrl.pathname.split('/').filter(Boolean)[0] ?? null)
        : videoUrl.pathname === '/watch'
          ? videoUrl.searchParams.get('v')
          : (videoUrl.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1] ?? null);

    if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;

    const embedUrl = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`);
    embedUrl.searchParams.set('autoplay', '1');
    embedUrl.searchParams.set('playsinline', '1');
    return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl.toString());
  }

  // Reject malformed URLs, credentials, and non-HTTPS schemes.
  private parseHttpsUrl(url: string): URL | null {
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== 'https:' || parsedUrl.username || parsedUrl.password) return null;
      return parsedUrl;
    } catch {
      return null;
    }
  }
}
