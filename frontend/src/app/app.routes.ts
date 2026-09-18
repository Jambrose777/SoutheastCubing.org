import { Routes } from '@angular/router';

// Several pages need two route entries (bare path + path with an optional
// trailing id param); each pair shares a single `loadComponent` callback
// below.
const loadCompetitions = () =>
  import('./components/pages/competitions/competitions.component').then(
    (m) => m.CompetitionsComponent,
  );
const loadClubs = () =>
  import('./components/pages/clubs/clubs.component').then((m) => m.ClubsComponent);
const loadDelegates = () =>
  import('./components/pages/delegates/delegates.component').then((m) => m.DelegatesComponent);
const loadInvolvement = () =>
  import('./components/pages/involvement/involvement.component').then(
    (m) => m.InvolvementComponent,
  );
const loadChampionships = () =>
  import('./components/pages/championships/championships.component').then(
    (m) => m.ChampionshipsComponent,
  );
const loadAbout = () =>
  import('./components/pages/about/about.component').then((m) => m.AboutComponent);
const loadCats = () =>
  import('./components/pages/cats/cats.component').then((m) => m.CatsComponent);

// Every route below uses `loadComponent` (rather than eager `component: X`) so
// visiting any single page only downloads that page's compiled JS, not every
// other page's, up front.
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  {
    path: 'competitions',
    loadComponent: loadCompetitions,
    title: 'SoutheastCubing - Competitions',
  },
  {
    path: 'competitions/:competitionId',
    loadComponent: loadCompetitions,
    title: 'SoutheastCubing - Competitions',
  },
  {
    path: 'update-competitions',
    loadComponent: () =>
      import('./components/pages/update-competitions/update-competitions.component').then(
        (m) => m.UpdateCompetitionsComponent,
      ),
    title: 'SoutheastCubing - Update Competitions',
  },
  {
    path: 'clubs',
    loadComponent: loadClubs,
    title: 'SoutheastCubing - Clubs',
  },
  {
    path: 'clubs/:clubId',
    loadComponent: loadClubs,
    title: 'SoutheastCubing - Clubs',
  },
  {
    path: 'delegates',
    loadComponent: loadDelegates,
    title: 'SoutheastCubing - Delegates',
  },
  {
    path: 'delegates/:delegateName',
    loadComponent: loadDelegates,
    title: 'SoutheastCubing - Delegates',
  },
  {
    path: 'home',
    loadComponent: () =>
      import('./components/pages/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'involvement',
    loadComponent: loadInvolvement,
    title: 'SoutheastCubing - Get Involved',
  },
  {
    path: 'involvement/:subTopicId',
    loadComponent: loadInvolvement,
    title: 'SoutheastCubing - Get Involved',
  },
  {
    path: 'championships',
    loadComponent: loadChampionships,
    title: 'SoutheastCubing - Championships',
  },
  {
    path: 'championships/:championshipId',
    loadComponent: loadChampionships,
    title: 'SoutheastCubing - Championships',
  },
  {
    path: 'organizers',
    // Retired standalone page, folded into Get Involved's "Organizing a Competition"
    // subtopic - redirect keeps existing links/bookmarks working.
    redirectTo: 'involvement/Organizing-a-Competition',
    pathMatch: 'full',
  },
  {
    path: 'organizers/:subTopicId',
    redirectTo: 'involvement/Organizing-a-Competition',
  },
  {
    path: 'contact',
    loadComponent: () =>
      import('./components/pages/contact/contact.component').then((m) => m.ContactComponent),
    title: 'SoutheastCubing - Contact',
  },
  {
    path: 'about',
    loadComponent: loadAbout,
    title: 'SoutheastCubing - About',
  },
  {
    path: 'about/:subTopicId',
    loadComponent: loadAbout,
    title: 'SoutheastCubing - About',
  },
  {
    path: 'cats',
    loadComponent: loadCats,
    title: 'SoutheastCubing - Cats',
  },
  {
    path: 'cats/:catName',
    loadComponent: loadCats,
    title: 'SoutheastCubing - Cats',
  },
  {
    path: '**',
    pathMatch: 'full',
    loadComponent: () =>
      import('./components/pages/page-not-found/page-not-found.component').then(
        (m) => m.PageNotFoundComponent,
      ),
    title: 'SoutheastCubing - Page Not Found',
  },
];
