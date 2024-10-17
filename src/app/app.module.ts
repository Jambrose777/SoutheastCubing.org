import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HeaderComponent } from './components/core/header/header.component';
import { DelegatesComponent } from './components/pages/delegates/delegates.component';
import { HomeComponent } from './components/pages/home/home.component';
import { RouterModule, Routes } from '@angular/router';
import { FooterComponent } from './components/core/footer/footer.component';
import { InvolvementComponent } from './components/pages/involvement/involvement.component';
import { ClubsComponent } from './components/pages/clubs/clubs.component';
import { CompetitionsComponent } from './components/pages/competitions/competitions.component';
import { HttpClientModule } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatMenuModule } from '@angular/material/menu';
import { LoadingSpinnerComponent } from './components/shared/loading-spinner/loading-spinner.component';
import { IvyCarouselModule } from 'angular-responsive-carousel';
import { ChampionshipsComponent } from './components/pages/championships/championships.component';
import { NavComponent } from './components/core/nav/nav.component';
import { SelectedCompetitionComponent } from './components/pages/competitions/selected-competition/selected-competition.component';
import { SelectedClubComponent } from './components/pages/clubs/selected-club/selected-club.component';
import { SelectedDelegateComponent } from './components/pages/delegates/selected-delegate/selected-delegate.component';
import { SelectedChampionshipComponent } from './components/pages/championships/selected-championship/selected-championship.component';
import { SelectedSubTopicComponent } from './components/shared/selected-sub-topic/selected-sub-topic.component';
import { OrganizersComponent } from './components/pages/organizers/organizers.component';
import { ContactComponent } from './components/pages/contact/contact.component';
import { AboutComponent } from './components/pages/about/about.component';
import { ReactiveFormsModule } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { SeMapComponent } from './components/shared/se-map/se-map.component';
import { EventListComponent } from './components/shared/event-list/event-list.component';
import { PageNotFoundComponent } from './components/pages/page-not-found/page-not-found.component';
import { CatsComponent } from './components/pages/cats/cats.component';
import { SelectedCatComponent } from './components/pages/cats/selected-cat/selected-cat.component';
import { TeamsComponent } from './components/pages/about/teams/teams.component';

const moduleRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  { path: 'competitions', component: CompetitionsComponent, title: 'SoutheastCubing - Competitions' },
  { path: 'competitions/:competitionId', component: CompetitionsComponent, title: 'SoutheastCubing - Competitions' },
  { path: 'clubs', component: ClubsComponent, title: 'SoutheastCubing - Clubs' },
  { path: 'clubs/:clubId', component: ClubsComponent, title: 'SoutheastCubing - Clubs' },
  { path: 'delegates', component: DelegatesComponent, title: 'SoutheastCubing - Delegates' },
  { path: 'delegates/:delegateName', component: DelegatesComponent, title: 'SoutheastCubing - Delegates' },
  { path: 'home', component: HomeComponent },
  { path: 'involvement', component: InvolvementComponent, title: 'SoutheastCubing - Get Involved' },
  { path: 'involvement/:subTopicId', component: InvolvementComponent, title: 'SoutheastCubing - Get Involved' },
  { path: 'championships', component: ChampionshipsComponent, title: 'SoutheastCubing - SE Champs' },
  { path: 'championships/:championshipId', component: ChampionshipsComponent, title: 'SoutheastCubing - SE Champs' },
  { path: 'organizers', component: OrganizersComponent, title: 'SoutheastCubing - Organizer Guidelines' },
  { path: 'organizers/:subTopicId', component: OrganizersComponent, title: 'SoutheastCubing - Organizer Guidelines' },
  { path: 'contact', component: ContactComponent, title: 'SoutheastCubing - Contact' },
  { path: 'about', component: AboutComponent, title: 'SoutheastCubing - About' },
  { path: 'about/:subTopicId', component: AboutComponent, title: 'SoutheastCubing - About' },
  { path: 'cats', component: CatsComponent, title: 'SoutheastCubing - Cats' },
  { path: 'cats/:catName', component: CatsComponent, title: 'SoutheastCubing - Cats' },
  { path: '**', pathMatch: 'full',  component: PageNotFoundComponent, title: 'SoutheastCubing - Page Not Found' }, 
];

@NgModule({
  declarations: [
    AppComponent,
    HeaderComponent,
    DelegatesComponent,
    HomeComponent,
    FooterComponent,
    InvolvementComponent,
    ClubsComponent,
    CompetitionsComponent,
    LoadingSpinnerComponent,
    ChampionshipsComponent,
    NavComponent,
    SelectedCompetitionComponent,
    SelectedClubComponent,
    SelectedDelegateComponent,
    SelectedChampionshipComponent,
    SelectedSubTopicComponent,
    OrganizersComponent,
    ContactComponent,
    AboutComponent,
    SeMapComponent,
    EventListComponent,
    PageNotFoundComponent,
    CatsComponent,
    SelectedCatComponent,
    TeamsComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    AppRoutingModule,
    RouterModule.forRoot(moduleRoutes),
    NoopAnimationsModule,
    MatMenuModule,
    IvyCarouselModule,
    ReactiveFormsModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
