import { Injectable, inject } from '@angular/core';
import { environment } from 'src/environments/environment';
import { ContentfulService } from './contentful.service';
import { ContentfulEntryId } from '../models/Contentful';
import { LinksConfigurationSkeleton } from '../models/ContentfulSkeletons';
import { take } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class LinksService {
  private contentful = inject(ContentfulService);

  discord: string = environment.links.discord;
  facebook: string = environment.links.facebook;
  instagram: string = environment.links.instagram;
  youtube: string = environment.links.youtube;
  applyToVolunteerForm: string = environment.links.applyToVolunteerForm;

  pullLinksFromContentful() {
    // retrieve links data from the CMS to overwrite links
    this.contentful
      .getContentfulEntry<LinksConfigurationSkeleton>(ContentfulEntryId.linksConfiguration)
      .pipe(take(1))
      .subscribe({
        next: (res) => {
          if (res.fields.discord) {
            this.discord = res.fields.discord;
          }
          if (res.fields.facebook) {
            this.facebook = res.fields.facebook;
          }
          if (res.fields.instagram) {
            this.instagram = res.fields.instagram;
          }
          if (res.fields.youtube) {
            this.youtube = res.fields.youtube;
          }
          if (res.fields.applyToStaffForm) {
            this.applyToVolunteerForm = res.fields.applyToStaffForm;
          }
        },
        error: (err) => {
          // the hardcoded environment.links.* defaults set above already cover this case
          console.error('Failed to load links configuration from Contentful:', err);
        },
      });
  }
}
