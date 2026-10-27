import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';

declare global {
  interface Window {
    dataLayer?: unknown[][];
    gtag?: (...args: unknown[]) => void;
  }
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private initialized = false;

  // Queue GA configuration only in production; GA4 handles browser-history page views.
  initialize(): void {
    const measurementId = environment.googleAnalyticsMeasurementId;
    if (!environment.production || !measurementId || this.initialized) {
      return;
    }

    this.initialized = true;
    const dataLayer = (window.dataLayer ??= []);
    const gtag = (...args: unknown[]) => dataLayer.push(args);
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', measurementId);

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);
  }
}
