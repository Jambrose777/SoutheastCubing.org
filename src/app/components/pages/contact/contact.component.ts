import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { Competition } from 'src/app/models/Competition';
import { ContentfulEntryId } from 'src/app/models/Contentful';
import { EmailRequestBody } from 'src/app/models/EmailRequestBody';
import { AuthService } from 'src/app/services/auth.service';
import { ContentfulService } from 'src/app/services/contentful.service';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { SouteastcubingApiService } from 'src/app/services/souteastcubing-api.service';
import { ThemeService } from 'src/app/services/theme.service';
import { WcaService } from 'src/app/services/wca.service';
import { Colors, EmailApiStatus, EmailType } from 'src/app/shared/types';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-contact',
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.scss']
})
export class ContactComponent implements OnInit, OnDestroy {
  isMobile: boolean;;
  EmailApiStatus = EmailApiStatus;
  EmailType = EmailType;
  enviroment = environment;
  title: string = 'Contact';
  description: string = '';
  loadingContent: boolean = true;
  loadingCompetitions: boolean = true;
  competitions: Competition[] = [];
  selectedCompetition: Competition;
  ipAddress: string;
  emailApiStatus: EmailApiStatus = EmailApiStatus.none;
  hasHadError = false;
  subscriptions: Subscription = new Subscription();

  emailTypeOptions = [
    { value: EmailType.upcomingCompetition, label: 'An upcoming WCA competition' },
    { value: EmailType.pastCompetition, label: 'A past WCA competition' },
    { value: EmailType.delegates, label: 'Contact the Southeast Delegates' },
    { value: EmailType.clubs, label: 'Southeast Cubing clubs' },
    { value: EmailType.socialMedia, label: 'Southeast Cubing social media accounts' },
    { value: EmailType.getInvolved, label: 'Getting more involved with Southeast Cubing' },
    { value: EmailType.software, label: 'SoutheastCubing.org website issues or requests' },
    { value: EmailType.general, label: 'Other' },
  ];

  contactForm = new FormGroup({
    emailType: new FormControl(null, Validators.required),
    name: new FormControl(null, Validators.required),
    email: new FormControl(null, [Validators.required, Validators.email]),
    subject: new FormControl(null, Validators.required),
    message: new FormControl(null, Validators.required),
    competitionName: new FormControl(null)
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

  constructor(
    private contentful: ContentfulService,
    private themeService: ThemeService,
    private wca: WcaService,
    private auth: AuthService,
    private southeastcubingApiService: SouteastcubingApiService,
    private route: ActivatedRoute,
    private screenSizeService: ScreenSizeService,
  ) { }

  ngOnInit(): void {
    // sets up responsive screensize
    this.subscriptions.add(this.screenSizeService.getIsMobileSubject().subscribe(isMobile => this.isMobile = isMobile));

    // sets up main color for the Contact page
    this.themeService.setMainPaneColor(Colors.yellow);

    // retireve formats data from the CMS Contact Page
    this.subscriptions.add(this.contentful.getContentfulEntry(ContentfulEntryId.contact).subscribe(res => {
      this.description = res.fields.description;
      this.loadingContent = false;
    }));

    // retrieve the competitions list from WCA
    this.subscriptions.add(this.wca.getUpcomingCompetitions().subscribe(res => {
      this.competitions = res;
      this.loadingCompetitions = false;
    }));

    // retrieves IP Address if available
    this.subscriptions.add(this.auth.getIpAddress().subscribe(res => {
      this.ipAddress = res;
    }));

    // set up custom validators
    this.subscriptions.add(this.emailTypeControl.valueChanges.subscribe(value => {
      if (value === EmailType.pastCompetition) {
        this.competitionNameControl.setValidators([Validators.required])
      } else {
        this.competitionNameControl.setValidators(null);
      }

      this.competitionNameControl.updateValueAndValidity();
    }));

    // pull default values from query params
    this.subscriptions.add(this.route.queryParams.subscribe(params => {
      if (params['defaultEmailType']) {
        this.emailTypeControl.setValue(params['defaultEmailType'])
      }
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  onSubmit(): void {
    this.emailApiStatus = EmailApiStatus.none;
    // check for a valid form
    if (!this.contactForm.valid) {
      this.contactForm.markAllAsTouched();
      return;
    }

    // setup form for submission
    this.emailApiStatus = EmailApiStatus.pending;
    this.contactForm.disable();

    // compile request
    const emailRequestBody: EmailRequestBody = {
      name: this.nameControl.value,
      email: this.emailControl.value,
      emailType: this.emailTypeControl.value,
      text: this.messageControl.value,
      subject: this.emailTypeControl.value === EmailType.pastCompetition ? (this.competitionNameControl.value + ' - ' + this.subjectControl.value) : this.subjectControl.value,
      ip: this.ipAddress,
    }

    // submit API Call
    this.subscriptions.add(this.southeastcubingApiService.contactSubmission(emailRequestBody).subscribe({
      next: (res) => {
        this.emailApiStatus = EmailApiStatus.success;
        this.contactForm.enable();
        this.contactForm.reset();
      },
      error: (error) => {
        if (this.hasHadError) {
          this.emailApiStatus = EmailApiStatus.doubleFailure;
        } else {
          this.emailApiStatus = EmailApiStatus.failure;
          this.hasHadError = true;
        }
        this.contactForm.enable();
      }
    }))

  }

}
