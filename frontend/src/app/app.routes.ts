import { Routes } from '@angular/router';
import { CompetitionsComponent } from './components/pages/competitions/competitions.component';
import { UpdateCompetitionsComponent } from './components/pages/update-competitions/update-competitions.component';
import { ClubsComponent } from './components/pages/clubs/clubs.component';
import { DelegatesComponent } from './components/pages/delegates/delegates.component';
import { HomeComponent } from './components/pages/home/home.component';
import { InvolvementComponent } from './components/pages/involvement/involvement.component';
import { ChampionshipsComponent } from './components/pages/championships/championships.component';
import { OrganizersComponent } from './components/pages/organizers/organizers.component';
import { ContactComponent } from './components/pages/contact/contact.component';
import { AboutComponent } from './components/pages/about/about.component';
import { CatsComponent } from './components/pages/cats/cats.component';
import { PageNotFoundComponent } from './components/pages/page-not-found/page-not-found.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  {
    path: 'competitions',
    component: CompetitionsComponent,
    title: 'SoutheastCubing - Competitions',
  },
  {
    path: 'competitions/:competitionId',
    component: CompetitionsComponent,
    title: 'SoutheastCubing - Competitions',
  },
  {
    path: 'update-competitions',
    component: UpdateCompetitionsComponent,
    title: 'SoutheastCubing - Update Competitions',
  },
  { path: 'clubs', component: ClubsComponent, title: 'SoutheastCubing - Clubs' },
  { path: 'clubs/:clubId', component: ClubsComponent, title: 'SoutheastCubing - Clubs' },
  { path: 'delegates', component: DelegatesComponent, title: 'SoutheastCubing - Delegates' },
  {
    path: 'delegates/:delegateName',
    component: DelegatesComponent,
    title: 'SoutheastCubing - Delegates',
  },
  { path: 'home', component: HomeComponent },
  { path: 'involvement', component: InvolvementComponent, title: 'SoutheastCubing - Get Involved' },
  {
    path: 'involvement/:subTopicId',
    component: InvolvementComponent,
    title: 'SoutheastCubing - Get Involved',
  },
  {
    path: 'championships',
    component: ChampionshipsComponent,
    title: 'SoutheastCubing - SE Champs',
  },
  {
    path: 'championships/:championshipId',
    component: ChampionshipsComponent,
    title: 'SoutheastCubing - SE Champs',
  },
  {
    path: 'organizers',
    component: OrganizersComponent,
    title: 'SoutheastCubing - Organizer Guidelines',
  },
  {
    path: 'organizers/:subTopicId',
    component: OrganizersComponent,
    title: 'SoutheastCubing - Organizer Guidelines',
  },
  { path: 'contact', component: ContactComponent, title: 'SoutheastCubing - Contact' },
  { path: 'about', component: AboutComponent, title: 'SoutheastCubing - About' },
  { path: 'about/:subTopicId', component: AboutComponent, title: 'SoutheastCubing - About' },
  { path: 'cats', component: CatsComponent, title: 'SoutheastCubing - Cats' },
  { path: 'cats/:catName', component: CatsComponent, title: 'SoutheastCubing - Cats' },
  {
    path: '**',
    pathMatch: 'full',
    component: PageNotFoundComponent,
    title: 'SoutheastCubing - Page Not Found',
  },
];
