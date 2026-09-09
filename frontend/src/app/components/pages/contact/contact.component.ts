import {
  Component,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { Competition } from 'src/app/models/Competition';
import { ContentfulEntryId } from 'src/app/models/Contentful';
import { ContactPageSkeleton } from 'src/app/models/ContentfulSkeletons';
import { EmailRequestBody } from 'src/app/models/EmailRequestBody';
import { ContentfulService } from 'src/app/services/contentful.service';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { SouteastcubingApiService } from 'src/app/services/souteastcubing-api.service';
import { ThemeService } from 'src/app/services/theme.service';
import { Colors, EmailApiStatus, EmailType } from 'src/app/shared/types';
import { environment } from 'src/environments/environment';
import { HeaderComponent } from '../../core/header/header.component';
import { MatFormField, MatLabel, MatSelect, MatOption, MatError } from '@angular/material/select';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner.component';
import { MatInput } from '@angular/material/input';
import { MarkdownComponent } from 'ngx-markdown';
import { NgOptimizedImage } from '@angular/common';

@Component({
  selector: 'se-contact',
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HeaderComponent,
    ReactiveFormsModule,
    MatFormField,
    MatLabel,
    MatSelect,
    MatOption,
    MatError,
    LoadingSpinnerComponent,
    MatInput,
    MarkdownComponent,
    NgOptimizedImage,
  ],
})
export class ContactComponent implements OnInit, OnDestroy {
  private contentful = inject(ContentfulService);
  private themeService = inject(ThemeService);
  private southeastcubingApiService = inject(SouteastcubingApiService);
  private route = inject(ActivatedRoute);
  private screenSizeService = inject(ScreenSizeService);

  isMobile = this.screenSizeService.isMobile;

  EmailApiStatus = EmailApiStatus;
  EmailType = EmailType;
  environment = environment;
  title = signal('Contact');
  description = signal('');
  loadingContent = signal(true);
  loadingCompetitions = signal(true);
  competitions = signal<Competition[]>([]);
  emailApiStatus = signal(EmailApiStatus.none);

  hasHadError = false;
  subscriptions: Subscription = new Subscription();

  selectedCompetition?: Competition;

  emailTypeOptions = [
    { value: EmailType.upcomingCompetition, label: 'An upcoming WCA competition' },
    { value: EmailType.pastCompetition, label: 'A past WCA competition' },
    { value: EmailType.clubs, label: 'Southeast Cubing clubs' },
    { value: EmailType.socialMedia, label: 'Southeast Cubing social media' },
    { value: EmailType.software, label: 'SoutheastCubing.org website' },
    { value: EmailType.organizing, label: 'Organize a SECI supported competition' },
    { value: EmailType.getInvolved, label: 'Get more involved with Southeast Cubing, Inc.' },
    { value: EmailType.general, label: 'Other' },
  ];

  contactForm = new FormGroup({
    emailType: new FormControl(null, Validators.required),
    name: new FormControl(null, Validators.required),
    email: new FormControl(null, [Validators.required, Validators.email]),
    subject: new FormControl(null, Validators.required),
    message: new FormControl(null, Validators.required),
    competitionName: new FormControl(null),
  });

  get emailTypeControl(): FormControl {
    return this.contactForm.get('emailType') as FormControl;
  }

  get nameControl(): FormControl {
    return this.contactForm.get('name') as FormControl;
  }

  get emailControl(): FormControl {
    return this.contactForm.get('email') as FormControl;
  }

  get subjectControl(): FormControl {
    return this.contactForm.get('subject') as FormControl;
  }

  get messageControl(): FormControl {
    return this.contactForm.get('message') as FormControl;
  }

  get competitionNameControl(): FormControl {
    return this.contactForm.get('competitionName') as FormControl;
  }

  ngOnInit(): void {
    // sets up main color for the Contact page
    this.themeService.setMainPaneColor(Colors.yellow);

    // retrieve formats data from the CMS Contact Page
    this.subscriptions.add(
      this.contentful.getContentfulEntry<ContactPageSkeleton>(ContentfulEntryId.contact).subscribe({
        next: (res) => {
          this.description.set(res.fields.description ?? '');
          this.loadingContent.set(false);
        },
        error: (err) => {
          console.error('Failed to load the contact page content from Contentful:', err);
          this.loadingContent.set(false);
        },
      }),
    );

    // retrieve the competitions list from WCA
    this.subscriptions.add(
      this.southeastcubingApiService.getUpcomingCompetitions().subscribe({
        next: (res) => {
          this.competitions.set(res);
          this.loadingCompetitions.set(false);
        },
        error: (err) => {
          console.error('Failed to load the upcoming competitions list:', err);
          this.loadingCompetitions.set(false);
        },
      }),
    );

    // set up custom validators
    this.subscriptions.add(
      this.emailTypeControl.valueChanges.subscribe((value) => {
        if (value === EmailType.pastCompetition) {
          this.competitionNameControl.setValidators([Validators.required]);
        } else {
          this.competitionNameControl.setValidators(null);
        }

        this.competitionNameControl.updateValueAndValidity();
      }),
    );

    // pull default values from query params
    this.subscriptions.add(
      this.route.queryParams.subscribe((params) => {
        if (params['defaultEmailType']) {
          this.emailTypeControl.setValue(params['defaultEmailType']);
        }
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  onSubmit(): void {
    this.emailApiStatus.set(EmailApiStatus.none);
    // check for a valid form
    if (!this.contactForm.valid) {
      this.contactForm.markAllAsTouched();
      return;
    }

    // setup form for submission
    this.emailApiStatus.set(EmailApiStatus.pending);
    this.contactForm.disable();

    // compile request
    const emailRequestBody: EmailRequestBody = {
      name: this.nameControl.value,
      email: this.emailControl.value,
      emailType: this.emailTypeControl.value,
      text: this.messageControl.value,
      subject:
        this.emailTypeControl.value === EmailType.pastCompetition
          ? this.competitionNameControl.value + ' - ' + this.subjectControl.value
          : this.subjectControl.value,
    };

    // submit API Call
    this.subscriptions.add(
      this.southeastcubingApiService.contactSubmission(emailRequestBody).subscribe({
        next: () => {
          this.emailApiStatus.set(EmailApiStatus.success);
          this.contactForm.enable();
          this.contactForm.reset();
        },
        error: () => {
          if (this.hasHadError) {
            this.emailApiStatus.set(EmailApiStatus.doubleFailure);
          } else {
            this.emailApiStatus.set(EmailApiStatus.failure);
            this.hasHadError = true;
          }
          this.contactForm.enable();
        },
      }),
    );
  }
}
