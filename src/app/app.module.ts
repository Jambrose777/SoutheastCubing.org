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
import { BrowserAnimationsModule, NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatMenuModule} from '@angular/material/menu';
import { LoadingSpinnerComponent } from './components/shared/loading-spinner/loading-spinner.component';
import { AlertModule } from '@coreui/angular';

const moduleRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  { path: 'competitions', component: CompetitionsComponent },
  { path: 'clubs', component: ClubsComponent },
  { path: 'delegates', component: DelegatesComponent },
  { path: 'home', component: HomeComponent },
  { path: 'involvement', component: InvolvementComponent },
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
    LoadingSpinnerComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    AppRoutingModule,
    RouterModule.forRoot(moduleRoutes),
    NoopAnimationsModule,
    MatMenuModule,
    // AlertModule,
    // BrowserAnimationsModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
